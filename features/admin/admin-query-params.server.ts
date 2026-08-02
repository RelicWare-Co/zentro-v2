import type { z } from "zod";
import {
  AdminOptionsQuerySchema,
  AdminOrganizationsQuerySchema,
  AdminOverviewQuerySchema,
  AdminSalesQuerySchema,
  AdminUsersQuerySchema,
} from "@/features/admin/admin.schema";
import {
  parseAdminBoolean,
  parseAdminInteger,
  parseAdminPage,
  parseAdminPageSize,
  parseAdminText,
} from "@/features/admin/admin-filters.shared";
import {
  type ProductImportHistoryQuery,
  ProductImportHistoryQuerySchema,
} from "@/features/product-imports/product-imports.schema";

export class AdminQueryParseError extends Error {}

function text(params: URLSearchParams, key: string) {
  return parseAdminText(params.get(key));
}

function boolean(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") {
    return;
  }
  const parsed = parseAdminBoolean(raw);
  if (parsed === undefined) {
    throw new AdminQueryParseError(`El parámetro ${key} debe ser booleano.`);
  }
  return parsed;
}

function integer(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") {
    return;
  }
  const parsed = parseAdminInteger(raw);
  if (parsed === undefined) {
    throw new AdminQueryParseError(`El parámetro ${key} debe ser entero.`);
  }
  return parsed;
}

function page(params: URLSearchParams) {
  return {
    page: parseAdminPage(params.get("page")),
    pageSize: parseAdminPageSize(params.get("pageSize")),
  };
}

function period(params: URLSearchParams) {
  return {
    period: (text(params, "period") ?? "30d") as "30d" | "custom" | "all",
    startDate: text(params, "startDate"),
    endDate: text(params, "endDate"),
  };
}

function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AdminQueryParseError(
      result.error.issues[0]?.message ??
        "Los filtros de administración no son válidos."
    );
  }
  return result.data;
}

export function parseAdminOptionsQuery(params: URLSearchParams) {
  return parse(AdminOptionsQuerySchema, {
    resource: text(params, "resource"),
    search: text(params, "search") ?? "",
    page: parseAdminPage(params.get("page")),
    pageSize: parseAdminPageSize(params.get("pageSize")),
    selectedIds: params
      .getAll("selectedId")
      .map((value) => value.trim())
      .filter(Boolean),
  });
}

export function parseAdminUsersQuery(params: URLSearchParams) {
  return parse(AdminUsersQuerySchema, {
    ...period(params),
    ...page(params),
    search: text(params, "search") ?? "",
    searchField: text(params, "searchField") ?? "email",
    organizationId: text(params, "organizationId"),
    role: text(params, "role"),
    banned: boolean(params, "banned"),
    emailVerified: boolean(params, "emailVerified"),
    hasSales: boolean(params, "hasSales"),
    paidMin: integer(params, "paidMin"),
    paidMax: integer(params, "paidMax"),
    sortBy: text(params, "sortBy") ?? "createdAt",
    sortDirection: text(params, "sortDirection") ?? "desc",
  });
}

export function parseAdminOrganizationsQuery(params: URLSearchParams) {
  return parse(AdminOrganizationsQuerySchema, {
    ...period(params),
    ...page(params),
    search: text(params, "search") ?? "",
    moduleKey: text(params, "moduleKey"),
    moduleStatus: text(params, "moduleStatus"),
    hasSales: boolean(params, "hasSales"),
    paidMin: integer(params, "paidMin"),
    paidMax: integer(params, "paidMax"),
    sortBy: text(params, "sortBy") ?? "createdAt",
    sortDirection: text(params, "sortDirection") ?? "desc",
  });
}

export function parseAdminSalesQuery(params: URLSearchParams) {
  return parse(AdminSalesQuerySchema, {
    ...period(params),
    ...page(params),
    search: text(params, "search") ?? "",
    organizationId: text(params, "organizationId"),
    sellerId: text(params, "sellerId"),
    terminalName: text(params, "terminalName"),
    status: text(params, "status"),
    paymentMethod: text(params, "paymentMethod"),
    balanceStatus: text(params, "balanceStatus"),
    totalMin: integer(params, "totalMin"),
    totalMax: integer(params, "totalMax"),
    paidMin: integer(params, "paidMin"),
    paidMax: integer(params, "paidMax"),
    sortBy: text(params, "sortBy") ?? "createdAt",
    sortDirection: text(params, "sortDirection") ?? "desc",
  });
}

export function parseAdminOverviewQuery(params: URLSearchParams) {
  return parse(AdminOverviewQuerySchema, {
    ...period(params),
    organizationId: text(params, "organizationId"),
  });
}

export function parseAdminProductImportsQuery(
  params: URLSearchParams
): ProductImportHistoryQuery {
  return parse(ProductImportHistoryQuerySchema, {
    page: parseAdminPage(params.get("page")),
    pageSize: parseAdminPageSize(params.get("pageSize")),
    organizationId: text(params, "organizationId"),
    importerKey: text(params, "importerKey"),
    status: text(params, "status"),
    createdByUserId: text(params, "createdByUserId"),
    search: text(params, "search") ?? "",
    startDate: text(params, "startDate"),
    endDate: text(params, "endDate"),
    totalRowsMin: integer(params, "totalRowsMin"),
    totalRowsMax: integer(params, "totalRowsMax"),
    invalidRowsMin: integer(params, "invalidRowsMin"),
    invalidRowsMax: integer(params, "invalidRowsMax"),
    sortBy: text(params, "sortBy") ?? "createdAt",
    sortDirection: text(params, "sortDirection") ?? "desc",
  });
}
