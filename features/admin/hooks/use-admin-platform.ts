import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type {
  AdminModuleStateSchema,
  AdminOrganizationDetailSchema,
  AdminOrganizationsResponseSchema,
  AdminPlatformOverviewSchema,
  AdminSetOrganizationModuleSchema,
} from "@/features/admin/admin.schema";
import { ADMIN_QUERY_ROOT_KEY } from "./use-admin-users";

export type AdminPlatformOverview = z.infer<typeof AdminPlatformOverviewSchema>;
export type AdminOrganizationsResponse = z.infer<
  typeof AdminOrganizationsResponseSchema
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

function getBrowserTimeZone() {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

async function fetchAdminJson<T>(
  path: string,
  fallbackMessage: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });

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

export function useAdminOverviewQuery() {
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "platform-overview", timeZone],
    queryFn: () =>
      fetchAdminJson<AdminPlatformOverview>(
        `/api/admin/overview?tz=${encodeURIComponent(timeZone)}`,
        "No se pudo cargar el resumen de la plataforma."
      ),
  });
}

export function useAdminOrganizationsQuery() {
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "organizations", timeZone],
    queryFn: () =>
      fetchAdminJson<AdminOrganizationsResponse>(
        `/api/admin/organizations?tz=${encodeURIComponent(timeZone)}`,
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
