import { CreditCard } from "lucide-react";
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

export function CreditSettingsCard() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, draftSettings } = state;
  const defaultInterestRateId = useId();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-[var(--color-voltage)]" />
          Crédito
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Parámetros base para ventas fiadas y cartera.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SettingsToggleRow
          checked={draftSettings.credit.allowCreditSales}
          description="Controla si checkout puede dejar saldo pendiente."
          disabled={!canManageSettings}
          onCheckedChange={(checked) =>
            actions.updateCredit({ allowCreditSales: checked })
          }
          title="Permitir ventas a crédito"
        />
        <div className="grid gap-2">
          <Label htmlFor={defaultInterestRateId}>
            Tasa de interés por defecto (%)
          </Label>
          <Input
            className="border-zinc-700 bg-black/20"
            disabled={!canManageSettings}
            id={defaultInterestRateId}
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
            type="number"
            value={draftSettings.credit.defaultInterestRate}
          />
        </div>
      </CardContent>
    </Card>
  );
}
