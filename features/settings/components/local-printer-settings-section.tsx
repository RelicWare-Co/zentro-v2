import { Settings2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { PrinterSettingsProvider } from "@/features/pos/printing/printer-settings-context.client";
import { SettingsCard } from "@/features/settings/components/settings-ui-primitives";

const LocalPrinterSettingsCard = lazy(() =>
  import(
    "@/features/settings/components/local-printer-settings-card.client"
  ).then((mod) => ({ default: mod.LocalPrinterSettingsCard }))
);

function LocalPrinterSettingsFallback() {
  return (
    <SettingsCard
      description="Cargando configuración de impresora…"
      icon={Settings2}
      title="Impresión local"
    >
      <div />
    </SettingsCard>
  );
}

export function LocalPrinterSettingsSection({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <PrinterSettingsProvider organizationId={organizationId}>
      <Suspense fallback={<LocalPrinterSettingsFallback />}>
        <LocalPrinterSettingsCard />
      </Suspense>
    </PrinterSettingsProvider>
  );
}
