import { Package } from "lucide-react";
import { useId } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsToggleRow } from "@/features/settings/components/settings-ui-primitives";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function InventorySettingsCard() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, draftSettings } = state;
  const lowStockThresholdId = useId();
  const defaultTaxRateId = useId();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-4 text-[var(--color-voltage)]" />
          Inventario
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Defaults para catálogo y alertas operativas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={lowStockThresholdId}>Umbral de stock bajo</Label>
            <Input
              className="border-zinc-700 bg-black/20"
              disabled={!canManageSettings}
              id={lowStockThresholdId}
              min={0}
              onChange={(event) =>
                actions.updateInventory({
                  lowStockThreshold: Math.max(
                    0,
                    Number(event.target.value) || 0
                  ),
                })
              }
              placeholder="5"
              type="number"
              value={draftSettings.inventory.lowStockThreshold}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={defaultTaxRateId}>Impuesto por defecto (%)</Label>
            <Input
              className="border-zinc-700 bg-black/20"
              disabled={!canManageSettings}
              id={defaultTaxRateId}
              max={100}
              min={0}
              onChange={(event) =>
                actions.updateInventory({
                  defaultTaxRate: Math.min(
                    100,
                    Math.max(0, Number(event.target.value) || 0)
                  ),
                })
              }
              placeholder="19"
              type="number"
              value={draftSettings.inventory.defaultTaxRate}
            />
          </div>
        </div>
        <SettingsToggleRow
          checked={draftSettings.inventory.trackInventoryByDefault}
          description="Preferencia inicial para altas de productos."
          disabled={!canManageSettings}
          onCheckedChange={(checked) =>
            actions.updateInventory({ trackInventoryByDefault: checked })
          }
          title="Controlar inventario en productos nuevos"
        />
        <SettingsToggleRow
          checked={draftSettings.inventory.modifiersEnabledByDefault}
          description="Útil para extras y adiciones frecuentes."
          disabled={!canManageSettings}
          onCheckedChange={(checked) =>
            actions.updateInventory({ modifiersEnabledByDefault: checked })
          }
          title="Permitir modificadores por defecto"
        />
      </CardContent>
    </Card>
  );
}
