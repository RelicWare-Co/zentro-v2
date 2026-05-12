import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import type { dbSqlite } from "../../database/drizzle/db";
import {
	creditAccount,
	creditTransaction,
} from "../../database/drizzle/schema/credit.schema";
import { customer } from "../../database/drizzle/schema/customer.schema";
import {
	inventoryMovement,
	product,
} from "../../database/drizzle/schema/inventory.schema";
import { organization } from "../../database/drizzle/schema/auth.schema";
import { shift } from "../../database/drizzle/schema/pos.schema";
import {
	payment,
	sale,
	saleItem,
	saleItemModifier,
} from "../../database/drizzle/schema/sales.schema";
import {
	getEnabledPaymentMethods,
	parseOrganizationSettingsMetadata,
} from "../../features/settings/settings.shared";
import type { CreateSaleInputSchema } from "../../schemas/sales";
import type { z } from "zod";

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
	return new Date(toNonNegativeInteger(input, "createdAt"));
}

function canSettleCompletedSaleWithCashChange(
	payments: Array<{ method: string; amount: number }>,
	totalAmount: number,
) {
	const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
	if (paidAmount <= totalAmount) {
		return false;
	}
	const hasCashPayment = payments.some(
		(payment) => payment.method === "cash" && payment.amount > 0,
	);
	if (!hasCashPayment) {
		return false;
	}
	const nonCashPaid = payments.reduce(
		(sum, payment) => (payment.method === "cash" ? sum : sum + payment.amount),
		0,
	);
	return nonCashPaid <= totalAmount;
}

export type CreateSaleInput = z.infer<typeof CreateSaleInputSchema>;

export async function createCoreSale(
	input: CreateSaleInput,
	ctx: {
		db: ReturnType<typeof dbSqlite>;
		organizationId: string;
		userId: string;
	},
) {
	const { db: txCtx, organizationId, userId } = ctx;

	if (!Array.isArray(input.items) || input.items.length === 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "La venta debe incluir al menos un ítem",
		});
	}

	const createdAt = resolveDate(input.createdAt);
	const customerId = normalizeOptionalString(input.customerId);
	const saleLevelDiscount = toNonNegativeInteger(
		input.discountAmount ?? 0,
		"discountAmount",
	);
	const isCreditSale = input.isCreditSale ?? false;

	return txCtx.transaction(async (tx) => {
		const [targetShift] = await tx
			.select({ id: shift.id, status: shift.status, userId: shift.userId })
			.from(shift)
			.where(
				and(
					eq(shift.id, input.shiftId),
					eq(shift.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!targetShift) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Turno no encontrado para la organización activa",
			});
		}
		if (targetShift.status !== "open") {
			throw new ORPCError("BAD_REQUEST", {
				message: "No se puede registrar una venta en un turno cerrado",
			});
		}
		if (targetShift.userId !== userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Solo el cajero del turno puede registrar ventas",
			});
		}

		const [organizationRow] = await tx
			.select({ metadata: organization.metadata })
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);
		const enabledPaymentMethodIds = new Set(
			getEnabledPaymentMethods(
				parseOrganizationSettingsMetadata(organizationRow?.metadata),
			).map((pm) => pm.id),
		);

		if (customerId) {
			const [existingCustomer] = await tx
				.select({ id: customer.id })
				.from(customer)
				.where(
					and(
						eq(customer.id, customerId),
						eq(customer.organizationId, organizationId),
						isNull(customer.deletedAt),
					),
				)
				.limit(1);
			if (!existingCustomer) {
				throw new ORPCError("BAD_REQUEST", {
					message: "El cliente seleccionado no existe o está inactivo",
				});
			}
		}

		const referencedProductIds = new Set<string>();
		for (const item of input.items) {
			referencedProductIds.add(item.productId);
			for (const modifier of item.modifiers ?? []) {
				referencedProductIds.add(modifier.modifierProductId);
			}
		}

		const referencedIds = [...referencedProductIds];
		if (referencedIds.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No hay productos válidos para procesar",
			});
		}

		const productRows = await tx
			.select({
				id: product.id,
				name: product.name,
				price: product.price,
				taxRate: product.taxRate,
				isModifier: product.isModifier,
				trackInventory: product.trackInventory,
				stock: product.stock,
			})
			.from(product)
			.where(
				and(
					eq(product.organizationId, organizationId),
					isNull(product.deletedAt),
					inArray(product.id, referencedIds),
				),
			);

		const productById = new Map(productRows.map((row) => [row.id, row]));
		for (const productId of referencedIds) {
			if (!productById.has(productId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Producto no encontrado o inactivo en la organización actual: ${productId}`,
				});
			}
		}

		type PreparedModifier = {
			id: string;
			saleItemId: string;
			modifierProductId: string;
			quantity: number;
			unitPrice: number;
			subtotal: number;
			totalQuantitySold: number;
		};

		type PreparedItem = {
			id: string;
			productId: string;
			quantity: number;
			unitPrice: number;
			subtotal: number;
			taxRate: number;
			taxAmount: number;
			discountAmount: number;
			totalAmount: number;
			modifiers: PreparedModifier[];
		};

		const stockDeltas = new Map<string, number>();
		const addStockDelta = (productId: string, delta: number) => {
			stockDeltas.set(productId, (stockDeltas.get(productId) ?? 0) + delta);
		};

		const preparedItems: PreparedItem[] = [];
		let subtotal = 0;
		let taxAmount = 0;
		let itemDiscountAmount = 0;

		for (let itemIndex = 0; itemIndex < input.items.length; itemIndex += 1) {
			const item = input.items[itemIndex];
			const baseProduct = productById.get(item.productId);

			if (!baseProduct) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Producto inválido en ítem ${itemIndex + 1}`,
				});
			}
			if (baseProduct.isModifier) {
				throw new ORPCError("BAD_REQUEST", {
					message: `El producto ${baseProduct.name} solo puede venderse como modificador`,
				});
			}

			const quantity = toPositiveInteger(
				item.quantity,
				`items[${itemIndex}].quantity`,
			);
			const unitPrice = toNonNegativeInteger(
				item.unitPrice ?? baseProduct.price,
				`items[${itemIndex}].unitPrice`,
			);
			const lineTaxRate = toNonNegativeInteger(
				item.taxRate ?? baseProduct.taxRate,
				`items[${itemIndex}].taxRate`,
			);
			const lineDiscountAmount = toNonNegativeInteger(
				item.discountAmount ?? 0,
				`items[${itemIndex}].discountAmount`,
			);

			const lineSubtotal = quantity * unitPrice;
			const lineTaxAmount = Math.round((lineSubtotal * lineTaxRate) / 100);
			let modifiersSubtotal = 0;

			const saleItemId = crypto.randomUUID();
			const preparedModifiers: PreparedModifier[] = [];
			for (
				let modifierIndex = 0;
				modifierIndex < (item.modifiers ?? []).length;
				modifierIndex += 1
			) {
				const modifier = item.modifiers?.[modifierIndex];
				if (!modifier) continue;

				const modifierProduct = productById.get(modifier.modifierProductId);
				if (!modifierProduct) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Modificador inválido en items[${itemIndex}].modifiers[${modifierIndex}]`,
					});
				}
				if (!modifierProduct.isModifier) {
					throw new ORPCError("BAD_REQUEST", {
						message: `El producto ${modifierProduct.name} no está configurado como modificador`,
					});
				}

				const modifierQuantity = toPositiveInteger(
					modifier.quantity,
					`items[${itemIndex}].modifiers[${modifierIndex}].quantity`,
				);
				const modifierUnitPrice = toNonNegativeInteger(
					modifier.unitPrice ?? modifierProduct.price,
					`items[${itemIndex}].modifiers[${modifierIndex}].unitPrice`,
				);
				const soldModifierQuantity = quantity * modifierQuantity;
				const modifierSubtotal = soldModifierQuantity * modifierUnitPrice;
				modifiersSubtotal += modifierSubtotal;
				addStockDelta(modifierProduct.id, -soldModifierQuantity);

				preparedModifiers.push({
					id: crypto.randomUUID(),
					saleItemId,
					modifierProductId: modifierProduct.id,
					quantity: modifierQuantity,
					unitPrice: modifierUnitPrice,
					subtotal: modifierSubtotal,
					totalQuantitySold: soldModifierQuantity,
				});
			}

			const lineTotalAmount =
				lineSubtotal + modifiersSubtotal + lineTaxAmount - lineDiscountAmount;
			if (lineTotalAmount < 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `El total del ítem ${itemIndex + 1} no puede ser negativo`,
				});
			}

			preparedItems.push({
				id: saleItemId,
				productId: baseProduct.id,
				quantity,
				unitPrice,
				subtotal: lineSubtotal,
				taxRate: lineTaxRate,
				taxAmount: lineTaxAmount,
				discountAmount: lineDiscountAmount,
				totalAmount: lineTotalAmount,
				modifiers: preparedModifiers,
			});

			addStockDelta(baseProduct.id, -quantity);
			subtotal += lineSubtotal + modifiersSubtotal;
			taxAmount += lineTaxAmount;
			itemDiscountAmount += lineDiscountAmount;
		}

		const discountAmount = itemDiscountAmount + saleLevelDiscount;
		const totalAmount = subtotal + taxAmount - discountAmount;
		if (totalAmount < 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "El total de la venta no puede ser negativo",
			});
		}

		const normalizedPayments = (input.payments ?? []).map(
			(registeredPayment, index) => ({
				method: normalizeRequiredString(
					registeredPayment.method,
					`payments[${index}].method`,
				).toLowerCase(),
				amount: toPositiveInteger(
					registeredPayment.amount,
					`payments[${index}].amount`,
				),
				reference: normalizeOptionalString(registeredPayment.reference),
			}),
		);
		for (const registeredPayment of normalizedPayments) {
			if (!enabledPaymentMethodIds.has(registeredPayment.method)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Método de pago no habilitado: ${registeredPayment.method}`,
				});
			}
		}
		const paidAmount = normalizedPayments.reduce(
			(total, registeredPayment) => total + registeredPayment.amount,
			0,
		);
		const allowsCashChange = canSettleCompletedSaleWithCashChange(
			normalizedPayments,
			totalAmount,
		);

		if (isCreditSale) {
			if (!customerId) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Una venta a crédito requiere seleccionar un cliente registrado",
				});
			}
			if (paidAmount > totalAmount) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Los pagos no pueden superar el total en una venta a crédito",
				});
			}
			if (totalAmount - paidAmount <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"La venta marcada como crédito debe dejar un saldo pendiente por cobrar",
				});
			}
		} else {
			if (totalAmount === 0) {
				if (normalizedPayments.length > 0) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"No debes registrar pagos cuando el total de la venta es 0",
					});
				}
			} else {
				if (normalizedPayments.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Debes registrar al menos un pago para finalizar la venta",
					});
				}
				if (paidAmount !== totalAmount && !allowsCashChange) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"La suma de los pagos debe ser igual al total de la venta, salvo excedente en efectivo para devolver cambio",
					});
				}
			}
		}

		const saleId = crypto.randomUUID();
		const saleStatus = isCreditSale ? "credit" : "completed";

		await tx.insert(sale).values({
			id: saleId,
			organizationId,
			shiftId: input.shiftId,
			customerId,
			userId,
			subtotal,
			taxAmount,
			discountAmount,
			totalAmount,
			status: saleStatus,
			createdAt,
		});

		await tx.insert(saleItem).values(
			preparedItems.map((line) => ({
				id: line.id,
				saleId,
				organizationId,
				productId: line.productId,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				subtotal: line.subtotal,
				taxRate: line.taxRate,
				taxAmount: line.taxAmount,
				discountAmount: line.discountAmount,
				totalAmount: line.totalAmount,
			})),
		);

		const modifierRows = preparedItems.flatMap((line) => line.modifiers);
		if (modifierRows.length > 0) {
			await tx.insert(saleItemModifier).values(
				modifierRows.map((modifierRow) => ({
					id: modifierRow.id,
					saleItemId: modifierRow.saleItemId,
					organizationId,
					modifierProductId: modifierRow.modifierProductId,
					quantity: modifierRow.quantity,
					unitPrice: modifierRow.unitPrice,
					subtotal: modifierRow.subtotal,
				})),
			);
		}

		if (normalizedPayments.length > 0) {
			await tx.insert(payment).values(
				normalizedPayments.map((registeredPayment) => ({
					id: crypto.randomUUID(),
					organizationId,
					saleId,
					shiftId: input.shiftId,
					method: registeredPayment.method,
					reference: registeredPayment.reference,
					amount: registeredPayment.amount,
					createdAt,
				})),
			);
		}

		const entriesToUpdate = [];
		for (const [productId, deltaQuantity] of stockDeltas.entries()) {
			if (deltaQuantity === 0) continue;

			const productRow = productById.get(productId);
			if (!productRow) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Producto no encontrado para inventario: ${productId}`,
				});
			}
			if (!productRow.trackInventory) continue;
			entriesToUpdate.push({ productId, deltaQuantity, productRow });
		}

		const updateResults = await Promise.all(
			entriesToUpdate.map(({ productId, deltaQuantity, productRow }) =>
				tx
					.update(product)
					.set({ stock: sql`${product.stock} + ${deltaQuantity}` })
					.where(
						and(
							eq(product.id, productId),
							eq(product.organizationId, organizationId),
							isNull(product.deletedAt),
						),
					)
					.returning({ id: product.id })
					.then((updatedProducts) => {
						if (updatedProducts.length === 0) {
							throw new ORPCError("BAD_REQUEST", {
								message: `No fue posible actualizar el stock de ${productRow.name}`,
							});
						}
						return { productId, deltaQuantity };
					}),
			),
		);

		const inventoryRows: Array<typeof inventoryMovement.$inferInsert> =
			updateResults.map(({ productId, deltaQuantity }) => ({
				id: crypto.randomUUID(),
				organizationId,
				productId,
				userId,
				type: "sale",
				quantity: deltaQuantity,
				notes: `Venta ${saleId}`,
				createdAt,
			}));

		if (inventoryRows.length > 0) {
			await tx.insert(inventoryMovement).values(inventoryRows);
		}

		const balanceDue = Math.max(totalAmount - paidAmount, 0);
		if (isCreditSale && customerId) {
			const [existingCreditAccount] = await tx
				.select({ id: creditAccount.id, balance: creditAccount.balance })
				.from(creditAccount)
				.where(
					and(
						eq(creditAccount.organizationId, organizationId),
						eq(creditAccount.customerId, customerId),
					),
				)
				.limit(1);

			let creditAccountId = existingCreditAccount?.id;
			if (!existingCreditAccount) {
				creditAccountId = crypto.randomUUID();
				await tx.insert(creditAccount).values({
					id: creditAccountId,
					organizationId,
					customerId,
					balance: balanceDue,
					interestRate: 0,
					createdAt,
					updatedAt: createdAt,
				});
			} else {
				await tx
					.update(creditAccount)
					.set({
						balance: sql`${creditAccount.balance} + ${balanceDue}`,
						updatedAt: createdAt,
					})
					.where(
						and(
							eq(creditAccount.id, existingCreditAccount.id),
							eq(creditAccount.organizationId, organizationId),
						),
					);
			}

			await tx.insert(creditTransaction).values({
				id: crypto.randomUUID(),
				organizationId,
				creditAccountId: creditAccountId!,
				saleId,
				type: "charge",
				amount: balanceDue,
				notes: `Cargo por venta ${saleId}`,
				createdAt,
			});
		}

		return {
			saleId,
			status: saleStatus,
			subtotal,
			taxAmount,
			discountAmount,
			totalAmount,
			paidAmount,
			balanceDue,
		};
	});
}
