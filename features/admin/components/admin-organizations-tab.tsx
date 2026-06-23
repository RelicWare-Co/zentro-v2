import { ActionIcon, Badge, TextInput } from "@mantine/core";
import { Building2, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  formatCount,
  formatCurrency,
} from "@/features/dashboard/dashboard-formatters.shared";

function OrganizationsSummaryCards({
  organizations,
}: {
  organizations: AdminOrganizationSummary[];
}) {
  const totalRevenue30d = organizations.reduce(
    (total, org) => total + org.revenue30d,
    0
  );
  const totalMembers = organizations.reduce(
    (total, org) => total + org.membersCount,
    0
  );
  const activeToday = organizations.filter(
    (org) => org.salesCountToday > 0
  ).length;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CompactStatCard
        description="Organizaciones registradas"
        icon={Building2}
        title="Total"
        value={formatCount(organizations.length)}
      />
      <CompactStatCard
        description="Con ventas hoy"
        icon={Building2}
        title="Activas hoy"
        value={formatCount(activeToday)}
      />
      <CompactStatCard
        description="Sumando todas"
        icon={Building2}
        title="Ingresos (30 días)"
        value={formatCurrency(totalRevenue30d)}
      />
      <CompactStatCard
        description="En todas las organizaciones"
        icon={Building2}
        title="Miembros"
        value={formatCount(totalMembers)}
      />
    </section>
  );
}

function OrganizationsTable({
  organizations,
}: {
  organizations: AdminOrganizationSummary[];
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
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="px-4 text-zinc-400">Organización</TableHead>
            <TableHead className="text-right text-zinc-400">Miembros</TableHead>
            <TableHead className="text-right text-zinc-400">
              Ingresos hoy
            </TableHead>
            <TableHead className="text-right text-zinc-400">
              Ingresos 30d
            </TableHead>
            <TableHead className="hidden text-zinc-400 lg:table-cell">
              Última venta
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
              <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                {formatCount(org.membersCount)}
              </TableCell>
              <TableCell
                className={`text-right text-sm tabular-nums ${org.salesCountToday > 0 ? "font-medium text-white" : "text-zinc-500"}`}
              >
                {formatCurrency(org.revenueToday)}
              </TableCell>
              <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                {formatCurrency(org.revenue30d)}
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
                  <ExternalLink className="size-3.5" />
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
  const organizationsQuery = useAdminOrganizationsQuery();
  const [search, setSearch] = useState("");

  const organizations = organizationsQuery.data?.organizations ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return organizations;
    }
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        org.slug.toLowerCase().includes(query)
    );
  }, [organizations, search]);

  if (organizationsQuery.isPending) {
    return <AdminTabLoading />;
  }

  if (organizationsQuery.isError) {
    return (
      <AdminTabError
        error={organizationsQuery.error}
        fallbackMessage="Ocurrió un error al cargar las organizaciones. Intenta de nuevo."
        title="No se pudieron cargar las organizaciones"
      />
    );
  }

  return (
    <div className="space-y-6">
      <OrganizationsSummaryCards organizations={organizations} />
      <DashboardPanelShell
        description="Busca y administra las organizaciones de la plataforma."
        headerAside={
          <Badge
            className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
            tt="none"
            variant="outline"
          >
            {formatCount(filtered.length)} de{" "}
            {formatCount(organizations.length)}
          </Badge>
        }
        title="Organizaciones"
      >
        <div className="space-y-4">
          <div className="max-w-sm">
            <TextInput
              leftSection={<Search className="size-4" />}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o slug…"
              value={search}
            />
          </div>
          <OrganizationsTable organizations={filtered} />
        </div>
      </DashboardPanelShell>
    </div>
  );
}
