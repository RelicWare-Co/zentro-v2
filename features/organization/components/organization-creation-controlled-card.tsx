import { Alert, Button } from "@mantine/core";
import { ShieldAlert } from "lucide-react";
import { OrgCard } from "@/features/organization/components/organization-ui-primitives";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationCreationControlledCard() {
  const { state } = useOrganizationSelectionPage();

  return (
    <OrgCard
      description="La cuenta no puede abrir organizaciones nuevas por sí sola."
      icon={ShieldAlert}
      iconClassName="text-amber-300"
      title="Creación Controlada"
    >
      <Alert color="yellow" title="Solicita acceso al admin" variant="light">
        {state.contactMessage}
      </Alert>
      {state.contactHref ? (
        <Button
          color="gray"
          component="a"
          fullWidth
          href={state.contactHref}
          rel="noreferrer"
          target="_blank"
          variant="outline"
        >
          {state.contactLabel}
        </Button>
      ) : (
        <div className="rounded-2xl border border-zinc-800 border-dashed bg-black/10 p-4 text-sm text-zinc-300">
          {state.contactLabel ?? "Contactar al administrador"}
        </div>
      )}
    </OrgCard>
  );
}
