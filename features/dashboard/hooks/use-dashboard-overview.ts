import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { DashboardOverviewSchema } from "@/schemas/dashboard";

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const response = await fetch("/api/dashboard/overview", {
    credentials: "include",
  });

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
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
  });
}
