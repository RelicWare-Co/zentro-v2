import type { ReactNode } from "react";
import { CreditSettingsCard } from "@/features/settings/components/credit-settings-card";
import { InventorySettingsCard } from "@/features/settings/components/inventory-settings-card";
import { PosSettingsCard } from "@/features/settings/components/pos-settings-card";
import { RestaurantConfigurationCard } from "@/features/settings/components/restaurant-configuration-card";
import { SettingsPageAlerts } from "@/features/settings/components/settings-page-alerts";
import { SettingsPageGrid } from "@/features/settings/components/settings-page-grid";
import { SettingsPageHeader } from "@/features/settings/components/settings-page-header";
import {
  SettingsPageError,
  SettingsPageLoading,
} from "@/features/settings/components/settings-page-states";
import { SettingsSummaryCards } from "@/features/settings/components/settings-summary-cards";
import { ThemeSettingsCard } from "@/features/settings/components/theme-settings-card";
import {
  SettingsPageProvider,
  useSettingsPage,
} from "@/features/settings/settings-page-context";

function SettingsPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function SettingsPageLayout() {
  const { state } = useSettingsPage();

  if (state.isPending) {
    return <SettingsPageLoading />;
  }

  if (state.isError) {
    return <SettingsPageError />;
  }

  return (
    <SettingsPageRoot>
      <SettingsPageHeader />
      <SettingsPageAlerts />
      <SettingsSummaryCards />
      <SettingsPageGrid />
    </SettingsPageRoot>
  );
}

export function SettingsPage() {
  return (
    <SettingsPageProvider>
      <SettingsPageLayout />
    </SettingsPageProvider>
  );
}

export const SettingsPageCompound = {
  Provider: SettingsPageProvider,
  Root: SettingsPageRoot,
  Header: SettingsPageHeader,
  Alerts: SettingsPageAlerts,
  Summary: SettingsSummaryCards,
  Grid: SettingsPageGrid,
  ThemeCard: ThemeSettingsCard,
  PosCard: PosSettingsCard,
  CreditCard: CreditSettingsCard,
  InventoryCard: InventorySettingsCard,
  RestaurantCard: RestaurantConfigurationCard,
};
