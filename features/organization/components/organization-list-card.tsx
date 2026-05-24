import { ArrowRight, Building2, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationListCard() {
  const { state, actions } = useOrganizationSelectionPage();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-[var(--color-voltage)]" />
          Tus Organizaciones
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Entrar a un espacio existente mantiene intacto el selector actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  <p className="truncate font-semibold text-white">
                    {org.name}
                  </p>
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
      </CardContent>
    </Card>
  );
}
