import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationSelectionHeader() {
  const { actions } = useOrganizationSelectionPage();

  return (
    <>
      <div className="flex items-start justify-end">
        <Button
          className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
          onClick={() => {
            actions.signOut().catch(() => undefined);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <LogOut className="mr-2 size-4" />
          Cerrar sesión
        </Button>
      </div>

      <div className="space-y-3 text-center">
        <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
          Acceso a organizaciones
        </Badge>
        <h1 className="text-balance font-semibold text-3xl tracking-tight md:text-4xl">
          Elige Cómo Quieres Entrar
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-zinc-400 md:text-base">
          Selecciona una organización existente, acepta una invitación en la app
          o crea un nuevo espacio si tu cuenta todavía lo tiene habilitado.
        </p>
      </div>
    </>
  );
}
