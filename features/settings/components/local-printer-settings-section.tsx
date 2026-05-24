import { Settings2 } from "lucide-react";
import { lazy, Suspense } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrinterSettingsProvider } from "@/features/pos/printing/printer-settings-context.client";

const LocalPrinterSettingsCard = lazy(() =>
  import(
    "@/features/settings/components/local-printer-settings-card.client"
  ).then((mod) => ({ default: mod.LocalPrinterSettingsCard }))
);

function LocalPrinterSettingsFallback() {
  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-[var(--color-voltage)]" />
          Impresión local
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Cargando configuración de impresora…
        </CardDescription>
      </CardHeader>
    </Card>
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
