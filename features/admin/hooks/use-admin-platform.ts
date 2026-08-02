import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  type AdminModuleStateSchema,
  type AdminOrganizationDetailSchema,
  type AdminOrganizationsQuery,
  AdminOrganizationsQuerySchema,
  type AdminOrganizationsResponseV2Schema,
  type AdminOverviewQuery,
  AdminOverviewQuerySchema,
  type AdminPlatformOverviewSchema,
  type AdminSetOrganizationModuleSchema,
} from "@/features/admin/admin.schema";
import { ADMIN_QUERY_ROOT_KEY } from "./use-admin-users";

export type AdminPlatformOverview = z.infer<typeof AdminPlatformOverviewSchema>;
export type AdminOrganizationsResponse = z.infer<
  typeof AdminOrganizationsResponseV2Schema
>;
export type AdminOrganizationSummary =
  AdminOrganizationsResponse["organizations"][number];
export type AdminOrganizationDetail = z.infer<
  typeof AdminOrganizationDetailSchema
>;
export type AdminModuleState = z.infer<typeof AdminModuleStateSchema>;
export type AdminSetOrganizationModuleInput = z.infer<
  typeof AdminSetOrganizationModuleSchema
> & { organizationId: string };

export type AdminOverviewParams = Partial<AdminOverviewQuery>;
export type AdminOrganizationsParams = Partial<AdminOrganizationsQuery>;

const dateTimeFormat = new Intl.DateTimeFormat();

function getBrowserTimeZone() {
  return dateTimeFormat.resolvedOptions().timeZone;
}

function buildParams(input: Record<string, unknown>, timeZone: string) {
  const params = new URLSearchParams({ tz: timeZone });
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}

async function fetchAdminJson<T>(
  path: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function useAdminOverviewQuery(input: AdminOverviewParams = {}) {
  const timeZone = getBrowserTimeZone();
  const normalized = normalizeAdminOverviewQuery(input);
  const params = buildParams(normalized, timeZone);
  return useQuery({
    queryKey: [
      ...ADMIN_QUERY_ROOT_KEY,
      "platform-overview",
      normalized,
      timeZone,
    ],
    queryFn: () =>
      fetchAdminJson<AdminPlatformOverview>(
        `/api/admin/overview?${params.toString()}`,
        "No se pudo cargar el resumen de la plataforma."
      ),
  });
}

export function useAdminOrganizationsQuery(
  input: AdminOrganizationsParams = {}
) {
  const timeZone = getBrowserTimeZone();
  const normalized = normalizeAdminOrganizationsQuery(input);
  const params = buildParams(normalized, timeZone);
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "organizations", normalized, timeZone],
    queryFn: () =>
      fetchAdminJson<AdminOrganizationsResponse>(
        `/api/admin/organizations?${params.toString()}`,
        "No se pudieron cargar las organizaciones."
      ),
  });
}

export function useAdminOrganizationDetailQuery(organizationId: string | null) {
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: [
      ...ADMIN_QUERY_ROOT_KEY,
      "organization-detail",
      organizationId,
      timeZone,
    ],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fetchAdminJson<AdminOrganizationDetail>(
        `/api/admin/organizations/${encodeURIComponent(
          organizationId ?? ""
        )}?tz=${encodeURIComponent(timeZone)}`,
        "No se pudo cargar el detalle de la organización."
      ),
  });
}

export function useSetOrganizationModuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      moduleKey,
      status,
    }: AdminSetOrganizationModuleInput) =>
      fetchAdminJson<{ modules: AdminModuleState[] }>(
        `/api/admin/organizations/${encodeURIComponent(organizationId)}/modules`,
        "No se pudo actualizar el módulo.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleKey, status }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_ROOT_KEY });
    },
  });
}

const ADMIN_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeIncompleteCustomPeriod<
  T extends {
    period?: "30d" | "custom" | "all";
    startDate?: string | null;
    endDate?: string | null;
  },
>(input: T) {
  const startDate =
    input.startDate && ADMIN_DATE_KEY_REGEX.test(input.startDate)
      ? input.startDate
      : undefined;
  const endDate =
    input.endDate && ADMIN_DATE_KEY_REGEX.test(input.endDate)
      ? input.endDate
      : undefined;
  if (
    input.period === "custom" &&
    (!(startDate && endDate) || startDate > endDate)
  ) {
    return {
      ...input,
      period: "30d" as const,
      startDate: undefined,
      endDate: undefined,
    };
  }
  return { ...input, startDate, endDate };
}

export function normalizeAdminOrganizationsQuery(
  input: Partial<AdminOrganizationsQuery>
) {
  return AdminOrganizationsQuerySchema.parse(
    normalizeIncompleteCustomPeriod(input)
  );
}

export function normalizeAdminOverviewQuery(
  input: Partial<AdminOverviewQuery>
) {
  return AdminOverviewQuerySchema.parse(normalizeIncompleteCustomPeriod(input));
}
