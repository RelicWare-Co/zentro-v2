import { Plus, Store } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SettingsToggleControl } from "@/features/settings/components/settings-ui-primitives";
import { useSettingsPage } from "@/features/settings/settings-page-context";
import { formatMoneyInput, parseMoneyInput } from "@/lib/utils";

export function PosSettingsCard() {
  const { actions, state } = useSettingsPage();
  const {
    canManageSettings,
    draftSettings,
    newPaymentMethodLabel,
    newPaymentMethodSlug,
    paymentMethodDraftError,
  } = state;

  const defaultTerminalNameId = useId();
  const defaultStartingCashId = useId();
  const newPaymentMethodId = useId();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="size-4 text-[var(--color-voltage)]" />
          Caja y POS
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Valores por defecto para apertura de turno y checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor={defaultTerminalNameId}>
            Nombre por defecto de caja
          </Label>
          <Input
            className="border-zinc-700 bg-black/20"
            disabled={!canManageSettings}
            id={defaultTerminalNameId}
            onChange={(event) =>
              actions.updatePosField("defaultTerminalName", event.target.value)
            }
            value={draftSettings.pos.defaultTerminalName}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={defaultStartingCashId}>Base inicial sugerida</Label>
          <Input
            className="border-zinc-700 bg-black/20"
            disabled={!canManageSettings}
            id={defaultStartingCashId}
            inputMode="numeric"
            onChange={(event) =>
              actions.updatePosField(
                "defaultStartingCash",
                parseMoneyInput(event.target.value)
              )
            }
            type="text"
            value={formatMoneyInput(draftSettings.pos.defaultStartingCash)}
          />
        </div>

        <Separator className="bg-zinc-800" />

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-white">Métodos de pago</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Configura etiquetas, disponibilidad y referencia obligatoria.
            </p>
          </div>

          <div className="space-y-3">
            {draftSettings.pos.paymentMethods.map((paymentMethod) => (
              <div
                className="rounded-2xl border border-zinc-800 bg-black/20 p-4"
                key={paymentMethod.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`payment-method-${paymentMethod.id}`}>
                        Nombre visible
                      </Label>
                      <Input
                        className="border-zinc-700 bg-black/20"
                        disabled={!canManageSettings}
                        id={`payment-method-${paymentMethod.id}`}
                        onChange={(event) =>
                          actions.updatePaymentMethod(paymentMethod.id, {
                            label: event.target.value,
                          })
                        }
                        value={paymentMethod.label}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Código interno:{" "}
                      <span className="text-zinc-400">{paymentMethod.id}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <SettingsToggleControl
                      checked={paymentMethod.enabled}
                      disabled={
                        !canManageSettings || paymentMethod.id === "cash"
                      }
                      label="Activo"
                      onCheckedChange={(checked) =>
                        actions.updatePaymentMethod(paymentMethod.id, {
                          enabled: checked,
                        })
                      }
                    />
                    <SettingsToggleControl
                      checked={paymentMethod.requiresReference}
                      disabled={
                        !canManageSettings || paymentMethod.id === "cash"
                      }
                      label="Requiere referencia"
                      onCheckedChange={(checked) =>
                        actions.updatePaymentMethod(paymentMethod.id, {
                          requiresReference: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-zinc-700 border-dashed bg-black/10 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor={newPaymentMethodId}>
                  Agregar método personalizado
                </Label>
                <Input
                  className="border-zinc-700 bg-black/20"
                  disabled={!canManageSettings}
                  id={newPaymentMethodId}
                  onChange={(event) =>
                    actions.setNewPaymentMethodLabel(event.target.value)
                  }
                  placeholder="Ej. Daviplata, QR, Zelle"
                  value={newPaymentMethodLabel}
                />
                <p className="text-xs text-zinc-500">
                  Código interno:{" "}
                  <span className="text-zinc-400">
                    {newPaymentMethodSlug || "Se genera automáticamente"}
                  </span>
                </p>
              </div>
              <Button
                className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                disabled={!canManageSettings}
                onClick={actions.addPaymentMethod}
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
            {paymentMethodDraftError ? (
              <p className="mt-3 text-red-400 text-sm">
                {paymentMethodDraftError}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
