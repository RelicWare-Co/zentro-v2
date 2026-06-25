import { Badge, Button } from "@mantine/core";
import { Save } from "lucide-react";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function SettingsPageHeader() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, hasChanges, isSaving } = state;

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <Badge color="voltage" radius="xl" tt="none" variant="light">
          Configuración
        </Badge>
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            Ajustes del negocio
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
            Reglas operativas para caja, pagos, crédito, inventario y módulos.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          color="gray"
          disabled={!(canManageSettings && hasChanges) || isSaving}
          onClick={actions.resetDraft}
          type="button"
          variant="outline"
        >
          Restablecer
        </Button>
        <Button
          c="black"
          color="voltage.5"
          disabled={!(canManageSettings && hasChanges)}
          leftSection={<Save className="size-4" />}
          loading={isSaving}
          onClick={() => {
            actions.save().catch(() => undefined);
          }}
          type="button"
        >
          Guardar cambios
        </Button>
      </div>
    </section>
  );
}
