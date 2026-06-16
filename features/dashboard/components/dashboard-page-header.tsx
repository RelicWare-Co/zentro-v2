import { Button } from "@mantine/core";
import { Package, Store } from "lucide-react";
import { Link } from "@/components/link";
import { dashboardDateTimeFormatter } from "@/features/dashboard/dashboard-formatters.shared";
import { useDashboardData } from "@/features/dashboard/dashboard-page-context";

export function DashboardPageHeader() {
  const { generatedAt } = useDashboardData();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold text-3xl text-white tracking-tight">
            Panel de control
          </h1>
          <span className="text-sm text-zinc-400">Resumen operativo</span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Datos actualizados a las{" "}
          {dashboardDateTimeFormatter.format(generatedAt)}.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          color="gray"
          component={Link}
          href="/products"
          leftSection={<Package aria-hidden="true" className="size-4" />}
          variant="outline"
        >
          Ver inventario
        </Button>
        <Button
          c="black"
          className="w-full sm:w-auto"
          color="voltage.5"
          component={Link}
          href="/pos"
          leftSection={<Store aria-hidden="true" className="size-4" />}
        >
          Ir al POS
        </Button>
      </div>
    </div>
  );
}
