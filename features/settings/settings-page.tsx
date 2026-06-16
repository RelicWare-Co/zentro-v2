import type { ReactNode } from "react";
import { SettingsPageAlerts } from "@/features/settings/components/settings-page-alerts";
import { SettingsPageGrid } from "@/features/settings/components/settings-page-grid";
import { SettingsPageHeader } from "@/features/settings/components/settings-page-header";
import {
  SettingsPageError,
  SettingsPageLoading,
} from "@/features/settings/components/settings-page-states";
import { SettingsSummaryCards } from "@/features/settings/components/settings-summary-cards";
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
