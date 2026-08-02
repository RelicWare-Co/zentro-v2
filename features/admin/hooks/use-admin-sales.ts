import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import {
  type AdminSaleDetailSchema,
  type AdminSalesQuery,
  AdminSalesQuerySchema,
  type AdminSalesResponseSchema,
} from "@/features/admin/admin.schema";
import { ADMIN_QUERY_ROOT_KEY } from "./use-admin-users";

export type AdminSalesParams = Partial<AdminSalesQuery>;
export type AdminSalesResponse = z.infer<typeof AdminSalesResponseSchema>;
export type AdminSaleDetail = z.infer<typeof AdminSaleDetailSchema>;

const dateTimeFormat = new Intl.DateTimeFormat();
const ADMIN_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getBrowserTimeZone() {
  return dateTimeFormat.resolvedOptions().timeZone;
}

function buildParams(input: AdminSalesQuery, timeZone: string) {
  const params = new URLSearchParams({ tz: timeZone });
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}

async function fetchAdminJson<T>(path: string, fallback: string) {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    let message = fallback;
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // Ignore malformed error responses.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function useAdminSalesQuery(input: AdminSalesParams = {}) {
  const timeZone = getBrowserTimeZone();
  const startDate =
    input.startDate && ADMIN_DATE_KEY_REGEX.test(input.startDate)
      ? input.startDate
      : undefined;
  const endDate =
    input.endDate && ADMIN_DATE_KEY_REGEX.test(input.endDate)
      ? input.endDate
      : undefined;
  const period =
    input.period === "custom" &&
    (!(startDate && endDate) || startDate > endDate)
      ? "30d"
      : input.period;
  const normalized = AdminSalesQuerySchema.parse({
    ...input,
    period,
    startDate: period === "30d" ? undefined : startDate,
    endDate: period === "30d" ? undefined : endDate,
  });
  const params = buildParams(normalized, timeZone);
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "sales", normalized, timeZone],
    queryFn: () =>
      fetchAdminJson<AdminSalesResponse>(
        `/api/admin/sales?${params.toString()}`,
        "No se pudieron cargar las ventas."
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminSaleDetailQuery(saleId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "sale-detail", saleId],
    enabled: Boolean(saleId),
    queryFn: () =>
      fetchAdminJson<AdminSaleDetail>(
        `/api/admin/sales/${encodeURIComponent(saleId ?? "")}`,
        "No se pudo cargar el detalle de la venta."
      ),
  });
}
