import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { implement, ORPCError } from "@orpc/server";
import { organization } from "../../../database/drizzle/schema/auth.schema";
import {
	category,
	product,
} from "../../../database/drizzle/schema/inventory.schema";
import { shift } from "../../../database/drizzle/schema/pos.schema";
import { dbSqlite } from "../../../database/drizzle/db";
import type { AppContext } from "../context";
import {
	getEnabledPaymentMethods,
	parseOrganizationSettingsMetadata,
} from "../../../features/settings/settings.shared";
import { posContract } from "../contracts/pos";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const posImplementer = implement(posContract).$context<AppContext>();

const orgRequiredProcedure = posImplementer
	.use(dbMiddleware)
	.use(authMiddleware)
	.use(requireOrgMiddleware);

function normalizeLimit(limit?: number | null) {
	return Math.min(Math.max(limit ?? 50, 1), 100);
}

function normalizeCursor(cursor?: number | null) {
	return Math.max(cursor ?? 0, 0);
}

function normalizeSearchQuery(searchQuery?: string | null) {
	return searchQuery?.trim().toLowerCase() ?? "";
}

function normalizeCount(value: unknown) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === "string") {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : 0;
	}
	return 0;
}

function toTimestamp(value: Date | number | string | null | undefined) {
	if (!value) return null;
	if (value instanceof Date) return value.getTime();
	if (typeof value === "number") return value;
	const dateValue = new Date(value);
	return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

export const bootstrap = orgRequiredProcedure.bootstrap.handler(
	async ({ context }) => {
		const organizationId = context.organizationId;

		const [activeShiftRows, categories, modifierProducts, organizationRows] =
			await Promise.all([
				context.db
					.select({
						id: shift.id,
						terminalId: shift.terminalId,
						terminalName: shift.terminalName,
						status: shift.status,
						startingCash: shift.startingCash,
						openedAt: shift.openedAt,
						closedAt: shift.closedAt,
						notes: shift.notes,
					})
					.from(shift)
					.where(
						and(
							eq(shift.organizationId, organizationId),
							eq(shift.userId, context.user.id),
							eq(shift.status, "open"),
						),
					)
					.orderBy(desc(shift.openedAt))
					.limit(1),
				context.db
					.select({
						id: category.id,
						name: category.name,
						description: category.description,
					})
					.from(category)
					.where(eq(category.organizationId, organizationId))
					.orderBy(asc(category.name)),
				context.db
					.select({
						id: product.id,
						name: product.name,
						categoryId: product.categoryId,
						categoryName: category.name,
						sku: product.sku,
						barcode: product.barcode,
						price: product.price,
						taxRate: product.taxRate,
						trackInventory: product.trackInventory,
						stock: product.stock,
						isModifier: product.isModifier,
						isFavorite: product.isFavorite,
					})
					.from(product)
					.leftJoin(
						category,
						and(
							eq(product.categoryId, category.id),
							eq(category.organizationId, organizationId),
						),
					)
					.where(
						and(
							eq(product.organizationId, organizationId),
							eq(product.isModifier, true),
							isNull(product.deletedAt),
						),
					)
					.orderBy(asc(product.name)),
				context.db
					.select({
						metadata: organization.metadata,
					})
					.from(organization)
					.where(eq(organization.id, organizationId))
					.limit(1),
			]);

		const activeShift = activeShiftRows[0] ?? null;
		const organizationSettings = parseOrganizationSettingsMetadata(
			organizationRows[0]?.metadata,
		);
		const paymentMethods = getEnabledPaymentMethods(organizationSettings).map(
			(paymentMethod) => ({
				id: paymentMethod.id,
				label: paymentMethod.label,
				requiresReference: paymentMethod.requiresReference,
			}),
		);

		return {
			activeShift: activeShift
				? {
						...activeShift,
						openedAt: toTimestamp(activeShift.openedAt),
						closedAt: toTimestamp(activeShift.closedAt),
					}
				: null,
			categories,
			modifierProducts: modifierProducts.map((product) => ({
				...product,
				categoryName: product.categoryName ?? "Sin categoría",
			})),
			settings: {
				defaultTerminalName: organizationSettings.pos.defaultTerminalName,
				defaultStartingCash: organizationSettings.pos.defaultStartingCash,
				paymentMethods,
				allowCreditSales: organizationSettings.credit.allowCreditSales,
			},
		};
	},
);

export const searchProducts = orgRequiredProcedure.searchProducts.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;
		const limit = normalizeLimit(input.limit);
		const cursor = normalizeCursor(input.cursor);
		const normalizedSearch = normalizeSearchQuery(input.searchQuery);
		const normalizedCategoryId = input.categoryId?.trim() ?? "";
		const searchPattern = `%${normalizedSearch}%`;
		const searchRank = normalizedSearch
			? sql<number>`case
				when lower(coalesce(${product.barcode}, '')) = ${normalizedSearch} then 0
				when lower(coalesce(${product.sku}, '')) = ${normalizedSearch} then 1
				when lower(${product.name}) = ${normalizedSearch} then 2
				else 3
			end`
			: null;
		const productOrderBy = searchRank
			? [
					sql`case when ${product.isFavorite} = 1 then 0 else 1 end`,
					asc(searchRank),
					asc(product.name),
					asc(product.id),
				]
			: [
					sql`case when ${product.isFavorite} = 1 then 0 else 1 end`,
					asc(product.name),
					asc(product.id),
				];

		const clauses = [
			eq(product.organizationId, organizationId),
			isNull(product.deletedAt),
			eq(product.isModifier, false),
		];
		if (normalizedCategoryId) {
			clauses.push(eq(product.categoryId, normalizedCategoryId));
		}
		if (normalizedSearch) {
			clauses.push(
				sql`(lower(${product.name}) LIKE ${searchPattern} OR lower(${product.sku}) LIKE ${searchPattern} OR lower(${product.barcode}) LIKE ${searchPattern})`,
			);
		}

		const [rows, totalRows] = await Promise.all([
			context.db
				.select({
					id: product.id,
					name: product.name,
					categoryId: product.categoryId,
					categoryName: category.name,
					sku: product.sku,
					barcode: product.barcode,
					price: product.price,
					taxRate: product.taxRate,
					trackInventory: product.trackInventory,
					stock: product.stock,
					isModifier: product.isModifier,
					isFavorite: product.isFavorite,
				})
				.from(product)
				.leftJoin(
					category,
					and(
						eq(product.categoryId, category.id),
						eq(category.organizationId, organizationId),
					),
				)
				.where(and(...clauses))
				.orderBy(...productOrderBy)
				.limit(limit + 1)
				.offset(cursor),
			context.db
				.select({
					total: sql<number>`count(*)`,
				})
				.from(product)
				.where(and(...clauses)),
		]);

		return {
			data: rows.slice(0, limit).map((row) => ({
				...row,
				categoryName: row.categoryName ?? "Sin categoría",
			})),
			hasMore: rows.length > limit,
			total: normalizeCount(totalRows[0]?.total),
			nextCursor: rows.length > limit ? cursor + limit : null,
		};
	},
);

export const toggleFavorite = orgRequiredProcedure.toggleFavorite.handler(
	async ({ input, context }) => {
		const organizationId = context.organizationId;

		const [targetProduct] = await context.db
			.select({
				id: product.id,
				isFavorite: product.isFavorite,
			})
			.from(product)
			.where(
				and(
					eq(product.id, input.productId),
					eq(product.organizationId, organizationId),
					isNull(product.deletedAt),
				),
			)
			.limit(1);

		if (!targetProduct) {
			throw new ORPCError("NOT_FOUND", {
				message: "Producto no encontrado",
			});
		}

		const newIsFavorite = !targetProduct.isFavorite;

		await context.db
			.update(product)
			.set({ isFavorite: newIsFavorite })
			.where(
				and(
					eq(product.id, input.productId),
					eq(product.organizationId, organizationId),
					isNull(product.deletedAt),
				),
			);

		return { success: true, isFavorite: newIsFavorite };
	},
);
