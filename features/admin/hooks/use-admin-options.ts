import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import {
  type AdminOptionsQuery,
  AdminOptionsQuerySchema,
  type AdminOptionsResponseSchema,
} from "@/features/admin/admin.schema";
import { ADMIN_QUERY_ROOT_KEY } from "@/features/admin/hooks/use-admin-users";

export type AdminOptionsResponse = z.infer<typeof AdminOptionsResponseSchema>;

async function fetchAdminOptions(query: AdminOptionsQuery) {
  const params = new URLSearchParams({
    resource: query.resource,
    search: query.search,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  for (const selectedId of query.selectedIds) {
    params.append("selectedId", selectedId);
  }
  const response = await fetch(`/api/admin/options?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) {
    let message = "No se pudieron cargar las opciones.";
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // Ignore malformed error responses.
    }
    throw new Error(message);
  }
  return (await response.json()) as AdminOptionsResponse;
}

export function useAdminOptionsQuery(input: {
  resource: AdminOptionsQuery["resource"];
  search?: string;
  selectedIds?: string[];
  page?: number;
  pageSize?: number;
}) {
  const [debouncedSearch] = useDebouncedValue(input.search?.trim() ?? "", 300);
  const normalized = AdminOptionsQuerySchema.parse({
    resource: input.resource,
    search: debouncedSearch,
    selectedIds: input.selectedIds ?? [],
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 20,
  });

  return useQuery({
    queryKey: [...ADMIN_QUERY_ROOT_KEY, "options", normalized],
    queryFn: () => fetchAdminOptions(normalized),
    placeholderData: keepPreviousData,
  });
}
