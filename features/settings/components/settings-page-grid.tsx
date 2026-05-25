import { CreditSettingsCard } from "@/features/settings/components/credit-settings-card";
import { InventorySettingsCard } from "@/features/settings/components/inventory-settings-card";
import { LocalPrinterSettingsSection } from "@/features/settings/components/local-printer-settings-section";
import { PosSettingsCard } from "@/features/settings/components/pos-settings-card";
import { RestaurantConfigurationCard } from "@/features/settings/components/restaurant-configuration-card";
import { ThemeSettingsCard } from "@/features/settings/components/theme-settings-card";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function SettingsPageGrid() {
  const { state } = useSettingsPage();
  const data = state.data;

  if (!data) {
    return null;
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-6">
        <ThemeSettingsCard />
        <PosSettingsCard />
        <LocalPrinterSettingsSection organizationId={data.organization.id} />
      </div>
      <div className="space-y-6">
        <RestaurantConfigurationCard />
        <CreditSettingsCard />
        <InventorySettingsCard />
      </div>
    </section>
  );
}
