import { Building2, Package, Settings2, Users } from "lucide-react";
import { SettingsSummaryCard } from "@/features/settings/components/settings-ui-primitives";
import { useSettingsPage } from "@/features/settings/settings-page-context";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function SettingsSummaryCards() {
  const { state } = useSettingsPage();
  const data = state.data;

  if (!data) {
    return null;
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SettingsSummaryCard
        description={`Slug: ${data.organization.slug}`}
        icon={Building2}
        title="Organización activa"
        value={data.organization.name}
      />
      <SettingsSummaryCard
        description={`${data.stats.invitationsCount} invitaciones pendientes`}
        icon={Users}
        title="Equipo"
        value={`${data.stats.membersCount}`}
      />
      <SettingsSummaryCard
        description={`${data.stats.customersCount} clientes registrados`}
        icon={Package}
        title="Catálogo"
        value={`${data.stats.productsCount}`}
      />
      <SettingsSummaryCard
        description="Perfil de organización"
        icon={Settings2}
        title="Creada"
        value={dateFormatter.format(data.organization.createdAt)}
      />
    </section>
  );
}
