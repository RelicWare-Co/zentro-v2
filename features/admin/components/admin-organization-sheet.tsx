import { Badge, Drawer, Loader, Switch } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Boxes,
  Building2,
  Package,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatActivationPolicyLabel,
  formatAdminDateTime,
  formatOrganizationRoleLabel,
  formatSaleStatusLabel,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import {
  type AdminModuleState,
  type AdminOrganizationDetail,
  useAdminOrganizationDetailQuery,
  useSetOrganizationModuleMutation,
} from "@/features/admin/hooks/use-admin-platform";
import {
  CompactStatCard,
  EmptyState,
} from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  formatCompactCurrency,
  formatCount,
} from "@/features/dashboard/dashboard-formatters.shared";
import { formatCurrency } from "@/lib/format-currency.shared";
import { getErrorMessage } from "@/lib/utils";

const trendDayFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

function formatTrendDay(dateKey: string) {
  return trendDayFormatter.format(new Date(`${dateKey}T12:00:00`));
}

function OrganizationMetrics({ detail }: { detail: AdminOrganizationDetail }) {
  const { metrics } = detail;

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <CompactStatCard
        description={`${formatCount(metrics.salesCountToday)} ventas hoy`}
        icon={Wallet}
        title="Ingresos de hoy"
        value={formatCurrency(metrics.revenueToday)}
      />
      <CompactStatCard
        description={`${formatCount(metrics.salesCount30d)} ventas en 30 días`}
        icon={Receipt}
        title="Ingresos (30 días)"
        value={formatCurrency(metrics.revenue30d)}
      />
      <CompactStatCard
        description={`${formatCount(metrics.customersCount)} clientes · ${formatCount(metrics.productsCount)} productos`}
        icon={Package}
        title="Ingresos totales"
        value={formatCurrency(metrics.totalRevenue)}
      />
      <CompactStatCard
        description={
          metrics.lastSaleAt
            ? `Última venta ${formatAdminDateTime(metrics.lastSaleAt)}`
            : "Sin ventas registradas"
        }
        icon={Users}
        title="Miembros"
        value={formatCount(metrics.membersCount)}
      />
    </section>
  );
}

function ModuleRow({
  module,
  organizationId,
}: {
  module: AdminModuleState;
  organizationId: string;
}) {
  const setModule = useSetOrganizationModuleMutation();
  const isGranted = module.entitlementStatus === "granted";

  const handleToggle = async (checked: boolean) => {
    try {
      await setModule.mutateAsync({
        organizationId,
        moduleKey: module.key,
        status: checked ? "granted" : "blocked",
      });
      notifications.show({
        message: checked
          ? `Módulo "${module.label}" habilitado.`
          : `Módulo "${module.label}" bloqueado.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo actualizar el módulo."),
        color: "red",
      });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm text-white">
            {module.label}
          </p>
          {module.enabled ? (
            <Badge color="voltage.5" tt="none" variant="light">
              Activo
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-zinc-500">
          {formatActivationPolicyLabel(module.activationPolicy)}
        </p>
      </div>
      <Switch
        aria-label={`Permiso del módulo ${module.label}`}
        checked={isGranted}
        color="voltage.5"
        disabled={setModule.isPending}
        onChange={(event) => {
          handleToggle(event.currentTarget.checked).catch(() => undefined);
        }}
      />
    </div>
  );
}

function OrganizationModules({ detail }: { detail: AdminOrganizationDetail }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="size-4 text-zinc-400" />
        <h3 className="font-semibold text-sm text-white">Módulos</h3>
      </div>
      <div className="space-y-2">
        {detail.modules.map((module) => (
          <ModuleRow
            key={module.key}
            module={module}
            organizationId={detail.organization.id}
          />
        ))}
      </div>
    </section>
  );
}

function OrganizationTrend({ detail }: { detail: AdminOrganizationDetail }) {
  const trend = detail.salesTrend;
  const maxRevenue = Math.max(1, ...trend.map((point) => point.revenue));
  const hasData = trend.some((point) => point.revenue > 0);

  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-sm text-white">
        Ventas de los últimos 7 días
      </h3>
      {hasData ? (
        <div className="grid h-32 grid-cols-7 gap-2">
          {trend.map((point) => {
            const barHeight = Math.max(
              point.revenue > 0 ? 10 : 4,
              (point.revenue / maxRevenue) * 100
            );

            return (
              <div
                className="flex h-full min-w-0 flex-col justify-end"
                key={point.dateKey}
                title={`${formatTrendDay(point.dateKey)}: ${formatCurrency(point.revenue)} · ${formatCount(point.salesCount)} ventas`}
              >
                <div className="flex h-20 items-end border-zinc-800/80 border-b">
                  <div
                    className={
                      point.revenue > 0
                        ? "w-full rounded-t-md bg-gradient-to-t from-[var(--color-voltage)] to-[#f1ff87] transition-all"
                        : "w-full rounded-full bg-zinc-800 transition-all"
                    }
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <div className="mt-2 truncate text-center text-[10px] text-zinc-400">
                  {formatTrendDay(point.dateKey)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState>No hay ventas en los últimos 7 días.</EmptyState>
      )}
    </section>
  );
}

function OrganizationMembers({ detail }: { detail: AdminOrganizationDetail }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-sm text-white">
        Miembros ({formatCount(detail.members.length)})
      </h3>
      {detail.members.length === 0 ? (
        <EmptyState>Esta organización no tiene miembros.</EmptyState>
      ) : (
        <div className="space-y-2">
          {detail.members.map((member) => (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4"
              key={member.id}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium text-sm text-white">
                  {member.name}
                </p>
                <p className="truncate text-xs text-zinc-500">{member.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {member.banned ? (
                  <Badge
                    className="border-red-500/20 bg-red-500/10 text-red-200"
                    tt="none"
                    variant="outline"
                  >
                    Suspendido
                  </Badge>
                ) : null}
                <Badge
                  className="border-zinc-700 bg-black/20 text-zinc-300"
                  tt="none"
                  variant="outline"
                >
                  {formatOrganizationRoleLabel(member.role)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OrganizationRecentSales({
  detail,
}: {
  detail: AdminOrganizationDetail;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-sm text-white">Ventas recientes</h3>
      {detail.recentSales.length === 0 ? (
        <EmptyState>Aún no hay ventas registradas.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="px-4 text-zinc-400">Fecha</TableHead>
                <TableHead className="text-zinc-400">Vendedor</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-right text-zinc-400">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recentSales.map((sale) => (
                <TableRow
                  className="border-zinc-800 hover:bg-white/[0.02]"
                  key={sale.id}
                >
                  <TableCell className="px-4 text-sm text-zinc-300">
                    {formatAdminDateTime(sale.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {sale.sellerName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="border-zinc-700 bg-black/20 text-zinc-300"
                      tt="none"
                      variant="outline"
                    >
                      {formatSaleStatusLabel(sale.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm text-white tabular-nums">
                    {formatCurrency(sale.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function AdminOrganizationSheetContent({
  organizationId,
}: {
  organizationId: string;
}) {
  const detailQuery = useAdminOrganizationDetailQuery(organizationId);

  if (detailQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader color="voltage.5" size="md" />
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-zinc-800 border-b p-6">
          <p className="text-zinc-400">No se pudo cargar el detalle.</p>
        </div>
        <div className="flex-1 p-6">
          <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
            {getErrorMessage(
              detailQuery.error,
              "No se pudo cargar el detalle de la organización."
            )}
          </p>
        </div>
      </div>
    );
  }

  const detail = detailQuery.data;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-zinc-800 border-b p-6">
        <h2 className="flex items-center gap-2 font-bold text-2xl text-white">
          <Building2 className="size-5 text-[var(--color-voltage)]" />
          {detail.organization.name}
        </h2>
        <p className="mt-1 text-zinc-400">
          {detail.organization.slug} · Creada{" "}
          {formatAdminDateTime(detail.organization.createdAt)} ·{" "}
          {formatCompactCurrency(detail.metrics.totalRevenue)} históricos
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <OrganizationMetrics detail={detail} />
        <OrganizationTrend detail={detail} />
        <OrganizationModules detail={detail} />
        <OrganizationMembers detail={detail} />
        <OrganizationRecentSales detail={detail} />
      </div>
    </div>
  );
}

export function AdminOrganizationSheet() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "organization";
  const organizationId =
    state.activeOverlay?.type === "organization"
      ? state.activeOverlay.organizationId
      : null;

  return (
    <Drawer
      onClose={actions.closeOverlay}
      opened={isOpen}
      position="right"
      size={640}
      title="Detalle de organización"
    >
      {organizationId ? (
        <AdminOrganizationSheetContent
          key={organizationId}
          organizationId={organizationId}
        />
      ) : null}
    </Drawer>
  );
}
