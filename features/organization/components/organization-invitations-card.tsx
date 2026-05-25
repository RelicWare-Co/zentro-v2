import { Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { organizationDateTimeFormatter } from "@/features/organization/organization-formatters.shared";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";

export function OrganizationInvitationsCard() {
  const { state, actions } = useOrganizationSelectionPage();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-[var(--color-voltage)]" />
          Invitaciones Pendientes
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Si ya te invitaron, puedes entrar directo desde aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.invitations.length > 0 ? (
          state.invitations.map((invitation) => (
            <div
              className="rounded-2xl border border-zinc-800 bg-black/20 p-4"
              key={invitation.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {invitation.organizationName}
                  </p>
                  <p className="truncate text-sm text-zinc-400">
                    /{invitation.organizationSlug}
                  </p>
                </div>
                <Badge
                  className="border-sky-500/30 bg-sky-500/10 text-sky-200"
                  variant="outline"
                >
                  {formatOrganizationRoleLabel(invitation.role)}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Expira{" "}
                {invitation.expiresAt
                  ? organizationDateTimeFormatter.format(invitation.expiresAt)
                  : "sin fecha"}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                  disabled={
                    state.isAcceptingInvitationId !== null ||
                    state.isRejectingInvitationId !== null
                  }
                  onClick={() => {
                    actions.acceptInvitation(invitation).catch(() => undefined);
                  }}
                  type="button"
                >
                  {state.isAcceptingInvitationId === invitation.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Entrando…
                    </>
                  ) : (
                    "Entrar Ahora"
                  )}
                </Button>
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
                  disabled={
                    state.isAcceptingInvitationId !== null ||
                    state.isRejectingInvitationId !== null
                  }
                  onClick={() => {
                    actions
                      .rejectInvitation(invitation.id)
                      .catch(() => undefined);
                  }}
                  type="button"
                  variant="outline"
                >
                  {state.isRejectingInvitationId === invitation.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Rechazando…
                    </>
                  ) : (
                    "Rechazar"
                  )}
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-zinc-800 border-dashed bg-black/10 p-6 text-sm text-zinc-400">
            No hay invitaciones pendientes para esta cuenta.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
