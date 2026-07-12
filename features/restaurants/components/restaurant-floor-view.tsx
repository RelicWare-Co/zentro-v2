import { Badge, Button, SegmentedControl } from "@mantine/core";
import {
  Bike,
  ChefHat,
  LayoutGrid,
  PackageCheck,
  Plus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CreateRestaurantAreaDialog,
  CreateRestaurantTableDialog,
  QuickAddTableCard,
} from "@/features/restaurants/components/restaurant-setup-dialogs";
import type { RestaurantBootstrap } from "@/features/restaurants/restaurants.shared";
import {
  countFloorStats,
  getRestaurantAreaKind,
  getTableOccupancyStatus,
  getTableStatusLabel,
  type RestaurantTableSummary,
} from "@/features/restaurants/restaurants-ui.shared";
import { formatCurrency } from "@/lib/format-currency.shared";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  ReturnType<typeof getTableOccupancyStatus>,
  string
> = {
  free: "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/50",
  draft:
    "border-amber-400/40 bg-amber-400/10 hover:border-amber-300/60 shadow-[0_0_24px_-8px_rgba(251,191,36,0.35)]",
  kitchen:
    "border-orange-400/40 bg-orange-400/10 hover:border-orange-300/60 shadow-[0_0_24px_-8px_rgba(251,146,60,0.35)]",
  ready:
    "border-sky-400/40 bg-sky-400/10 hover:border-sky-300/60 shadow-[0_0_24px_-8px_rgba(56,189,248,0.35)]",
  occupied:
    "border-[var(--color-voltage)]/40 bg-[var(--color-voltage)]/10 hover:border-[var(--color-voltage)]/70 shadow-[0_0_24px_-8px_rgba(217,241,92,0.35)]",
};

function AreaIcon({ name }: { name: string }) {
  const kind = getRestaurantAreaKind(name);
  if (kind === "delivery") {
    return <Bike aria-hidden="true" className="size-4" />;
  }
  if (kind === "pickup") {
    return <PackageCheck aria-hidden="true" className="size-4" />;
  }
  return <LayoutGrid aria-hidden="true" className="size-4" />;
}

function TableTile({
  isSelected,
  onSelect,
  table,
}: {
  table: RestaurantTableSummary;
  isSelected: boolean;
  onSelect: (tableId: string) => void;
}) {
  const status = getTableOccupancyStatus(table);

  return (
    <button
      className={cn(
        "group relative flex min-h-[132px] flex-col rounded-2xl border-2 p-4 text-left transition-all",
        statusStyles[status],
        isSelected &&
          "ring-2 ring-[var(--color-voltage)] ring-offset-2 ring-offset-[var(--color-void)]",
        !table.isActive && "opacity-45 saturate-50"
      )}
      disabled={!table.isActive}
      onClick={() => onSelect(table.id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-lg text-white">
            {table.name}
          </div>
          {table.seats > 0 ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
              <Users aria-hidden="true" className="size-3.5" />
              {table.seats} puestos
            </div>
          ) : null}
        </div>
        <Badge
          className={cn(
            "shrink-0 border-transparent",
            status === "free" && "bg-emerald-500/15 text-emerald-200",
            status === "draft" && "bg-amber-400/15 text-amber-100",
            status === "kitchen" && "bg-orange-400/15 text-orange-100",
            status === "ready" && "bg-sky-400/15 text-sky-100",
            status === "occupied" &&
              "bg-[var(--color-voltage)]/15 text-[var(--color-voltage)]"
          )}
          tt="none"
        >
          {getTableStatusLabel(status)}
        </Badge>
      </div>

      <div className="mt-auto pt-4">
        {table.openOrder ? (
          <div className="space-y-1">
            <div className="text-sm text-zinc-300">
              Orden #{table.openOrder.orderNumber}
            </div>
            <div className="font-medium text-[var(--color-voltage)]">
              {formatCurrency(table.openOrder.totalAmount)}
            </div>
            <div className="text-xs text-zinc-500">
              {table.openOrder.itemCount} ítems
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Toca para tomar pedido</div>
        )}
      </div>
    </button>
  );
}

interface RestaurantFloorViewProps {
  bootstrap: RestaurantBootstrap;
  canManageLayout: boolean;
  kitchenEnabled: boolean;
  onSelectTable: (tableId: string) => void;
  selectedTableId: string | null;
}

export function RestaurantFloorView({
  bootstrap,
  canManageLayout,
  kitchenEnabled,
  onSelectTable,
  selectedTableId,
}: RestaurantFloorViewProps) {
  const [activeAreaId, setActiveAreaId] = useState(
    () => bootstrap.areas[0]?.id ?? "all"
  );
  const [isCreateAreaOpen, setIsCreateAreaOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  const stats = useMemo(
    () => countFloorStats(bootstrap.areas),
    [bootstrap.areas]
  );

  const resolvedAreaId =
    activeAreaId === "all" ||
    bootstrap.areas.some((area) => area.id === activeAreaId)
      ? activeAreaId
      : (bootstrap.areas[0]?.id ?? "all");

  const visibleAreas =
    resolvedAreaId === "all"
      ? bootstrap.areas
      : bootstrap.areas.filter((area) => area.id === resolvedAreaId);

  const createTableAreaId =
    resolvedAreaId === "all" ? bootstrap.areas[0]?.id : resolvedAreaId;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="gray" tt="none" variant="outline">
              {stats.free} libres
            </Badge>
            <Badge color="gray" tt="none" variant="outline">
              {stats.occupied} ocupadas
            </Badge>
            {stats.draft > 0 ? (
              <Badge
                className="border-amber-400/30 bg-amber-400/10 text-amber-100"
                tt="none"
              >
                {stats.draft} pendientes de envío
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Plano en vivo del salón. Selecciona una mesa para abrir la cuenta o
            agrega mesas nuevas al instante.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {kitchenEnabled ? (
            <Button
              color="gray"
              component="a"
              href="/kitchen"
              leftSection={<ChefHat aria-hidden="true" className="size-4" />}
              variant="outline"
            >
              Cocina
            </Button>
          ) : null}
          {canManageLayout ? (
            <>
              <Button
                className="border-dashed"
                leftSection={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setIsCreateAreaOpen(true)}
                type="button"
                variant="outline"
              >
                Zona
              </Button>
              <Button
                c="black"
                color="voltage.5"
                disabled={bootstrap.areas.length === 0}
                leftSection={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setIsCreateTableOpen(true)}
                type="button"
              >
                Mesa
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {bootstrap.areas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-10 text-center">
          <LayoutGrid
            aria-hidden="true"
            className="size-10 text-[var(--color-voltage)]"
          />
          <h2 className="font-medium text-lg text-white">
            Configura tu primer salón
          </h2>
          <p className="max-w-md text-sm text-zinc-400">
            Crea una zona (salón, terraza, barra) y agrega mesas para empezar a
            tomar pedidos.
          </p>
          {canManageLayout ? (
            <Button
              c="black"
              color="voltage.5"
              onClick={() => setIsCreateAreaOpen(true)}
              type="button"
            >
              Crear primera zona
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              data={[
                { label: "Todas", value: "all" },
                ...bootstrap.areas.map((area) => ({
                  value: area.id,
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <AreaIcon name={area.name} />
                      {area.name}
                      <span className="text-xs opacity-70">
                        ({area.tables.filter((table) => table.isActive).length})
                      </span>
                    </span>
                  ),
                })),
              ]}
              onChange={setActiveAreaId}
              value={resolvedAreaId}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-1 pb-4">
            {visibleAreas.map((area) => (
              <section key={area.id}>
                {resolvedAreaId === "all" ? (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-medium text-lg text-white">
                      <span className="inline-flex items-center gap-2">
                        <AreaIcon name={area.name} />
                        {area.name}
                      </span>
                    </h2>
                    {canManageLayout ? (
                      <Button
                        color="gray"
                        leftSection={
                          <Plus aria-hidden="true" className="size-4" />
                        }
                        onClick={() => {
                          setActiveAreaId(area.id);
                          setIsCreateTableOpen(true);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Mesa en {area.name}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {area.tables
                    .filter((table) => table.isActive)
                    .map((table) => (
                      <TableTile
                        isSelected={table.id === selectedTableId}
                        key={table.id}
                        onSelect={onSelectTable}
                        table={table}
                      />
                    ))}
                  {canManageLayout ? (
                    <QuickAddTableCard
                      onClick={() => {
                        setActiveAreaId(area.id);
                        setIsCreateTableOpen(true);
                      }}
                    />
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      <CreateRestaurantAreaDialog
        onOpenChange={setIsCreateAreaOpen}
        open={isCreateAreaOpen}
      />
      <CreateRestaurantTableDialog
        areas={bootstrap.areas}
        defaultAreaId={createTableAreaId}
        onOpenChange={setIsCreateTableOpen}
        open={isCreateTableOpen}
      />
    </div>
  );
}
