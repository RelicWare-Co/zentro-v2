import {
  invitation,
  member,
  organization,
  organizationJoinLink,
  user,
} from "@/database/drizzle/schema/auth.schema";
import { customer } from "@/database/drizzle/schema/customer.schema";
import { category, product } from "@/database/drizzle/schema/inventory.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import {
  restaurantArea,
  restaurantTable,
} from "@/database/drizzle/schema/restaurant.schema";
import type { TestDb } from "./test-db";

export function makeUser(overrides?: Partial<typeof user.$inferInsert>) {
  const id = overrides?.id ?? crypto.randomUUID();
  const now = new Date();
  return {
    id,
    name: overrides?.name ?? "Test User",
    email: overrides?.email ?? `test-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
    role: overrides?.role ?? "user",
    banned: false,
    banReason: null,
    banExpires: null,
  };
}

export async function seedUser(
  db: TestDb,
  overrides?: Partial<typeof user.$inferInsert>
) {
  const u = makeUser(overrides);
  await db.insert(user).values(u);
  return u;
}

export interface SeedOrganizationResult {
  memberId: string;
  organizationId: string;
  userId: string;
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
  }
): Promise<SeedOrganizationResult> {
  const organizationId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();

  await Promise.all([
    db.insert(user).values({
      id: userId,
      name: opts?.userName ?? "Test User",
      email: opts?.userEmail ?? `test-${userId.slice(0, 8)}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      role: opts?.userRole ?? "user",
      banned: false,
    }),
    db.insert(organization).values({
      id: organizationId,
      name: opts?.orgName ?? "Test Organization",
      slug: opts?.orgSlug ?? `test-org-${organizationId.slice(0, 8)}`,
      createdAt: now,
    }),
  ]);

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
  }
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
    accountingTreatment?: string;
    autoPayoutEnabled?: boolean;
    autoPayoutPaymentMethod?: string;
    deletedAt?: Date | null;
  }
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
    price: opts.price ?? 10_000,
    cost: opts.cost ?? 0,
    taxRate: opts.taxRate ?? 0,
    isModifier: opts.isModifier ?? false,
    trackInventory: opts.trackInventory ?? true,
    stock: opts.stock ?? 100,
    isFavorite: opts.isFavorite ?? false,
    accountingTreatment: opts.accountingTreatment ?? "revenue",
    autoPayoutEnabled: opts.autoPayoutEnabled ?? false,
    autoPayoutPaymentMethod: opts.autoPayoutPaymentMethod ?? "cash",
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
  }
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

export async function seedInvitation(
  db: TestDb,
  opts: {
    organizationId: string;
    inviterId: string;
    email: string;
    role?: string;
    status?: string;
    expiresAt?: Date;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(invitation).values({
    id,
    organizationId: opts.organizationId,
    inviterId: opts.inviterId,
    email: opts.email,
    role: opts.role ?? "member",
    status: opts.status ?? "pending",
    expiresAt:
      opts.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });
  return id;
}

export async function seedJoinLink(
  db: TestDb,
  opts: {
    organizationId: string;
    token: string;
    createdByUserId: string;
    role?: string;
    label?: string | null;
    expiresAt?: Date;
    revokedAt?: Date | null;
    maxUses?: number;
    useCount?: number;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(organizationJoinLink).values({
    id,
    organizationId: opts.organizationId,
    token: opts.token,
    role: opts.role ?? "member",
    label: opts.label ?? null,
    createdByUserId: opts.createdByUserId,
    createdAt: now,
    expiresAt:
      opts.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    maxUses: opts.maxUses ?? 1,
    useCount: opts.useCount ?? 0,
    lastUsedAt: null,
    lastUsedByUserId: null,
    revokedAt: opts.revokedAt ?? null,
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
  }
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

export async function seedRestaurantArea(
  db: TestDb,
  opts: {
    organizationId: string;
    name?: string;
    sortOrder?: number;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(restaurantArea).values({
    id,
    organizationId: opts.organizationId,
    name: opts.name ?? "Main Area",
    sortOrder: opts.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function seedRestaurantTable(
  db: TestDb,
  opts: {
    organizationId: string;
    areaId: string;
    name?: string;
    seats?: number;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(restaurantTable).values({
    id,
    organizationId: opts.organizationId,
    areaId: opts.areaId,
    name: opts.name ?? "Table 1",
    seats: opts.seats ?? 4,
    sortOrder: opts.sortOrder ?? 0,
    isActive: opts.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}
