import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_ROOT_KEY } from "@/features/admin/hooks/use-admin-users";
import type {
  ProductImportBatchDetail,
  ProductImporterDescriptor,
  ProductImportHistory,
} from "@/features/product-imports/product-imports.schema";

export const PRODUCT_IMPORT_QUERY_KEY = [
  ...ADMIN_QUERY_ROOT_KEY,
  "product-imports",
] as const;
const CONTENT_DISPOSITION_FILENAME_REGEX = /filename\*=UTF-8''([^;]+)/i;

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson<T>(
  path: string,
  fallback: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  if (!response.ok) {
    throw new Error(await readError(response, fallback));
  }
  return response.json() as Promise<T>;
}

export function useProductImportersQuery() {
  return useQuery({
    queryKey: [...PRODUCT_IMPORT_QUERY_KEY, "importers"],
    queryFn: () =>
      fetchJson<{ importers: ProductImporterDescriptor[] }>(
        "/api/admin/product-imports/importers",
        "No se pudieron cargar los importadores."
      ),
  });
}

export function useProductImportHistoryQuery(
  organizationId: string | null,
  page: number
) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (organizationId) {
    params.set("organizationId", organizationId);
  }
  return useQuery({
    queryKey: [...PRODUCT_IMPORT_QUERY_KEY, "history", organizationId, page],
    queryFn: () =>
      fetchJson<ProductImportHistory>(
        `/api/admin/product-imports?${params}`,
        "No se pudo cargar el historial de importaciones."
      ),
  });
}

export function useProductImportDetailQuery(
  batchId: string | null,
  rowPage: number,
  initialData?: ProductImportBatchDetail
) {
  const params = new URLSearchParams({
    rowPage: String(rowPage),
    rowPageSize: "50",
  });
  return useQuery({
    queryKey: [...PRODUCT_IMPORT_QUERY_KEY, "detail", batchId, rowPage],
    enabled: Boolean(batchId),
    initialData: rowPage === 1 ? initialData : undefined,
    queryFn: () =>
      fetchJson<ProductImportBatchDetail>(
        `/api/admin/product-imports/${encodeURIComponent(batchId ?? "")}?${params}`,
        "No se pudo cargar el detalle de la importación."
      ),
  });
}

export function usePreviewProductImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      file: File;
      importerKey: string;
      organizationId: string;
    }) => {
      const body = new FormData();
      body.set("importerKey", input.importerKey);
      body.set("file", input.file);
      return fetchJson<ProductImportBatchDetail>(
        `/api/admin/organizations/${encodeURIComponent(input.organizationId)}/product-imports/preview`,
        "No se pudo previsualizar la importación.",
        { method: "POST", body }
      );
    },
    onSuccess: async (detail) => {
      queryClient.setQueryData(
        [...PRODUCT_IMPORT_QUERY_KEY, "detail", detail.batch.id, 1],
        detail
      );
      await queryClient.invalidateQueries({
        queryKey: [...PRODUCT_IMPORT_QUERY_KEY, "history"],
      });
    },
  });
}

export function useCommitProductImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) =>
      fetchJson<ProductImportBatchDetail>(
        `/api/admin/product-imports/${encodeURIComponent(batchId)}/commit`,
        "No se pudo confirmar la importación.",
        { method: "POST" }
      ),
    onSuccess: async (detail) => {
      queryClient.setQueryData(
        [...PRODUCT_IMPORT_QUERY_KEY, "detail", detail.batch.id, 1],
        detail
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_ROOT_KEY }),
        queryClient.invalidateQueries({
          queryKey: [...PRODUCT_IMPORT_QUERY_KEY, "history"],
        }),
      ]);
    },
  });
}

export async function downloadProductImportTemplate(importerKey: string) {
  const response = await fetch(
    `/api/admin/product-imports/importers/${encodeURIComponent(importerKey)}/template`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error(
      await readError(response, "No se pudo descargar la plantilla.")
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const encodedFileName = disposition.match(
    CONTENT_DISPOSITION_FILENAME_REGEX
  )?.[1];
  anchor.download = encodedFileName
    ? decodeURIComponent(encodedFileName)
    : "plantilla-importacion-productos";
  anchor.click();
  URL.revokeObjectURL(url);
}
