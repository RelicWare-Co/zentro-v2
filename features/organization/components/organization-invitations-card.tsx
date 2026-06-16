import { Badge, Button } from "@mantine/core";
import { Mail } from "lucide-react";
import { OrgCard } from "@/features/organization/components/organization-ui-primitives";
import { organizationDateTimeFormatter } from "@/features/organization/organization-formatters.shared";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";

export function OrganizationInvitationsCard() {
  const { state, actions } = useOrganizationSelectionPage();
  const isBusy =
    state.isAcceptingInvitationId !== null ||
    state.isRejectingInvitationId !== null;

  return (
    <OrgCard
      description="Si ya te invitaron, puedes entrar directo desde aquí."
      icon={Mail}
      title="Invitaciones Pendientes"
    >
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
                tt="none"
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
                c="black"
                color="voltage.5"
                disabled={isBusy}
                loading={state.isAcceptingInvitationId === invitation.id}
                onClick={() => {
                  actions.acceptInvitation(invitation).catch(() => undefined);
                }}
                type="button"
              >
                Entrar Ahora
              </Button>
              <Button
                color="gray"
                disabled={isBusy}
                loading={state.isRejectingInvitationId === invitation.id}
                onClick={() => {
                  actions
                    .rejectInvitation(invitation.id)
                    .catch(() => undefined);
                }}
                type="button"
                variant="outline"
              >
                Rechazar
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-zinc-800 border-dashed bg-black/10 p-6 text-sm text-zinc-400">
          No hay invitaciones pendientes para esta cuenta.
        </div>
      )}
    </OrgCard>
  );
}
