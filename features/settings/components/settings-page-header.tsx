import { Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function SettingsPageHeader() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, hasChanges, isSaving } = state;

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
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
          className="border-zinc-700 bg-[var(--color-carbon)] text-zinc-200 hover:bg-white/5 hover:text-white"
          disabled={!(canManageSettings && hasChanges) || isSaving}
          onClick={actions.resetDraft}
          type="button"
          variant="outline"
        >
          Restablecer
        </Button>
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={!(canManageSettings && hasChanges) || isSaving}
          onClick={() => {
            actions.save().catch(() => undefined);
          }}
          type="button"
        >
          <Save className="size-4" />
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </section>
  );
}
