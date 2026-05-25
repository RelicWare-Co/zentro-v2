import { Package, Store } from "lucide-react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
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
          asChild
          className="h-10 w-full border-zinc-800 bg-[var(--color-carbon)] px-4 text-zinc-300 hover:bg-white/5 hover:text-white sm:w-auto"
          variant="outline"
        >
          <Link href="/products">
            <Package aria-hidden="true" className="mr-2 size-4" />
            Ver inventario
          </Link>
        </Button>
        <Button
          asChild
          className="h-10 w-full bg-[var(--color-voltage)] px-4 font-semibold text-black hover:bg-[#c9e605] sm:w-auto"
        >
          <Link href="/pos">
            <Store aria-hidden="true" className="mr-2 size-4" />
            Ir al POS
          </Link>
        </Button>
      </div>
    </div>
  );
}
