import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { DashboardOverviewSchema } from "@/features/dashboard/dashboard.schema";

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

const dateTimeFormat = new Intl.DateTimeFormat();

function getBrowserTimeZone() {
  return dateTimeFormat.resolvedOptions().timeZone;
}

async function fetchDashboardOverview(
  timeZone: string
): Promise<DashboardOverview> {
  const response = await fetch(
    `/api/dashboard/overview?tz=${encodeURIComponent(timeZone)}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    let message = "No se pudo cargar el dashboard";
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

  return response.json() as Promise<DashboardOverview>;
}

export function useDashboardOverview() {
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: ["dashboard", "overview", timeZone],
    queryFn: () => fetchDashboardOverview(timeZone),
  });
}
