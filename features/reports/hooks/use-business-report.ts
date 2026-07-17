import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  ReportData,
  ReportFilters,
} from "@/features/reports/reports.schema";

const dateTimeFormat = new Intl.DateTimeFormat();
const CONTENT_DISPOSITION_FILENAME_REGEX = /filename="([^"]+)"/;

export function getBrowserTimeZone() {
  return dateTimeFormat.resolvedOptions().timeZone;
}

export function buildReportSearchParams(
  filters: ReportFilters,
  timeZone: string
) {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    status: filters.status,
    tz: timeZone,
  });
  if (filters.cashierId) {
    params.set("cashierId", filters.cashierId);
  }
  return params;
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchBusinessReport(
  filters: ReportFilters,
  timeZone: string
): Promise<ReportData> {
  const params = buildReportSearchParams(filters, timeZone);
  const response = await fetch(`/api/reports/overview?${params}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "No se pudo cargar el reporte"));
  }
  return response.json() as Promise<ReportData>;
}

export function useBusinessReport(filters: ReportFilters) {
  const timeZone = getBrowserTimeZone();
  return useQuery({
    queryKey: ["reports", "business", filters, timeZone],
    queryFn: () => fetchBusinessReport(filters, timeZone),
    placeholderData: keepPreviousData,
  });
}

export async function downloadBusinessReport(filters: ReportFilters) {
  const params = buildReportSearchParams(filters, getBrowserTimeZone());
  const response = await fetch(`/api/reports/export.xlsx?${params}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(
      await readError(response, "No se pudo exportar el reporte")
    );
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(CONTENT_DISPOSITION_FILENAME_REGEX)?.[1] ??
    `reporte-negocio-${filters.startDate}-${filters.endDate}.xlsx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
