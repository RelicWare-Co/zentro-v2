import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  AdminPanelSession,
  AdminPanelUser,
} from "@/features/admin/admin.shared";
import { authClient } from "@/lib/auth-client";

export const ADMIN_USERS_PAGE_SIZE = 20;

export const ADMIN_QUERY_ROOT_KEY = ["admin"] as const;

export type AdminUsersSearchField = "email" | "name";

export interface AdminUsersListParams {
  page: number;
  searchField: AdminUsersSearchField;
  searchQuery: string;
}

export interface AdminUsersListResult {
  total: number;
  users: AdminPanelUser[];
}

type ListUsersQuery = Parameters<typeof authClient.admin.listUsers>[0]["query"];

async function listUsers(query: ListUsersQuery): Promise<AdminUsersListResult> {
  const { data, error } = await authClient.admin.listUsers({ query });
  if (error) {
    throw new Error(error.message ?? "No se pudo cargar la lista de usuarios.");
  }
  return {
    users: (data?.users ?? []) as AdminPanelUser[],
    total: data?.total ?? 0,
  };
}

export function useAdminUsersQuery(params: AdminUsersListParams) {
  const trimmedSearch = params.searchQuery.trim();

  return useQuery({
    queryKey: [
      ...ADMIN_QUERY_ROOT_KEY,
      "users",
      { page: params.page, search: trimmedSearch, field: params.searchField },
    ],
    queryFn: () =>
      listUsers({
        limit: ADMIN_USERS_PAGE_SIZE,
        offset: (params.page - 1) * ADMIN_USERS_PAGE_SIZE,
        sortBy: "createdAt",
        sortDirection: "desc",
        ...(trimmedSearch
          ? {
              searchValue: trimmedSearch,
              searchField: params.searchField,
              searchOperator: "contains" as const,
            }
          : {}),
      }),
    placeholderData: keepPreviousData,
  });
}

export interface AdminUserStats {
  admins: number;
  banned: number;
  total: number;
}

export function useAdminUserStatsQuery() {
  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "users", "stats"],
    queryFn: async (): Promise<AdminUserStats> => {
      const [allUsers, bannedUsers, adminUsers] = await Promise.all([
        listUsers({ limit: 1 }),
        listUsers({
          limit: 1,
          filterField: "banned",
          filterValue: true,
          filterOperator: "eq",
        }),
        listUsers({
          limit: 1,
          filterField: "role",
          filterValue: "admin",
          filterOperator: "contains",
        }),
      ]);

      return {
        total: allUsers.total,
        banned: bannedUsers.total,
        admins: adminUsers.total,
      };
    },
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
