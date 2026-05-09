import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { implement, ORPCError } from "@orpc/server";
import { organization } from "../../../database/drizzle/schema/auth.schema";
import {
	cashMovement as cashMovementTable,
	shift,
	shiftClosure,
} from "../../../database/drizzle/schema/pos.schema";
import { payment, sale } from "../../../database/drizzle/schema/sales.schema";
import { dbSqlite } from "../../../database/drizzle/db";
import {
	buildPaymentMethodOptions,
	comparePaymentMethodIds,
	getAllPaymentMethods,
	getEnabledPaymentMethods,
	parseOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import { shiftsContract } from "../contracts/shifts";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const shiftsImplementer = implement(shiftsContract).$context<{
	headers: Headers;
	db: ReturnType<typeof dbSqlite>;
}>();

const orgRequiredProcedure = shiftsImplementer
	.use(dbMiddleware)
	.use(authMiddleware)
	.use(requireOrgMiddleware);

function normalizeNumber(value: number | string | null | undefined) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function normalizeOptionalString(value?: string | null) {
	if (value == null) {
		return null;
	}
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredString(value: string, fieldName: string) {
	const normalized = value.trim();
	if (normalized.length === 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `El campo "${fieldName}" es obligatorio`,
		});
	}
	return normalized;
}

function toNonNegativeInteger(value: number, fieldName: string) {
	if (!Number.isFinite(value) || value < 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`,
		});
	}
	return Math.round(value);
}

function toPositiveInteger(value: number, fieldName: string) {
	const normalized = toNonNegativeInteger(value, fieldName);
	if (normalized <= 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `El campo "${fieldName}" debe ser un número válido mayor a 0`,
		});
	}
	return normalized;
}

function resolveDate(input?: number) {
	if (input === undefined) {
		return new Date();
	}
	return new Date(toNonNegativeInteger(input, "timestamp"));
}

function toTimestamp(value: Date | number | string | null | undefined) {
	if (value == null) {
		return null;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	if (typeof value === "number") {
		return value;
	}
	const dateValue = new Date(value);
	return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

function buildExpectedAmountsByMethod(
	startingCash: number,
	payments: Array<{
		method: string;
		amount: number;
		saleId?: string | null;
		saleTotalAmount?: number | null;
	}>,
	movements: Array<{ type: string; paymentMethod: string; amount: number }>,
) {
	const expectedByMethod = new Map<string, number>();
	const salePaymentStats = new Map<
		string,
		{ saleTotalAmount: number; totalPaid: number; cashPaid: number }
	>();

	for (const registeredPayment of payments) {
		expectedByMethod.set(
			registeredPayment.method,
			(expectedByMethod.get(registeredPayment.method) ?? 0) +
				registeredPayment.amount,
		);

		if (
			!registeredPayment.saleId ||
			registeredPayment.saleTotalAmount === null ||
			registeredPayment.saleTotalAmount === undefined
		) {
			continue;
		}

		const paymentStats = salePaymentStats.get(registeredPayment.saleId) ?? {
			saleTotalAmount: normalizeNumber(registeredPayment.saleTotalAmount),
			totalPaid: 0,
			cashPaid: 0,
		};
		paymentStats.totalPaid += registeredPayment.amount;
		if (registeredPayment.method === "cash") {
			paymentStats.cashPaid += registeredPayment.amount;
		}
		salePaymentStats.set(registeredPayment.saleId, paymentStats);
	}

	let changeReturnedInCash = 0;
	for (const paymentStats of salePaymentStats.values()) {
		const overpayment = Math.max(
			paymentStats.totalPaid - paymentStats.saleTotalAmount,
			0,
		);
		if (overpayment <= 0 || paymentStats.cashPaid <= 0) {
			continue;
		}
		changeReturnedInCash += Math.min(overpayment, paymentStats.cashPaid);
	}

	if (changeReturnedInCash > 0) {
		expectedByMethod.set(
			"cash",
			Math.max(
				(expectedByMethod.get("cash") ?? 0) - changeReturnedInCash,
				0,
			),
		);
	}

	expectedByMethod.set(
		"cash",
		(expectedByMethod.get("cash") ?? 0) + startingCash,
	);

	for (const movement of movements) {
		const paymentMethod = movement.paymentMethod || "cash";
		const currentAmount = expectedByMethod.get(paymentMethod) ?? 0;

		switch (movement.type) {
			case "inflow":
				expectedByMethod.set(paymentMethod, currentAmount + movement.amount);
				break;
			case "expense":
			case "payout":
				expectedByMethod.set(paymentMethod, currentAmount - movement.amount);
				break;
			default:
				throw new ORPCError("BAD_REQUEST", {
					message: `Tipo de movimiento de caja no soportado: ${movement.type}`,
				});
		}
	}

	return expectedByMethod;
}

export const active = orgRequiredProcedure.active.handler(
	async ({ context }) => {
		const activeShiftRow = await context.db
			.select({
				id: shift.id,
				terminalName: shift.terminalName,
				status: shift.status,
				openedAt: shift.openedAt,
			})
			.from(shift)
			.where(
				and(
					eq(shift.organizationId, context.organizationId),
					eq(shift.userId, context.user.id),
					eq(shift.status, "open"),
				),
			)
			.limit(1)
			.then((rows) => rows[0] ?? null);

		return { shift: activeShiftRow };
	},
);

export const open = orgRequiredProcedure.open.handler(
	async ({ input, context }) => {
		const { organizationId, user } = context;
		const startingCash = toNonNegativeInteger(input.startingCash, "startingCash");
		const terminalId = normalizeOptionalString(input.terminalId);
		const notes = normalizeOptionalString(input.notes);
		const openedAt = resolveDate(input.openedAt);

		const organizationSettingsRows = await context.db
			.select({
				metadata: organization.metadata,
			})
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);
		const organizationSettings = parseOrganizationSettingsMetadata(
			organizationSettingsRows[0]?.metadata,
		);
		const terminalName =
			normalizeOptionalString(input.terminalName) ??
			organizationSettings.pos.defaultTerminalName;

		const [userOpenShift] = await context.db
			.select({ id: shift.id })
			.from(shift)
			.where(
				and(
					eq(shift.organizationId, organizationId),
					eq(shift.userId, user.id),
					eq(shift.status, "open"),
				),
			)
			.limit(1);

		if (userOpenShift) {
			throw new ORPCError("CONFLICT", {
				message: "El usuario ya tiene un turno abierto",
			});
		}

		if (terminalId) {
			const [terminalOpenShift] = await context.db
				.select({ id: shift.id })
				.from(shift)
				.where(
					and(
						eq(shift.organizationId, organizationId),
						eq(shift.status, "open"),
						eq(shift.terminalId, terminalId),
					),
				)
				.limit(1);

			if (terminalOpenShift) {
				throw new ORPCError("CONFLICT", {
					message: "La terminal indicada ya tiene un turno abierto",
				});
			}
		}

		const shiftId = crypto.randomUUID();
		await context.db.insert(shift).values({
			id: shiftId,
			organizationId,
			userId: user.id,
			terminalId,
			terminalName,
			status: "open",
			startingCash,
			openedAt,
			notes,
		});

		return {
			id: shiftId,
			status: "open" as const,
			startingCash,
			openedAt: openedAt.getTime(),
		};
	},
);

export const cashMovement = orgRequiredProcedure.cashMovement.handler(
	async ({ input, context }) => {
		const { organizationId, user } = context;
		const validTypes = ["expense", "payout", "inflow"] as const;
		if (!validTypes.includes(input.type as (typeof validTypes)[number])) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Tipo de movimiento de caja inválido",
			});
		}

		const amount = toPositiveInteger(input.amount, "amount");
		const description = normalizeRequiredString(input.description, "description");
		const paymentMethod = normalizeRequiredString(
			input.paymentMethod,
			"paymentMethod",
		).toLowerCase();
		const createdAt = resolveDate(input.createdAt);

		const [targetShift, organizationRow] = await Promise.all([
			context.db
				.select({ id: shift.id, userId: shift.userId, status: shift.status })
				.from(shift)
				.where(
					and(
						eq(shift.id, input.shiftId),
						eq(shift.organizationId, organizationId),
					),
				)
				.limit(1)
				.then((rows) => rows[0]),
			context.db
				.select({
					metadata: organization.metadata,
				})
				.from(organization)
				.where(eq(organization.id, organizationId))
				.limit(1)
				.then((rows) => rows[0]),
		]);

		if (!targetShift) {
			throw new ORPCError("NOT_FOUND", {
				message: "Turno no encontrado para la organización activa",
			});
		}
		if (targetShift.status !== "open") {
			throw new ORPCError("BAD_REQUEST", {
				message: "No se puede registrar movimiento en un turno cerrado",
			});
		}
		if (targetShift.userId !== user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "Solo el cajero del turno puede registrar movimientos",
			});
		}

		const enabledPaymentMethodIds = new Set(
			getEnabledPaymentMethods(
				parseOrganizationSettingsMetadata(organizationRow?.metadata),
			).map((pm) => pm.id),
		);
		if (!enabledPaymentMethodIds.has(paymentMethod)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Método de pago no habilitado: ${paymentMethod}`,
			});
		}

		const movementId = crypto.randomUUID();
		await context.db.insert(cashMovementTable).values({
			id: movementId,
			organizationId,
			shiftId: input.shiftId,
			type: input.type,
			paymentMethod,
			amount,
			description,
			createdAt,
		});

		return {
			id: movementId,
			shiftId: input.shiftId,
			type: input.type,
			paymentMethod,
			amount,
			description,
			createdAt: createdAt.getTime(),
		};
	},
);

export const closeSummary = orgRequiredProcedure.closeSummary.handler(
	async ({ input, context }) => {
		const { organizationId } = context;
		const shiftId = input.shiftId;

		const [targetShift, organizationRow] = await Promise.all([
			context.db
				.select({
					id: shift.id,
					status: shift.status,
					startingCash: shift.startingCash,
					openedAt: shift.openedAt,
					closedAt: shift.closedAt,
				})
				.from(shift)
				.where(
					and(eq(shift.id, shiftId), eq(shift.organizationId, organizationId)),
				)
				.limit(1)
				.then((rows) => rows[0]),
			context.db
				.select({
					metadata: organization.metadata,
				})
				.from(organization)
				.where(eq(organization.id, organizationId))
				.limit(1)
				.then((rows) => rows[0]),
		]);

		if (!targetShift) {
			throw new ORPCError("NOT_FOUND", {
				message: "Turno no encontrado para la organización activa",
			});
		}

		const organizationSettings = parseOrganizationSettingsMetadata(
			organizationRow?.metadata,
		);

		const [registeredPayments, registeredMovements, registeredClosures] =
			await Promise.all([
				context.db
					.select({
						method: payment.method,
						amount: payment.amount,
						saleId: payment.saleId,
						saleTotalAmount: sale.totalAmount,
					})
					.from(payment)
					.leftJoin(sale, eq(sale.id, payment.saleId))
					.where(
						and(
							eq(payment.organizationId, organizationId),
							eq(payment.shiftId, shiftId),
							or(isNull(payment.saleId), ne(sale.status, "cancelled")),
						),
					),
				context.db
					.select({
						type: cashMovementTable.type,
						paymentMethod: cashMovementTable.paymentMethod,
						amount: cashMovementTable.amount,
						description: cashMovementTable.description,
						createdAt: cashMovementTable.createdAt,
					})
					.from(cashMovementTable)
					.where(
						and(
							eq(cashMovementTable.organizationId, organizationId),
							eq(cashMovementTable.shiftId, shiftId),
						),
					)
					.orderBy(desc(cashMovementTable.createdAt)),
				context.db
					.select({
						paymentMethod: shiftClosure.paymentMethod,
						expectedAmount: shiftClosure.expectedAmount,
						actualAmount: shiftClosure.actualAmount,
						difference: shiftClosure.difference,
					})
					.from(shiftClosure)
					.where(eq(shiftClosure.shiftId, shiftId)),
			]);

		const expectedByMethod = buildExpectedAmountsByMethod(
			targetShift.startingCash,
			registeredPayments,
			registeredMovements,
		);
		const movementTotals = {
			inflow: 0,
			expense: 0,
			payout: 0,
		};
		const movementItems = registeredMovements.map((movement) => {
			const normalizedAmount = normalizeNumber(movement.amount);
			switch (movement.type) {
				case "inflow":
					movementTotals.inflow += normalizedAmount;
					break;
				case "expense":
					movementTotals.expense += normalizedAmount;
					break;
				case "payout":
					movementTotals.payout += normalizedAmount;
					break;
			}

			return {
				type: movement.type,
				paymentMethod: movement.paymentMethod,
				amount: normalizedAmount,
				description: movement.description,
				createdAt: toTimestamp(movement.createdAt) ?? 0,
			};
		});
		const closureByMethod = new Map(
			registeredClosures.map((closure) => [closure.paymentMethod, closure]),
		);

		const summaryByMethod = [...expectedByMethod.entries()]
			.sort(([methodA], [methodB]) =>
				comparePaymentMethodIds(methodA, methodB),
			)
			.map(([paymentMethod, expectedAmount]) => {
				const closure = closureByMethod.get(paymentMethod);
				return {
					paymentMethod,
					expectedAmount,
					actualAmount: closure?.actualAmount ?? null,
					difference: closure?.difference ?? null,
				};
			});

		const totalExpected = summaryByMethod.reduce(
			(total, current) => total + current.expectedAmount,
			0,
		);

		return {
			shift: {
				id: targetShift.id,
				status: targetShift.status,
				startingCash: targetShift.startingCash,
				openedAt: toTimestamp(targetShift.openedAt),
				closedAt: toTimestamp(targetShift.closedAt),
			},
			summaryByMethod,
			totalExpected,
			paymentMethods: buildPaymentMethodOptions(
				getAllPaymentMethods(organizationSettings),
				[
					...summaryByMethod.map((row) => row.paymentMethod),
					...movementItems.map((m) => m.paymentMethod),
					...registeredClosures.map((c) => c.paymentMethod),
				],
			),
			movements: {
				items: movementItems,
				totals: {
					...movementTotals,
					net:
						movementTotals.inflow -
						movementTotals.expense -
						movementTotals.payout,
				},
			},
			registeredClosures,
		};
	},
);

export const close = orgRequiredProcedure.close.handler(
	async ({ input, context }) => {
		const { organizationId, user } = context;
		const closedAt = resolveDate(input.closedAt);
		const notes = normalizeOptionalString(input.notes);
		const actualByMethod = new Map<string, number>();

		for (const closure of input.closures) {
			const paymentMethod = normalizeRequiredString(
				closure.paymentMethod,
				"paymentMethod",
			).toLowerCase();
			if (actualByMethod.has(paymentMethod)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Método de pago duplicado en cierre: ${paymentMethod}`,
				});
			}

			actualByMethod.set(
				paymentMethod,
				toNonNegativeInteger(
					closure.actualAmount,
					`actualAmount (${paymentMethod})`,
				),
			);
		}

		return context.db.transaction(async (tx) => {
			const [targetShift] = await tx
				.select({
					id: shift.id,
					status: shift.status,
					userId: shift.userId,
					startingCash: shift.startingCash,
					notes: shift.notes,
				})
				.from(shift)
				.where(
					and(
						eq(shift.id, input.shiftId),
						eq(shift.organizationId, organizationId),
					),
				)
				.limit(1);

			if (!targetShift) {
				throw new ORPCError("NOT_FOUND", {
					message: "Turno no encontrado para la organización activa",
				});
			}
			if (targetShift.status !== "open") {
				throw new ORPCError("BAD_REQUEST", {
					message: "El turno ya está cerrado",
				});
			}
			if (targetShift.userId !== user.id) {
				throw new ORPCError("FORBIDDEN", {
					message: "Solo el cajero del turno puede cerrar caja",
				});
			}

			const [existingClosure] = await tx
				.select({ id: shiftClosure.id })
				.from(shiftClosure)
				.where(eq(shiftClosure.shiftId, input.shiftId))
				.limit(1);

			if (existingClosure) {
				throw new ORPCError("CONFLICT", {
					message: "El turno ya cuenta con un cierre registrado",
				});
			}

			const [registeredPayments, registeredMovements] = await Promise.all([
				tx
					.select({
						method: payment.method,
						amount: payment.amount,
						saleId: payment.saleId,
						saleTotalAmount: sale.totalAmount,
					})
					.from(payment)
					.leftJoin(sale, eq(sale.id, payment.saleId))
					.where(
						and(
							eq(payment.organizationId, organizationId),
							eq(payment.shiftId, input.shiftId),
							or(isNull(payment.saleId), ne(sale.status, "cancelled")),
						),
					),
				tx
					.select({
						type: cashMovementTable.type,
						paymentMethod: cashMovementTable.paymentMethod,
						amount: cashMovementTable.amount,
					})
					.from(cashMovementTable)
					.where(
						and(
							eq(cashMovementTable.organizationId, organizationId),
							eq(cashMovementTable.shiftId, input.shiftId),
						),
					),
			]);

			const expectedByMethod = buildExpectedAmountsByMethod(
				targetShift.startingCash,
				registeredPayments,
				registeredMovements,
			);

			const allMethods = new Set<string>([
				...expectedByMethod.keys(),
				...actualByMethod.keys(),
			]);
			if (allMethods.size === 0) {
				allMethods.add("cash");
			}

			const closureRows = [...allMethods].map((paymentMethod) => {
				const expectedAmount = expectedByMethod.get(paymentMethod) ?? 0;
				const actualAmount = actualByMethod.get(paymentMethod) ?? 0;
				return {
					id: crypto.randomUUID(),
					shiftId: input.shiftId,
					paymentMethod,
					expectedAmount,
					actualAmount,
					difference: actualAmount - expectedAmount,
				};
			});

			await tx.insert(shiftClosure).values(closureRows);
			await tx
				.update(shift)
				.set({
					status: "closed",
					closedAt,
					notes: notes ?? targetShift.notes,
				})
				.where(eq(shift.id, input.shiftId));

			return {
				shiftId: input.shiftId,
				closedAt: closedAt.getTime(),
				closures: closureRows,
			};
		});
	},
);
