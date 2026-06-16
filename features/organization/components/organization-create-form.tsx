import { Button, TextInput } from "@mantine/core";
import { Plus } from "lucide-react";
import { OrgCard } from "@/features/organization/components/organization-ui-primitives";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";
import { darkInputStyles } from "@/lib/mantine-dark";

export function OrganizationCreateForm() {
  const { state, actions, meta } = useOrganizationSelectionPage();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        actions.submitCreateOrganization(event).catch(() => undefined);
      }}
    >
      <TextInput
        autoComplete="off"
        disabled={state.isSubmitting}
        id={meta.orgNameInputId}
        label="Nombre de la organización"
        name="organizationName"
        onChange={(event) => actions.setNewOrgName(event.target.value)}
        placeholder="Ej. Tienda Principal..."
        styles={darkInputStyles}
        value={state.newOrgName}
      />
      <div>
        <TextInput
          autoComplete="off"
          disabled={state.isSubmitting}
          id={meta.orgSlugInputId}
          label="Identificador único"
          name="organizationSlug"
          onChange={(event) => actions.setNewOrgSlug(event.target.value)}
          placeholder="tienda-principal"
          styles={darkInputStyles}
          value={state.newOrgSlug}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Se usará en URLs y selección interna.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          className="flex-1"
          color="gray"
          disabled={state.isSubmitting}
          onClick={actions.closeCreateForm}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          c="black"
          className="flex-1"
          color="voltage.5"
          loading={state.isSubmitting}
          type="submit"
        >
          Crear y Entrar
        </Button>
      </div>
    </form>
  );
}

export function OrganizationCreatePrompt() {
  const { actions } = useOrganizationSelectionPage();

  return (
    <Button
      className="h-12 w-full border-dashed"
      color="gray"
      leftSection={<Plus className="size-4" />}
      onClick={actions.openCreateForm}
      type="button"
      variant="outline"
    >
      Crear Nueva Organización
    </Button>
  );
}

export function OrganizationCreateCard() {
  const { state } = useOrganizationSelectionPage();

  return (
    <OrgCard
      description="Usa este flujo solo si no tienes invitación ni join link."
      icon={Plus}
      title="Crear Organización"
    >
      {state.isCreating ? (
        <OrganizationCreateForm />
      ) : (
        <OrganizationCreatePrompt />
      )}
    </OrgCard>
  );
}
