import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import {
  type AdminUsersQuery,
  AdminUsersQuerySchema,
  type AdminUsersResponseSchema,
} from "@/features/admin/admin.schema";
import type {
  AdminPanelSession,
  AdminPanelUser,
} from "@/features/admin/admin.shared";

export const ADMIN_USERS_PAGE_SIZE = 20;
export const ADMIN_QUERY_ROOT_KEY = ["admin"] as const;

export type AdminUsersSearchField = "email" | "name";
export type AdminUsersListParams = Omit<AdminUsersQuery, "pageSize"> & {
  pageSize?: number;
};
export type AdminUsersListResult = z.infer<typeof AdminUsersResponseSchema>;

type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;

const dateTimeFormat = new Intl.DateTimeFormat();
const ADMIN_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getBrowserTimeZone() {
  return dateTimeFormat.resolvedOptions().timeZone;
}

async function fetchAdminUsers(params: AdminUsersListParams, timeZone: string) {
  const search = new URLSearchParams({ tz: timeZone });
  const entries: Record<string, string | number | boolean | null | undefined> =
    {
      period: params.period,
      search: params.search,
      searchField: params.searchField,
      organizationId: params.organizationId,
      role: params.role,
      banned: params.banned,
      emailVerified: params.emailVerified,
      hasSales: params.hasSales,
      startDate: params.startDate,
      endDate: params.endDate,
      paidMin: params.paidMin,
      paidMax: params.paidMax,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
      page: params.page,
      pageSize: params.pageSize ?? ADMIN_USERS_PAGE_SIZE,
    };
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const response = await fetch(`/api/admin/users?${search.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    let message = "No se pudo cargar la lista de usuarios.";
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // Ignore malformed error responses.
    }
    throw new Error(message);
  }
  const data = (await response.json()) as AdminUsersResponse;
  return {
    ...data,
    users: data.users as unknown as AdminPanelUser[],
  };
}

export function useAdminUsersQuery(params: AdminUsersListParams) {
  const timeZone = getBrowserTimeZone();
  const startDate =
    params.startDate && ADMIN_DATE_KEY_REGEX.test(params.startDate)
      ? params.startDate
      : undefined;
  const endDate =
    params.endDate && ADMIN_DATE_KEY_REGEX.test(params.endDate)
      ? params.endDate
      : undefined;
  const period =
    params.period === "custom" &&
    (!(startDate && endDate) || startDate > endDate)
      ? "30d"
      : params.period;
  const normalized = AdminUsersQuerySchema.parse({
    ...params,
    period,
    startDate: period === "30d" ? undefined : startDate,
    endDate: period === "30d" ? undefined : endDate,
    search: params.search.trim(),
    pageSize: params.pageSize ?? ADMIN_USERS_PAGE_SIZE,
  });
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "users", normalized, timeZone],
    queryFn: () => fetchAdminUsers(normalized, timeZone),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUserSessionsQuery(userId: string | null) {
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "user-sessions", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AdminPanelSession[]> => {
      if (!userId) {
        return [];
      }
      const { authClient } = await import("@/lib/auth-client");
      const { data, error } = await authClient.admin.listUserSessions({
        userId,
      });
      if (error) {
        throw new Error(
          error.message ?? "No se pudieron cargar las sesiones del usuario."
        );
      }
      return (data?.sessions ?? []) as AdminPanelSession[];
    },
  });
}
