import { Loader2, Plus } from "lucide-react";
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
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationCreateForm() {
  const { state, actions, meta } = useOrganizationSelectionPage();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        actions.submitCreateOrganization(event).catch(() => undefined);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={meta.orgNameInputId}>Nombre de la organización</Label>
        <Input
          autoComplete="off"
          className="border-zinc-800 bg-black/30"
          disabled={state.isSubmitting}
          id={meta.orgNameInputId}
          name="organizationName"
          onChange={(event) => actions.setNewOrgName(event.target.value)}
          placeholder="Ej. Tienda Principal..."
          value={state.newOrgName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={meta.orgSlugInputId}>Identificador único</Label>
        <Input
          autoComplete="off"
          className="border-zinc-800 bg-black/30"
          disabled={state.isSubmitting}
          id={meta.orgSlugInputId}
          name="organizationSlug"
          onChange={(event) => actions.setNewOrgSlug(event.target.value)}
          placeholder="tienda-principal"
          value={state.newOrgSlug}
        />
        <p className="text-xs text-zinc-500">
          Se usará en URLs y selección interna.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button
          className="flex-1 border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
          disabled={state.isSubmitting}
          onClick={actions.closeCreateForm}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={state.isSubmitting}
          type="submit"
        >
          {state.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creando…
            </>
          ) : (
            "Crear y Entrar"
          )}
        </Button>
      </div>
    </form>
  );
}

export function OrganizationCreatePrompt() {
  const { actions } = useOrganizationSelectionPage();

  return (
    <Button
      className="h-12 w-full border-zinc-700 border-dashed bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
      onClick={actions.openCreateForm}
      type="button"
      variant="outline"
    >
      <Plus className="size-4" />
      Crear Nueva Organización
    </Button>
  );
}

export function OrganizationCreateCard() {
  const { state } = useOrganizationSelectionPage();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-4 text-[var(--color-voltage)]" />
          Crear Organización
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Usa este flujo solo si no tienes invitación ni join link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.isCreating ? (
          <OrganizationCreateForm />
        ) : (
          <OrganizationCreatePrompt />
        )}
      </CardContent>
    </Card>
  );
}
