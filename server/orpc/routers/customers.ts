import { implement, ORPCError } from "@orpc/server";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { dbSqlite } from "../../../database/drizzle/db";
import { customer } from "../../../database/drizzle/schema/customer.schema";
import type { AppContext } from "../context";
import { customersContract } from "../contracts/customers";
import { authMiddleware } from "../middlewares/auth";
import { dbMiddleware } from "../middlewares/db";
import { requireOrgMiddleware } from "../middlewares/require-org";

const customersImplementer =
  implement(customersContract).$context<AppContext>();

const orgRequiredProcedure = customersImplementer
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
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
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
  if (!normalized) {
    throw new ORPCError("BAD_REQUEST", {
      message: `El campo "${fieldName}" es obligatorio`,
    });
  }

  return normalized;
}

async function assertUniqueDocumentNumber(input: {
  db: ReturnType<typeof dbSqlite>;
  organizationId: string;
  documentNumber: string | null;
  excludeCustomerId?: string;
}) {
  if (!input.documentNumber) {
    return;
  }

  const clauses = [
    eq(customer.organizationId, input.organizationId),
    eq(customer.documentNumber, input.documentNumber),
    isNull(customer.deletedAt),
  ];
  if (input.excludeCustomerId) {
    clauses.push(ne(customer.id, input.excludeCustomerId));
  }

  const [existingCustomer] = await input.db
    .select({ id: customer.id })
    .from(customer)
    .where(and(...clauses))
    .limit(1);

  if (existingCustomer) {
    throw new ORPCError("CONFLICT", {
      message: "Ya existe un cliente activo con ese documento",
    });
  }
}

export const search = orgRequiredProcedure.search.handler(
  async ({ input, context }) => {
    const limit = normalizeLimit(input.limit);
    const cursor = normalizeCursor(input.cursor);
    const normalizedSearch = normalizeSearchQuery(input.searchQuery);
    const searchPattern = `%${normalizedSearch}%`;

    const clauses = [
      eq(customer.organizationId, context.organizationId),
      isNull(customer.deletedAt),
    ];
    if (normalizedSearch) {
      clauses.push(
        sql`(
					lower(${customer.name}) LIKE ${searchPattern} OR
					lower(${customer.documentNumber}) LIKE ${searchPattern} OR
					lower(${customer.phone}) LIKE ${searchPattern} OR
					lower(${customer.email}) LIKE ${searchPattern}
				)`
      );
    }

    const [rows, totalRows] = await Promise.all([
      context.db
        .select({
          id: customer.id,
          type: customer.type,
          documentType: customer.documentType,
          documentNumber: customer.documentNumber,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          taxRegime: customer.taxRegime,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        })
        .from(customer)
        .where(and(...clauses))
        .orderBy(asc(customer.name), asc(customer.id))
        .limit(limit + 1)
        .offset(cursor),
      context.db
        .select({
          total: sql<number>`count(*)`,
        })
        .from(customer)
        .where(and(...clauses)),
    ]);

    return {
      data: rows.slice(0, limit).map((row) => ({
        ...row,
        createdAt: toTimestamp(row.createdAt),
        updatedAt: toTimestamp(row.updatedAt),
      })),
      hasMore: rows.length > limit,
      total: normalizeCount(totalRows[0]?.total),
      nextCursor: rows.length > limit ? cursor + limit : null,
    };
  }
);

export const create = orgRequiredProcedure.create.handler(
  async ({ input, context }) => {
    const name = normalizeRequiredString(input.name, "name");
    const normalizedDocumentNumber = normalizeOptionalString(
      input.documentNumber
    );

    await assertUniqueDocumentNumber({
      db: context.db,
      organizationId: context.organizationId,
      documentNumber: normalizedDocumentNumber,
    });

    const id = crypto.randomUUID();
    const now = new Date();
    await context.db.insert(customer).values({
      id,
      organizationId: context.organizationId,
      type: normalizeOptionalString(input.type) ?? "natural",
      documentType: normalizeOptionalString(input.documentType),
      documentNumber: normalizedDocumentNumber,
      name,
      email: normalizeOptionalString(input.email),
      phone: normalizeOptionalString(input.phone),
      address: normalizeOptionalString(input.address),
      city: normalizeOptionalString(input.city),
      taxRegime: normalizeOptionalString(input.taxRegime),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  }
);

export const update = orgRequiredProcedure.update.handler(
  async ({ input, context }) => {
    const updates: Partial<typeof customer.$inferInsert> = {};

    if (input.type !== undefined) {
      updates.type = normalizeOptionalString(input.type) ?? "natural";
    }
    if (input.documentType !== undefined) {
      updates.documentType = normalizeOptionalString(input.documentType);
    }
    if (input.documentNumber !== undefined) {
      updates.documentNumber = normalizeOptionalString(input.documentNumber);
    }
    if (input.name !== undefined) {
      updates.name = normalizeRequiredString(input.name, "name");
    }
    if (input.email !== undefined) {
      updates.email = normalizeOptionalString(input.email);
    }
    if (input.phone !== undefined) {
      updates.phone = normalizeOptionalString(input.phone);
    }
    if (input.address !== undefined) {
      updates.address = normalizeOptionalString(input.address);
    }
    if (input.city !== undefined) {
      updates.city = normalizeOptionalString(input.city);
    }
    if (input.taxRegime !== undefined) {
      updates.taxRegime = normalizeOptionalString(input.taxRegime);
    }

    if (Object.keys(updates).length === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No hay campos para actualizar",
      });
    }

    if (input.documentNumber !== undefined) {
      await assertUniqueDocumentNumber({
        db: context.db,
        organizationId: context.organizationId,
        documentNumber: updates.documentNumber ?? null,
        excludeCustomerId: input.id,
      });
    }

    updates.updatedAt = new Date();
    const updatedCustomers = await context.db
      .update(customer)
      .set(updates)
      .where(
        and(
          eq(customer.id, input.id),
          eq(customer.organizationId, context.organizationId),
          isNull(customer.deletedAt)
        )
      )
      .returning({ id: customer.id });

    if (updatedCustomers.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "El cliente no existe o ya fue eliminado en la organización actual",
      });
    }

    return { success: true };
  }
);

export const deleteCustomer = orgRequiredProcedure.delete.handler(
  async ({ input, context }) => {
    const deletedCustomers = await context.db
      .update(customer)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(customer.id, input.id),
          eq(customer.organizationId, context.organizationId),
          isNull(customer.deletedAt)
        )
      )
      .returning({ id: customer.id });

    if (deletedCustomers.length === 0) {
      throw new ORPCError("NOT_FOUND", {
        message:
          "El cliente no existe o ya fue eliminado en la organización actual",
      });
    }

    return { success: true };
  }
);
