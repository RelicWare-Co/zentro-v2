import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Loader,
  NumberInput,
  Pagination,
  Select,
  Table,
  TextInput,
} from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  formatAdminDateTime,
  formatSaleStatusLabel,
} from "@/features/admin/admin.shared";
import {
  getAdminUrlParams,
  replaceAdminUrlParams,
} from "@/features/admin/admin-url-state";
import {
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
import { useAdminOptionsQuery } from "@/features/admin/hooks/use-admin-options";
import {
  type AdminSalesResponse,
  useAdminSaleDetailQuery,
  useAdminSalesQuery,
} from "@/features/admin/hooks/use-admin-sales";
import {
  CompactStatCard,
  DashboardPanelShell,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCount,
  formatPaymentMethod,
} from "@/features/dashboard/dashboard-formatters.shared";
import { formatCurrency } from "@/lib/format-currency.shared";

const PAGE_SIZE = 20;
type SortBy =
  | "createdAt"
  | "totalAmount"
  | "paidAmount"
  | "organizationName"
  | "sellerName";
type Direction = "asc" | "desc";
type Period = "30d" | "custom" | "all";
const SORT_OPTIONS: SortBy[] = [
  "createdAt",
  "totalAmount",
  "paidAmount",
  "organizationName",
  "sellerName",
];

interface SalesFilterState {
  balanceStatus: string;
  endDate: string;
  organizationId: string;
  page: number;
  paidMax: number | undefined;
  paidMin: number | undefined;
  paymentMethod: string;
  period: Period;
  search: string;
  sellerId: string;
  sortBy: SortBy;
  sortDirection: Direction;
  startDate: string;
  status: string;
  terminalName: string;
  totalMax: number | undefined;
  totalMin: number | undefined;
}

function read(key: string) {
  return getAdminUrlParams().get(`s_${key}`) ?? "";
}

function readPeriod(): Period {
  const value = read("period");
  return value === "all" || value === "custom" ? value : "30d";
}

function readNumber(key: string) {
  const raw = read(key);
  const value = Number(raw);
  return raw && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function useAdminSalesFilters() {
  const [state, setState] = useState<SalesFilterState>(() => ({
    balanceStatus: read("balanceStatus"),
    endDate: read("endDate"),
    organizationId: read("organizationId"),
    page:
      Number.isSafeInteger(Number(read("page"))) && Number(read("page")) > 0
        ? Number(read("page"))
        : 1,
    paidMax: readNumber("paidMax"),
    paidMin: readNumber("paidMin"),
    paymentMethod: read("paymentMethod"),
    period: readPeriod(),
    search: read("search"),
    sellerId: read("sellerId"),
    sortBy: SORT_OPTIONS.includes(read("sortBy") as SortBy)
      ? (read("sortBy") as SortBy)
      : "createdAt",
    sortDirection: read("sortDirection") === "asc" ? "asc" : "desc",
    startDate: read("startDate"),
    status: read("status"),
    terminalName: read("terminalName"),
    totalMax: readNumber("totalMax"),
    totalMin: readNumber("totalMin"),
  }));

  const update = (
    key: string,
    value: string | number | boolean | null | undefined,
    reset = true
  ) => {
    setState((current) => ({
      ...current,
      [key]: value,
      page: reset ? 1 : current.page,
    }));
    const nextPage =
      reset || key !== "page" || typeof value !== "number" ? 1 : value;
    replaceAdminUrlParams({ [`s_${key}`]: value, s_page: nextPage });
  };

  const set = <K extends keyof SalesFilterState>(
    key: K,
    value: SalesFilterState[K]
  ) => {
    update(key, value);
  };

  const toggleSort = (sortBy: SortBy) => {
    const sortDirection =
      state.sortBy === sortBy && state.sortDirection === "desc"
        ? "asc"
        : "desc";
    setState((current) => ({ ...current, sortBy, sortDirection, page: 1 }));
    replaceAdminUrlParams({
      s_sortBy: sortBy,
      s_sortDirection: sortDirection,
      s_page: 1,
    });
  };

  const clear = () => {
    setState({
      balanceStatus: "",
      endDate: "",
      organizationId: "",
      page: 1,
      paidMax: undefined,
      paidMin: undefined,
      paymentMethod: "",
      period: "30d",
      search: "",
      sellerId: "",
      sortBy: "createdAt",
      sortDirection: "desc",
      startDate: "",
      status: "",
      terminalName: "",
      totalMax: undefined,
      totalMin: undefined,
    });
    replaceAdminUrlParams({
      s_balanceStatus: null,
      s_endDate: null,
      s_organizationId: null,
      s_page: null,
      s_paidMax: null,
      s_paidMin: null,
      s_paymentMethod: null,
      s_period: null,
      s_search: null,
      s_sellerId: null,
      s_sortBy: null,
      s_sortDirection: null,
      s_startDate: null,
      s_status: null,
      s_terminalName: null,
      s_totalMax: null,
      s_totalMin: null,
    });
  };

  return { clear, set, state, toggleSort, update };
}

function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: Direction;
  label: string;
  onClick: () => void;
}) {
  let Icon = ArrowUpDown;
  if (active) {
    Icon = direction === "asc" ? ArrowUp : ArrowDown;
  }
  return (
    <button
      className="inline-flex items-center gap-1 hover:text-white"
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

function Summary({ summary }: { summary: AdminSalesResponse["summary"] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CompactStatCard
        description="Ventas dentro del filtro"
        icon={Receipt}
        title="Ventas"
        value={formatCount(summary.salesCount)}
      />
      <CompactStatCard
        description="Importe de ventas válidas"
        icon={Receipt}
        title="Venta"
        value={formatCurrency(summary.saleAmount)}
      />
      <CompactStatCard
        description="Cobros aplicados"
        icon={Receipt}
        title="Cobrado"
        value={formatCurrency(summary.paidAmount)}
      />
      <CompactStatCard
        description="Saldo pendiente"
        icon={Receipt}
        title="Pendiente"
        value={formatCurrency(summary.pendingAmount)}
      />
    </section>
  );
}

function SalesFilterBar({
  data,
  filters,
}: {
  data: AdminSalesResponse;
  filters: ReturnType<typeof useAdminSalesFilters>;
}) {
  const { state, set } = filters;
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [sellerSearch, setSellerSearch] = useState("");
  const organizationOptionsQuery = useAdminOptionsQuery({
    resource: "organizations",
    search: organizationSearch,
    selectedIds: state.organizationId ? [state.organizationId] : [],
  });
  const sellerOptionsQuery = useAdminOptionsQuery({
    resource: "sellers",
    search: sellerSearch,
    selectedIds: state.sellerId ? [state.sellerId] : [],
  });
  const status = state.status;
  const balanceStatus = state.balanceStatus;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          leftSection={<Search className="size-4" />}
          onChange={(event) => {
            const value = event.target.value;
            set("search", value);
          }}
          placeholder="Buscar venta, organización o vendedor…"
          value={state.search}
        />
        <Select
          clearable
          data={(organizationOptionsQuery.data?.items ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          nothingFoundMessage="No se encontraron organizaciones"
          onChange={(value) => set("organizationId", value ?? "")}
          onSearchChange={setOrganizationSearch}
          placeholder="Organización"
          searchable
          searchValue={organizationSearch}
          value={state.organizationId || null}
        />
        <Select
          clearable
          data={(sellerOptionsQuery.data?.items ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          nothingFoundMessage="No se encontraron vendedores"
          onChange={(value) => set("sellerId", value ?? "")}
          onSearchChange={setSellerSearch}
          placeholder="Vendedor"
          searchable
          searchValue={sellerSearch}
          value={state.sellerId || null}
        />
        <Select
          clearable
          data={[
            { value: "completed", label: "Pagada" },
            { value: "credit", label: "Crédito" },
            { value: "cancelled", label: "Cancelada" },
          ]}
          onChange={(value) => set("status", value ?? "")}
          placeholder="Estado"
          value={status || null}
        />
        <Select
          clearable
          data={data.filterOptions.paymentMethods.map((method) => ({
            value: method.id,
            label: method.label,
          }))}
          onChange={(value) => set("paymentMethod", value ?? "")}
          placeholder="Medio de pago"
          value={state.paymentMethod || null}
        />
        <Select
          clearable
          data={data.filterOptions.terminals.map((terminal) => ({
            value: terminal,
            label: terminal,
          }))}
          onChange={(value) => set("terminalName", value ?? "")}
          placeholder="Terminal"
          value={state.terminalName || null}
        />
        <Select
          clearable
          data={[
            { value: "with_balance", label: "Con saldo" },
            { value: "settled", label: "Sin saldo" },
          ]}
          onChange={(value) => set("balanceStatus", value ?? "")}
          placeholder="Saldo"
          value={balanceStatus || null}
        />
        <NumberInput
          hideControls
          label="Total mínimo"
          min={0}
          onChange={(value) =>
            set("totalMin", typeof value === "number" ? value : undefined)
          }
          value={state.totalMin ?? ""}
        />
        <NumberInput
          hideControls
          label="Total máximo"
          min={0}
          onChange={(value) =>
            set("totalMax", typeof value === "number" ? value : undefined)
          }
          value={state.totalMax ?? ""}
        />
        <NumberInput
          hideControls
          label="Cobrado mínimo"
          min={0}
          onChange={(value) =>
            set("paidMin", typeof value === "number" ? value : undefined)
          }
          value={state.paidMin ?? ""}
        />
        <NumberInput
          hideControls
          label="Cobrado máximo"
          min={0}
          onChange={(value) =>
            set("paidMax", typeof value === "number" ? value : undefined)
          }
          value={state.paidMax ?? ""}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          allowDeselect={false}
          data={[
            { value: "30d", label: "Últimos 30 días" },
            { value: "custom", label: "Periodo personalizado" },
            { value: "all", label: "Histórico" },
          ]}
          onChange={(value) => set("period", (value as Period) || "30d")}
          value={state.period}
          w={190}
        />
        {state.period === "custom" ? (
          <>
            <TextInput
              aria-label="Desde"
              onChange={(event) => set("startDate", event.target.value)}
              type="date"
              value={state.startDate}
            />
            <TextInput
              aria-label="Hasta"
              onChange={(event) => set("endDate", event.target.value)}
              type="date"
              value={state.endDate}
            />
          </>
        ) : null}
        <Button
          leftSection={<X className="size-4" />}
          onClick={filters.clear}
          variant="subtle"
        >
          Limpiar filtros
        </Button>
      </div>
    </>
  );
}

function SalesTable({
  data,
  filters,
  onOpen,
}: {
  data: AdminSalesResponse;
  filters: ReturnType<typeof useAdminSalesFilters>;
  onOpen: (saleId: string) => void;
}) {
  if (data.sales.length === 0) {
    return <EmptyState>No se encontraron ventas con esos filtros.</EmptyState>;
  }
  const { state, toggleSort } = filters;
  return (
    <div className="overflow-auto rounded-xl border border-zinc-800">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <SortHeader
                active={state.sortBy === "createdAt"}
                direction={state.sortDirection}
                label="Fecha"
                onClick={() => toggleSort("createdAt")}
              />
            </Table.Th>
            <Table.Th>
              <SortHeader
                active={state.sortBy === "organizationName"}
                direction={state.sortDirection}
                label="Organización"
                onClick={() => toggleSort("organizationName")}
              />
            </Table.Th>
            <Table.Th>
              <SortHeader
                active={state.sortBy === "sellerName"}
                direction={state.sortDirection}
                label="Vendedor"
                onClick={() => toggleSort("sellerName")}
              />
            </Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th className="text-right">
              <SortHeader
                active={state.sortBy === "totalAmount"}
                direction={state.sortDirection}
                label="Total"
                onClick={() => toggleSort("totalAmount")}
              />
            </Table.Th>
            <Table.Th className="text-right">
              <SortHeader
                active={state.sortBy === "paidAmount"}
                direction={state.sortDirection}
                label="Cobrado"
                onClick={() => toggleSort("paidAmount")}
              />
            </Table.Th>
            <Table.Th className="text-right">Detalle</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.sales.map((sale) => (
            <Table.Tr key={sale.id}>
              <Table.Td className="text-sm text-zinc-300">
                {formatAdminDateTime(sale.createdAt)}
              </Table.Td>
              <Table.Td className="text-white">
                {sale.organizationName}
              </Table.Td>
              <Table.Td className="text-zinc-300">
                {sale.sellerName ?? "—"}
              </Table.Td>
              <Table.Td>
                <Badge tt="none" variant="outline">
                  {formatSaleStatusLabel(sale.status)}
                </Badge>
              </Table.Td>
              <Table.Td className="text-right tabular-nums">
                {formatCurrency(sale.totalAmount)}
              </Table.Td>
              <Table.Td className="text-right font-medium text-[var(--color-voltage)] tabular-nums">
                {formatCurrency(sale.paidAmount)}
              </Table.Td>
              <Table.Td className="text-right">
                <ActionIcon
                  aria-label={`Ver detalle de venta ${sale.id}`}
                  color="gray"
                  onClick={() => onOpen(sale.id)}
                  variant="outline"
                >
                  <Eye aria-hidden="true" className="size-4" />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

function SaleDetailDrawer({
  saleId,
  onClose,
}: {
  saleId: string | null;
  onClose: () => void;
}) {
  const detail = useAdminSaleDetailQuery(saleId);
  let content: ReactNode = null;
  if (detail.isPending) {
    content = (
      <div className="flex h-full items-center justify-center">
        <Loader color="voltage.5" />
      </div>
    );
  } else if (detail.isError) {
    content = (
      <p className="p-6 text-red-300 text-sm">{detail.error.message}</p>
    );
  } else if (detail.data) {
    content = (
      <div className="space-y-6 p-6">
        <div>
          <h2 className="font-semibold text-white text-xl">
            {detail.data.organizationName}
          </h2>
          <p className="text-sm text-zinc-400">
            {formatAdminDateTime(detail.data.createdAt)} ·{" "}
            {detail.data.sellerName ?? "Sin vendedor"} ·{" "}
            {detail.data.terminalName ?? "Sin terminal"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="font-semibold text-white">
              {formatCurrency(detail.data.totalAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">Cobrado</p>
            <p className="font-semibold text-[var(--color-voltage)]">
              {formatCurrency(detail.data.paidAmount)}
            </p>
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-white">Pagos</h3>
          {detail.data.payments.length === 0 ? (
            <EmptyState>Sin pagos registrados.</EmptyState>
          ) : (
            <div className="space-y-2">
              {detail.data.payments.map((payment) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
                  key={payment.id}
                >
                  <div>
                    <p className="text-sm text-white">
                      {formatPaymentMethod(payment.method)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatAdminDateTime(payment.createdAt)}
                    </p>
                  </div>
                  <p className="font-medium text-white">
                    {formatCurrency(payment.appliedAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <Drawer
      onClose={onClose}
      opened={Boolean(saleId)}
      position="right"
      size={620}
      title="Detalle de venta"
    >
      {content}
    </Drawer>
  );
}

export function AdminSalesTab() {
  const filters = useAdminSalesFilters();
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const { state } = filters;
  const status =
    state.status === "completed" ||
    state.status === "credit" ||
    state.status === "cancelled"
      ? state.status
      : undefined;
  const balanceStatus =
    state.balanceStatus === "with_balance" || state.balanceStatus === "settled"
      ? state.balanceStatus
      : undefined;
  const query = useAdminSalesQuery({
    ...state,
    status,
    balanceStatus,
    pageSize: PAGE_SIZE,
  });

  if (query.isPending) {
    return <AdminTabLoading />;
  }
  if (query.isError) {
    return (
      <AdminTabError
        error={query.error}
        fallbackMessage="No se pudieron cargar las ventas."
        onRetry={() => query.refetch()}
        title="Ventas no disponibles"
      />
    );
  }

  const data = query.data;
  const onPageChange = (page: number) => {
    filters.update("page", page, false);
  };
  return (
    <div className="space-y-6">
      <Summary summary={data.summary} />
      <DashboardPanelShell
        description="Consulta ventas de todas las organizaciones con detalle y filtros server-side."
        headerAside={
          <Badge tt="none" variant="outline">
            {formatCount(data.total)} resultados
          </Badge>
        }
        title="Ventas"
      >
        <div className="space-y-4">
          <SalesFilterBar data={data} filters={filters} />
          <SalesTable
            data={data}
            filters={filters}
            onOpen={setSelectedSaleId}
          />
          <div className="flex justify-end">
            <Pagination
              onChange={onPageChange}
              total={Math.max(1, Math.ceil(data.total / data.pageSize))}
              value={data.page}
            />
          </div>
        </div>
      </DashboardPanelShell>
      <SaleDetailDrawer
        onClose={() => setSelectedSaleId(null)}
        saleId={selectedSaleId}
      />
    </div>
  );
}
