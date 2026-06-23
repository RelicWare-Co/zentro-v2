import { TextInput } from "@mantine/core";
import { Package } from "lucide-react";
import {
  SettingsCard,
  SettingsToggleRow,
} from "@/features/settings/components/settings-ui-primitives";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function InventorySettingsCard() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, draftSettings } = state;

  return (
    <SettingsCard
      description="Defaults para catálogo y alertas operativas."
      icon={Package}
      title="Inventario"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          disabled={!canManageSettings}
          label="Umbral de stock bajo"
          min={0}
          onChange={(event) =>
            actions.updateInventory({
              lowStockThreshold: Math.max(0, Number(event.target.value) || 0),
            })
          }
          placeholder="5"
          type="number"
          value={draftSettings.inventory.lowStockThreshold}
        />
        <TextInput
          disabled={!canManageSettings}
          label="Impuesto por defecto (%)"
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
    </SettingsCard>
  );
}
