import { TextInput } from "@mantine/core";
import { CreditCard } from "lucide-react";
import {
  SettingsCard,
  SettingsToggleRow,
} from "@/features/settings/components/settings-ui-primitives";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function CreditSettingsCard() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, draftSettings } = state;

  return (
    <SettingsCard
      description="Parámetros base para ventas fiadas y cartera."
      icon={CreditCard}
      title="Crédito"
    >
      <SettingsToggleRow
        checked={draftSettings.credit.allowCreditSales}
        description="Controla si checkout puede dejar saldo pendiente."
        disabled={!canManageSettings}
        onCheckedChange={(checked) =>
          actions.updateCredit({ allowCreditSales: checked })
        }
        title="Permitir ventas a crédito"
      />
      <TextInput
        disabled={!canManageSettings}
        label="Tasa de interés por defecto (%)"
        max={100}
        min={0}
        onChange={(event) =>
          actions.updateCredit({
            defaultInterestRate: Math.min(
              100,
              Math.max(0, Number(event.target.value) || 0)
            ),
          })
        }
        placeholder="0"
        type="number"
        value={draftSettings.credit.defaultInterestRate}
      />
    </SettingsCard>
  );
}
