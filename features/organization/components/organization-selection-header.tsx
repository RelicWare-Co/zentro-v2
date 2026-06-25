import { Badge, Button } from "@mantine/core";
import { LogOut } from "lucide-react";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationSelectionHeader() {
  const { actions } = useOrganizationSelectionPage();

  return (
    <>
      <div className="flex items-start justify-end">
        <Button
          color="gray"
          leftSection={<LogOut className="size-4" />}
          onClick={() => {
            actions.signOut().catch(() => undefined);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Cerrar sesión
        </Button>
      </div>

      <div className="space-y-3 text-center">
        <Badge color="voltage" radius="xl" tt="none" variant="light">
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
