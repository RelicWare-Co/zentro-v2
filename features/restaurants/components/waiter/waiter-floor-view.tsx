import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { LayoutGrid, Plus, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { isOrganizationManagerRole } from "@/features/organization/access-control.shared";
import {
  CreateRestaurantAreaDialog,
  CreateRestaurantTableDialog,
  QuickAddTableCard,
} from "@/features/restaurants/components/restaurant-setup-dialogs";
import { useRestaurantBootstrap } from "@/features/restaurants/hooks/use-restaurants";
import {
  countFloorStats,
  getRestaurantAreaKind,
  getTableOccupancyStatus,
  getTableStatusLabel,
  type RestaurantAreaSummary,
  type RestaurantTableSummary,
  type TableOccupancyStatus,
} from "@/features/restaurants/restaurants-ui.shared";
import { cn } from "@/lib/utils";

const TABLE_STATUS_STYLES: Record<TableOccupancyStatus, string> = {
  draft: "border-amber-400/40 bg-amber-400/10",
  free: "border-emerald-500/30 bg-emerald-500/5",
  kitchen: "border-orange-400/40 bg-orange-400/10",
  occupied: "border-[var(--color-voltage)]/40 bg-[var(--color-voltage)]/10",
  ready: "border-sky-400/40 bg-sky-400/10",
};

const TABLE_STATUS_BADGE_CLASSES: Record<TableOccupancyStatus, string> = {
  draft: "bg-amber-400/15 text-amber-100",
  free: "bg-emerald-500/15 text-emerald-200",
  kitchen: "bg-orange-400/15 text-orange-100",
  occupied: "bg-[var(--color-voltage)]/15 text-[var(--color-voltage)]",
  ready: "bg-sky-400/15 text-sky-100",
};

function getAreaLabel(area: RestaurantAreaSummary) {
  const kind = getRestaurantAreaKind(area.name);
  if (kind === "delivery") {
    return "Domicilios";
  }
  if (kind === "pickup") {
    return "Recogida";
  }
  return area.name;
}

function WaiterTableCard({
  onSelectTable,
  table,
}: {
  onSelectTable: (tableId: string) => void;
  table: RestaurantTableSummary;
}) {
  const status = getTableOccupancyStatus(table);
  const openOrder = table.openOrder;

  return (
    <button
      className={cn(
        "flex min-h-[96px] flex-col rounded-2xl border-2 p-3 text-left transition-colors active:scale-[0.99]",
        TABLE_STATUS_STYLES[status]
      )}
      onClick={() => onSelectTable(table.id)}
      type="button"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="truncate font-semibold text-base text-white">
          {table.name}
        </span>
        <Badge
          className={cn(
            "shrink-0 border-transparent",
            TABLE_STATUS_BADGE_CLASSES[status]
          )}
          size="sm"
          tt="none"
        >
          {getTableStatusLabel(status)}
        </Badge>
      </div>

      {table.seats > 0 ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
          <Users aria-hidden="true" className="size-3.5" />
          {table.seats} puestos
        </span>
      ) : null}

      <div className="mt-auto pt-2">
        {openOrder ? (
          <span className="text-xs text-zinc-300">
            Orden #{openOrder.orderNumber}
            {openOrder.itemCount > 0 ? ` · ${openOrder.itemCount} ítems` : ""}
            {openOrder.draftItemsCount > 0
              ? ` · ${openOrder.draftItemsCount} por enviar`
              : ""}
          </span>
        ) : (
          <span className="text-xs text-zinc-500">Libre — toca para abrir</span>
        )}
      </div>
    </button>
  );
}

function WaiterNoAreasState({
  canManageLayout,
  onCreateArea,
}: {
  canManageLayout: boolean;
  onCreateArea: () => void;
}) {
  return (
    <Stack align="center" gap="sm" py={60}>
      <LayoutGrid className="size-10 text-zinc-700" />
      <Text c="zinc.5" fw={600}>
        No hay zonas configuradas
      </Text>
      <Text c="zinc.6" maw={320} size="sm" ta="center">
        {canManageLayout
          ? "Crea una zona para empezar a agregar mesas al salón."
          : "Pide a un administrador que cree zonas y mesas en Configuración → Restaurantes."}
      </Text>
      {canManageLayout ? (
        <Button
          color="voltage"
          leftSection={<Plus className="size-4" />}
          mt="sm"
          onClick={onCreateArea}
          size="lg"
        >
          Crear zona
        </Button>
      ) : null}
    </Stack>
  );
}

export function WaiterFloorView({
  onSelectTable,
}: {
  onSelectTable: (tableId: string) => void;
}) {
  const pageContext = usePageContext();
  const canManageLayout = isOrganizationManagerRole(
    pageContext.zeroContext?.role
  );
  const bootstrapQuery = useRestaurantBootstrap();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [isCreateAreaOpen, setIsCreateAreaOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);

  const areas = bootstrapQuery.data?.areas ?? [];
  const activeArea = useMemo(
    () => areas.find((area) => area.id === activeAreaId) ?? areas[0] ?? null,
    [activeAreaId, areas]
  );
  const stats = useMemo(() => countFloorStats(areas), [areas]);

  if (bootstrapQuery.isLoading && areas.length === 0) {
    return (
      <Group align="center" justify="center" py="xl">
        <Loader color="voltage.5" />
      </Group>
    );
  }

  if (bootstrapQuery.isError) {
    return (
      <Alert color="red" title="No se pudo cargar el salón" variant="light">
        {bootstrapQuery.error instanceof Error
          ? bootstrapQuery.error.message
          : "Inténtalo de nuevo."}
        <Group mt="sm">
          <Button
            leftSection={<RefreshCw className="size-4" />}
            onClick={() => bootstrapQuery.refetch()}
            variant="light"
          >
            Reintentar
          </Button>
        </Group>
      </Alert>
    );
  }

  if (areas.length === 0) {
    return (
      <>
        <WaiterNoAreasState
          canManageLayout={canManageLayout}
          onCreateArea={() => setIsCreateAreaOpen(true)}
        />
        <CreateRestaurantAreaDialog
          onOpenChange={setIsCreateAreaOpen}
          open={isCreateAreaOpen}
        />
      </>
    );
  }

  return (
    <Stack gap="md">
      <Group align="center" gap="xs" justify="space-between" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          <Badge color="gray" variant="light">
            {stats.total} mesas
          </Badge>
          <Badge color="yellow" variant="light">
            {stats.draft} con pendientes
          </Badge>
          <Badge color="green" variant="light">
            {stats.free} libres
          </Badge>
        </Group>
        {canManageLayout ? (
          <Button
            color="voltage"
            leftSection={<Plus className="size-4" />}
            onClick={() => setIsCreateTableOpen(true)}
            size="sm"
            variant="light"
          >
            Agregar mesa
          </Button>
        ) : null}
      </Group>

      <ScrollArea offsetScrollbars scrollbars="x">
        <Group gap="xs" pb="xs" wrap="nowrap">
          {areas.map((area) => (
            <Button
              color={activeArea?.id === area.id ? "voltage" : "gray"}
              key={area.id}
              onClick={() => setActiveAreaId(area.id)}
              size="compact-md"
              variant={activeArea?.id === area.id ? "filled" : "light"}
            >
              {getAreaLabel(area)}
            </Button>
          ))}
        </Group>
      </ScrollArea>

      {activeArea && activeArea.tables.length === 0 ? (
        <Stack align="center" gap="sm" py={40}>
          <Text c="zinc.5" fw={600} size="sm">
            Esta zona no tiene mesas todavía
          </Text>
          {canManageLayout ? (
            <Button
              color="voltage"
              leftSection={<Plus className="size-4" />}
              onClick={() => setIsCreateTableOpen(true)}
              size="lg"
            >
              Crear mesa
            </Button>
          ) : (
            <Text c="zinc.6" maw={320} size="xs" ta="center">
              Pide a un administrador que agregue mesas a esta zona.
            </Text>
          )}
        </Stack>
      ) : null}

      {activeArea && activeArea.tables.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activeArea.tables.map((table) => (
            <WaiterTableCard
              key={table.id}
              onSelectTable={onSelectTable}
              table={table}
            />
          ))}
          {canManageLayout ? (
            <QuickAddTableCard onClick={() => setIsCreateTableOpen(true)} />
          ) : null}
        </div>
      ) : null}

      <CreateRestaurantAreaDialog
        onOpenChange={setIsCreateAreaOpen}
        open={isCreateAreaOpen}
      />
      <CreateRestaurantTableDialog
        areas={areas}
        defaultAreaId={activeArea?.id ?? null}
        onOpenChange={setIsCreateTableOpen}
        open={isCreateTableOpen}
      />
    </Stack>
  );
}
