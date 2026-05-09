import type { TestDb } from "./test-db";
import {
	organization,
	user,
	member,
} from "../../database/drizzle/schema/auth.schema";
import {
	category,
	product,
} from "../../database/drizzle/schema/inventory.schema";
import {
	customer,
} from "../../database/drizzle/schema/customer.schema";
import {
	shift,
} from "../../database/drizzle/schema/pos.schema";

export interface SeedOrganizationResult {
	organizationId: string;
	userId: string;
	memberId: string;
}

export async function seedOrganizationWithMember(
	db: TestDb,
	opts?: {
		orgName?: string;
		orgSlug?: string;
		userName?: string;
		userEmail?: string;
		userRole?: string;
		memberRole?: string;
	},
): Promise<SeedOrganizationResult> {
	const organizationId = crypto.randomUUID();
	const userId = crypto.randomUUID();
	const memberId = crypto.randomUUID();
	const now = new Date();

	await db.insert(user).values({
		id: userId,
		name: opts?.userName ?? "Test User",
		email: opts?.userEmail ?? `test-${userId.slice(0, 8)}@example.com`,
		emailVerified: true,
		createdAt: now,
		updatedAt: now,
		role: opts?.userRole ?? "user",
		banned: false,
	});

	await db.insert(organization).values({
		id: organizationId,
		name: opts?.orgName ?? "Test Organization",
		slug: opts?.orgSlug ?? `test-org-${organizationId.slice(0, 8)}`,
		createdAt: now,
	});

	await db.insert(member).values({
		id: memberId,
		organizationId,
		userId,
		role: opts?.memberRole ?? "owner",
		createdAt: now,
	});

	return { organizationId, userId, memberId };
}

export async function seedCategory(
	db: TestDb,
	opts: {
		organizationId: string;
		name?: string;
		description?: string;
	},
) {
	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(category).values({
		id,
		organizationId: opts.organizationId,
		name: opts.name ?? "Test Category",
		description: opts.description ?? null,
		createdAt: now,
	});

	return id;
}

export async function seedProduct(
	db: TestDb,
	opts: {
		organizationId: string;
		categoryId?: string | null;
		name?: string;
		sku?: string | null;
		barcode?: string | null;
		price?: number;
		cost?: number;
		taxRate?: number;
		isModifier?: boolean;
		trackInventory?: boolean;
		stock?: number;
		isFavorite?: boolean;
		deletedAt?: Date | null;
	},
) {
	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(product).values({
		id,
		organizationId: opts.organizationId,
		categoryId: opts.categoryId ?? null,
		name: opts.name ?? "Test Product",
		sku: opts.sku ?? null,
		barcode: opts.barcode ?? null,
		price: opts.price ?? 10000,
		cost: opts.cost ?? 0,
		taxRate: opts.taxRate ?? 0,
		isModifier: opts.isModifier ?? false,
		trackInventory: opts.trackInventory ?? true,
		stock: opts.stock ?? 100,
		isFavorite: opts.isFavorite ?? false,
		deletedAt: opts.deletedAt ?? null,
		createdAt: now,
	});

	return id;
}

export async function seedCustomer(
	db: TestDb,
	opts: {
		organizationId: string;
		name?: string;
		documentNumber?: string;
		phone?: string;
		email?: string;
		deletedAt?: Date | null;
	},
) {
	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(customer).values({
		id,
		organizationId: opts.organizationId,
		type: "natural",
		name: opts.name ?? "Test Customer",
		documentNumber: opts.documentNumber ?? null,
		phone: opts.phone ?? null,
		email: opts.email ?? null,
		createdAt: now,
		updatedAt: now,
		deletedAt: opts.deletedAt ?? null,
	});

	return id;
}

export async function seedShift(
	db: TestDb,
	opts: {
		organizationId: string;
		userId: string;
		status?: "open" | "closed";
		startingCash?: number;
		openedAt?: Date;
		closedAt?: Date | null;
		terminalId?: string;
		terminalName?: string;
	},
) {
	const id = crypto.randomUUID();
	const now = opts?.openedAt ?? new Date();

	await db.insert(shift).values({
		id,
		organizationId: opts.organizationId,
		userId: opts.userId,
		terminalId: opts.terminalId ?? null,
		terminalName: opts.terminalName ?? null,
		status: opts.status ?? "open",
		startingCash: opts.startingCash ?? 0,
		openedAt: now,
		closedAt: opts.closedAt ?? null,
		notes: null,
	});

	return id;
}
