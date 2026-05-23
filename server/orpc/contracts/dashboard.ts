import { oc } from "@orpc/contract";
import { DashboardOverviewSchema } from "@/schemas/dashboard";

export const dashboardContract = {
  overview: oc
    .route({
      method: "GET",
      path: "/dashboard/overview",
      summary: "Resumen operativo del dashboard",
      tags: ["Dashboard"],
    })
    .output(DashboardOverviewSchema),
};
