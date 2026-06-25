import { Button, Divider, TextInput } from "@mantine/core";
import { Plus, Store } from "lucide-react";
import {
  SettingsCard,
  SettingsToggleControl,
} from "@/features/settings/components/settings-ui-primitives";
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

  return (
    <SettingsCard
      description="Valores por defecto para apertura de turno y checkout."
      icon={Store}
      title="Caja y POS"
    >
      <TextInput
        disabled={!canManageSettings}
        label="Nombre por defecto de caja"
        onChange={(event) =>
          actions.updatePosField("defaultTerminalName", event.target.value)
        }
        placeholder="Ej. Caja principal"
        value={draftSettings.pos.defaultTerminalName}
      />

      <TextInput
        disabled={!canManageSettings}
        inputMode="numeric"
        label="Base inicial sugerida"
        onChange={(event) =>
          actions.updatePosField(
            "defaultStartingCash",
            parseMoneyInput(event.target.value)
          )
        }
        placeholder="0"
        type="text"
        value={formatMoneyInput(draftSettings.pos.defaultStartingCash)}
      />

      <Divider color="dark.4" />

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
                  <TextInput
                    disabled={!canManageSettings}
                    label="Nombre visible"
                    onChange={(event) =>
                      actions.updatePaymentMethod(paymentMethod.id, {
                        label: event.target.value,
                      })
                    }
                    placeholder="Ej. Tarjeta débito"
                    value={paymentMethod.label}
                  />
                  <p className="text-xs text-zinc-500">
                    Código interno:{" "}
                    <span className="text-zinc-400">{paymentMethod.id}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <SettingsToggleControl
                    checked={paymentMethod.enabled}
                    disabled={!canManageSettings || paymentMethod.id === "cash"}
                    label="Activo"
                    onCheckedChange={(checked) =>
                      actions.updatePaymentMethod(paymentMethod.id, {
                        enabled: checked,
                      })
                    }
                  />
                  <SettingsToggleControl
                    checked={paymentMethod.requiresReference}
                    disabled={!canManageSettings || paymentMethod.id === "cash"}
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
              <TextInput
                disabled={!canManageSettings}
                label="Agregar método personalizado"
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
              color="gray"
              disabled={!canManageSettings}
              leftSection={<Plus className="size-4" />}
              onClick={actions.addPaymentMethod}
              type="button"
              variant="outline"
            >
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
    </SettingsCard>
  );
}
