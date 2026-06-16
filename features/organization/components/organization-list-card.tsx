import { ArrowRight, Building2, Loader2 } from "lucide-react";
import { OrgCard } from "@/features/organization/components/organization-ui-primitives";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationListCard() {
  const { state, actions } = useOrganizationSelectionPage();

  return (
    <OrgCard
      description="Entrar a un espacio existente mantiene intacto el selector actual."
      icon={Building2}
      title="Tus Organizaciones"
    >
      {state.organizations.length > 0 ? (
        state.organizations.map((org) => (
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-black/20 p-4 text-left transition-colors hover:border-[var(--color-voltage)]/40 hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={state.isSelectingId !== null}
            key={org.id}
            onClick={() => {
              actions.selectOrganization(org.id).catch(() => undefined);
            }}
            type="button"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{org.name}</p>
                <p className="truncate text-sm text-zinc-400">/{org.slug}</p>
              </div>
            </div>
            {state.isSelectingId === org.id ? (
              <Loader2 className="size-5 animate-spin text-[var(--color-voltage)]" />
            ) : (
              <ArrowRight className="size-5 text-zinc-500" />
            )}
          </button>
        ))
      ) : (
        <div className="rounded-2xl border border-zinc-800 border-dashed bg-black/10 p-8 text-center">
          <p className="text-sm text-zinc-300">
            Tu cuenta aún no pertenece a ninguna organización.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Usa una invitación o un join link para entrar sin crear una nueva.
          </p>
        </div>
      )}
    </OrgCard>
  );
}
