import {
  ActionIcon,
  Badge,
  Button,
  NumberInput,
  Pagination,
  Select,
  TextInput,
} from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDateTime } from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import {
  getAdminUrlParams,
  replaceAdminUrlParams,
} from "@/features/admin/admin-url-state";
import {
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
import {
  type AdminOrganizationSummary,
  useAdminOrganizationsQuery,
} from "@/features/admin/hooks/use-admin-platform";
import {
  CompactStatCard,
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import { formatCount } from "@/features/dashboard/dashboard-formatters.shared";
import { formatCurrency } from "@/lib/format-currency.shared";

const PAGE_SIZE = 20;
type SortBy =
  | "createdAt"
  | "name"
  | "lastSaleAt"
  | "paidAmount"
  | "paidAmount30d"
  | "historicalPaidAmount"
  | "membersCount";
type Direction = "asc" | "desc";
const SORT_OPTIONS: SortBy[] = [
  "createdAt",
  "name",
  "lastSaleAt",
  "paidAmount",
  "paidAmount30d",
  "historicalPaidAmount",
  "membersCount",
];

function read(key: string) {
  return getAdminUrlParams().get(`o_${key}`) ?? "";
}

function SortHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  let Icon = ArrowUpDown;
  if (active) {
    Icon = direction === "asc" ? ArrowUp : ArrowDown;
  }
  return (
    <button
      className="inline-flex items-center gap-1 text-left text-zinc-400 hover:text-white"
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

function OrganizationsSummaryCards({
  summary,
}: {
  summary: {
    totalOrganizations: number;
    activeOrganizations: number;
    paidAmount: number;
    membersCount: number;
  };
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CompactStatCard
        description="Organizaciones registradas"
        icon={Building2}
        title="Total"
        value={formatCount(summary.totalOrganizations)}
      />
      <CompactStatCard
        description="Con ventas en el periodo"
        icon={Building2}
        title="Activas"
        value={formatCount(summary.activeOrganizations)}
      />
      <CompactStatCard
        description="Cobros aplicados del periodo"
        icon={Building2}
        title="Cobrado"
        value={formatCurrency(summary.paidAmount)}
      />
      <CompactStatCard
        description="En todas las organizaciones"
        icon={Building2}
        title="Miembros"
        value={formatCount(summary.membersCount)}
      />
    </section>
  );
}

function OrganizationsTable({
  organizations,
  sortBy,
  sortDirection,
  onSort,
}: {
  organizations: AdminOrganizationSummary[];
  sortBy: SortBy;
  sortDirection: Direction;
  onSort: (value: SortBy) => void;
}) {
  const { actions } = useAdminPage();
  if (organizations.length === 0) {
    return (
      <EmptyState>
        No se encontraron organizaciones con ese criterio.
      </EmptyState>
    );
  }
  return (
    <div className="overflow-auto rounded-xl border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="px-4 text-zinc-400">
              <SortHeader
                active={sortBy === "name"}
                direction={sortDirection}
                label="Organización"
                onClick={() => onSort("name")}
              />
            </TableHead>
            <TableHead className="text-zinc-400">
              <SortHeader
                active={sortBy === "createdAt"}
                direction={sortDirection}
                label="Creada"
                onClick={() => onSort("createdAt")}
              />
            </TableHead>
            <TableHead className="text-right text-zinc-400">
              <SortHeader
                active={sortBy === "membersCount"}
                direction={sortDirection}
                label="Miembros"
                onClick={() => onSort("membersCount")}
              />
            </TableHead>
            <TableHead className="text-right text-zinc-400">
              <SortHeader
                active={sortBy === "paidAmount"}
                direction={sortDirection}
                label="Cobrado"
                onClick={() => onSort("paidAmount")}
              />
            </TableHead>
            <TableHead className="text-right text-zinc-400">
              <SortHeader
                active={sortBy === "paidAmount30d"}
                direction={sortDirection}
                label="Cobrado 30d"
                onClick={() => onSort("paidAmount30d")}
              />
            </TableHead>
            <TableHead className="text-right text-zinc-400">
              <SortHeader
                active={sortBy === "historicalPaidAmount"}
                direction={sortDirection}
                label="Cobrado histórico"
                onClick={() => onSort("historicalPaidAmount")}
              />
            </TableHead>
            <TableHead className="hidden text-zinc-400 lg:table-cell">
              <SortHeader
                active={sortBy === "lastSaleAt"}
                direction={sortDirection}
                label="Última venta"
                onClick={() => onSort("lastSaleAt")}
              />
            </TableHead>
            <TableHead className="text-right text-zinc-400">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow
              className="border-zinc-800 hover:bg-white/[0.02]"
              key={org.id}
            >
              <TableCell className="px-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{org.name}</p>
                  <p className="truncate text-xs text-zinc-500">{org.slug}</p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-zinc-400">
                {formatAdminDateTime(org.createdAt)}
              </TableCell>
              <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                {formatCount(org.membersCount)}
              </TableCell>
              <TableCell className="text-right font-medium text-sm text-white tabular-nums">
                {formatCurrency(org.paidAmount ?? org.revenueToday)}
              </TableCell>
              <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                {formatCurrency(org.revenue30d)}
              </TableCell>
              <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                {formatCurrency(org.historicalPaidAmount ?? 0)}
              </TableCell>
              <TableCell className="hidden text-sm text-zinc-400 lg:table-cell">
                {org.lastSaleAt
                  ? formatAdminDateTime(org.lastSaleAt)
                  : "Sin ventas"}
              </TableCell>
              <TableCell className="text-right">
                <ActionIcon
                  aria-label={`Ver detalle de ${org.name}`}
                  color="gray"
                  onClick={() => actions.openOrganization(org.id)}
                  variant="outline"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </ActionIcon>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminOrganizationsTab() {
  const [search, setSearch] = useState(() => read("search"));
  const [period, setPeriod] = useState<"30d" | "custom" | "all">(() => {
    const value = read("period");
    return value === "all" || value === "custom" ? value : "30d";
  });
  const [startDate, setStartDate] = useState(() => read("startDate"));
  const [endDate, setEndDate] = useState(() => read("endDate"));
  const [moduleKey, setModuleKey] = useState(() => read("moduleKey"));
  const [moduleStatus, setModuleStatus] = useState(() => read("moduleStatus"));
  const [hasSales, setHasSales] = useState(() => read("hasSales"));
  const [paidMin, setPaidMin] = useState<number | undefined>(() => {
    const raw = read("paidMin");
    const value = Number(raw);
    return raw && Number.isFinite(value) && value >= 0 ? value : undefined;
  });
  const [paidMax, setPaidMax] = useState<number | undefined>(() => {
    const raw = read("paidMax");
    const value = Number(raw);
    return raw && Number.isFinite(value) && value >= 0 ? value : undefined;
  });
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const value = read("sortBy") as SortBy;
    return SORT_OPTIONS.includes(value) ? value : "createdAt";
  });
  const [sortDirection, setSortDirection] = useState<Direction>(() =>
    read("sortDirection") === "asc" ? "asc" : "desc"
  );
  const [page, setPage] = useState(() => {
    const value = Number(read("page"));
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  });

  const update = (
    key: string,
    value: string | number | boolean | null | undefined,
    reset = true
  ) => {
    const nextPage =
      reset || key !== "page" || typeof value !== "number" ? 1 : value;
    replaceAdminUrlParams({ [`o_${key}`]: value, o_page: nextPage });
    if (reset) {
      setPage(1);
    }
  };
  const organizationModuleKey =
    moduleKey === "restaurants" ? moduleKey : undefined;
  const organizationModuleStatus =
    moduleStatus === "granted" || moduleStatus === "blocked"
      ? moduleStatus
      : undefined;
  const organizationsQuery = useAdminOrganizationsQuery({
    period,
    search,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    moduleKey: organizationModuleKey,
    moduleStatus: organizationModuleStatus,
    hasSales: hasSales === "" ? undefined : hasSales === "true",
    paidMin,
    paidMax,
    sortBy,
    sortDirection,
    page,
    pageSize: PAGE_SIZE,
  });
  if (organizationsQuery.isPending) {
    return <AdminTabLoading />;
  }
  if (organizationsQuery.isError) {
    return (
      <AdminTabError
        error={organizationsQuery.error}
        fallbackMessage="Ocurrió un error al cargar las organizaciones. Intenta de nuevo."
        onRetry={() => organizationsQuery.refetch()}
        title="No se pudieron cargar las organizaciones"
      />
    );
  }

  const data = organizationsQuery.data;
  const clear = () => {
    setSearch("");
    setPeriod("30d");
    setStartDate("");
    setEndDate("");
    setModuleKey("");
    setModuleStatus("");
    setHasSales("");
    setPaidMin(undefined);
    setPaidMax(undefined);
    setSortBy("createdAt");
    setSortDirection("desc");
    setPage(1);
    replaceAdminUrlParams({
      o_search: null,
      o_period: null,
      o_startDate: null,
      o_endDate: null,
      o_moduleKey: null,
      o_moduleStatus: null,
      o_hasSales: null,
      o_paidMin: null,
      o_paidMax: null,
      o_sortBy: null,
      o_sortDirection: null,
      o_page: null,
    });
  };
  const toggleSort = (value: SortBy) => {
    const nextDirection =
      sortBy === value && sortDirection === "desc" ? "asc" : "desc";
    setSortBy(value);
    setSortDirection(nextDirection);
    setPage(1);
    replaceAdminUrlParams({
      o_sortBy: value,
      o_sortDirection: nextDirection,
      o_page: 1,
    });
  };

  return (
    <div className="space-y-6">
      <OrganizationsSummaryCards summary={data.summary} />
      <DashboardPanelShell
        description="Filtra y ordena organizaciones sin cargar todo el catálogo en el navegador."
        headerAside={
          <Badge
            className="border-zinc-700 bg-black/20 text-zinc-300"
            tt="none"
            variant="outline"
          >
            {formatCount(data.total)} resultados
          </Badge>
        }
        title="Organizaciones"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextInput
              aria-label="Buscar organizaciones"
              leftSection={<Search aria-hidden="true" className="size-4" />}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                update("search", value);
              }}
              placeholder="Buscar por nombre o slug…"
              value={search}
            />
            <Select
              allowDeselect={false}
              data={[
                { value: "30d", label: "Últimos 30 días" },
                { value: "custom", label: "Periodo personalizado" },
                { value: "all", label: "Histórico" },
              ]}
              onChange={(value) => {
                const next = (value as typeof period) || "30d";
                setPeriod(next);
                update("period", next);
              }}
              value={period}
            />
            <Select
              clearable
              data={[
                { value: "true", label: "Con ventas" },
                { value: "false", label: "Sin ventas" },
              ]}
              onChange={(value) => {
                setHasSales(value ?? "");
                update("hasSales", value);
              }}
              placeholder="Actividad"
              value={hasSales || null}
            />
            <Select
              clearable
              data={data.filterOptions.modules.map((module) => ({
                value: module.key,
                label: module.label,
              }))}
              onChange={(value) => {
                setModuleKey(value ?? "");
                update("moduleKey", value);
              }}
              placeholder="Módulo"
              value={moduleKey || null}
            />
            <Select
              clearable
              data={[
                { value: "granted", label: "Módulo habilitado" },
                { value: "blocked", label: "Módulo bloqueado" },
              ]}
              onChange={(value) => {
                setModuleStatus(value ?? "");
                update("moduleStatus", value);
              }}
              placeholder="Estado de módulo"
              value={moduleStatus || null}
            />
            <NumberInput
              hideControls
              label="Cobrado mínimo"
              min={0}
              onChange={(value) => {
                const next = typeof value === "number" ? value : undefined;
                setPaidMin(next);
                update("paidMin", next);
              }}
              value={paidMin ?? ""}
            />
            <NumberInput
              hideControls
              label="Cobrado máximo"
              min={0}
              onChange={(value) => {
                const next = typeof value === "number" ? value : undefined;
                setPaidMax(next);
                update("paidMax", next);
              }}
              value={paidMax ?? ""}
            />
            <div className="flex items-end">
              <Button
                leftSection={<X className="size-4" />}
                onClick={clear}
                variant="subtle"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
          {period === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Desde"
                onChange={(event) => {
                  const value = event.target.value;
                  setStartDate(value);
                  update("startDate", value);
                }}
                type="date"
                value={startDate}
              />
              <TextInput
                label="Hasta"
                onChange={(event) => {
                  const value = event.target.value;
                  setEndDate(value);
                  update("endDate", value);
                }}
                type="date"
                value={endDate}
              />
            </div>
          ) : null}
          <OrganizationsTable
            onSort={toggleSort}
            organizations={data.organizations}
            sortBy={sortBy}
            sortDirection={sortDirection}
          />
          <div className="flex justify-end">
            <Pagination
              onChange={(value) => {
                setPage(value);
                update("page", value, false);
              }}
              total={Math.max(1, Math.ceil(data.total / data.pageSize))}
              value={data.page}
            />
          </div>
        </div>
      </DashboardPanelShell>
    </div>
  );
}
