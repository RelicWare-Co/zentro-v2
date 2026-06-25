import { Alert, Badge, Button, Select, TextInput } from "@mantine/core";
import { UserPlus, XCircle } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvitationCancelDialog } from "@/features/organization/components/invitation-cancel-dialog";
import { OrgCard } from "@/features/organization/components/organization-ui-primitives";
import {
  useCancelInvitationMutation,
  useInviteMemberMutation,
} from "@/features/organization/hooks/use-organization";
import { organizationDateTimeFormatter } from "@/features/organization/organization-formatters.shared";
import { ORGANIZATION_ROLE_OPTIONS } from "@/features/organization/organization-page.constants.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";
import { getErrorMessage } from "@/lib/utils";

export function InvitationsTab() {
  const { state, actions } = useOrganizationPage();
  const data = state.data;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const inviteMutation = useInviteMemberMutation();
  const cancelMutation = useCancelInvitationMutation();

  if (!data) {
    return null;
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    actions.setFeedback(null);
    try {
      await inviteMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      await actions.refetchManagement();
      setInviteEmail("");
      setInviteRole("member");
      actions.setFeedback("Invitación enviada.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo enviar la invitación."),
        "error"
      );
    }
  };

  return (
    <div className="space-y-6">
      <OrgCard
        description="Envía una invitación por correo electrónico."
        icon={UserPlus}
        title="Invitar Miembro"
      >
        {data.viewer.canManageAccess ? (
          <form className="space-y-4" onSubmit={handleInvite}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                disabled={inviteMutation.isPending}
                label="Correo electrónico"
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colaborador@ejemplo.com"
                required
                type="email"
                value={inviteEmail}
              />
              <Select
                data={ORGANIZATION_ROLE_OPTIONS.map((r) => ({
                  value: r.value,
                  label: r.label,
                }))}
                disabled={inviteMutation.isPending}
                label="Rol"
                onChange={(value) => setInviteRole(value ?? "member")}
                value={inviteRole}
              />
            </div>
            <Button
              c="black"
              color="voltage.5"
              leftSection={<UserPlus className="size-4" />}
              loading={inviteMutation.isPending}
              type="submit"
            >
              Enviar Invitación
            </Button>
          </form>
        ) : (
          <Alert color="yellow" title="Acceso restringido" variant="light">
            Solo owners y admins pueden enviar invitaciones.
          </Alert>
        )}
      </OrgCard>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <div className="space-y-1.5 p-6">
          <h3 className="font-semibold">Invitaciones Pendientes</h3>
          <p className="text-sm text-zinc-400">
            Invitaciones internas que todavía no han sido aceptadas.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="px-4 text-zinc-400">Email</TableHead>
              <TableHead className="text-zinc-400">Rol</TableHead>
              <TableHead className="text-zinc-400">Expira</TableHead>
              {data.viewer.canManageAccess && (
                <TableHead className="text-right text-zinc-400">
                  Acciones
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.pendingInvitations.map((invitation) => (
              <TableRow
                className="border-zinc-800 hover:bg-white/5"
                key={invitation.id}
              >
                <TableCell className="px-4 text-sm text-white">
                  {invitation.email}
                </TableCell>
                <TableCell>
                  <Badge color="gray" tt="none" variant="outline">
                    {formatOrganizationRoleLabel(invitation.role)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-zinc-400">
                  {invitation.expiresAt
                    ? organizationDateTimeFormatter.format(invitation.expiresAt)
                    : "N/A"}
                </TableCell>
                {data.viewer.canManageAccess && (
                  <TableCell className="text-right">
                    <Button
                      color="red"
                      disabled={cancelMutation.isPending}
                      leftSection={<XCircle className="size-3.5" />}
                      onClick={() => setConfirmCancelId(invitation.id)}
                      size="xs"
                      variant="subtle"
                    >
                      Cancelar
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.pendingInvitations.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No hay invitaciones pendientes.
          </div>
        ) : null}
      </div>

      <InvitationCancelDialog
        invitationId={confirmCancelId}
        onOpenChange={() => setConfirmCancelId(null)}
        open={!!confirmCancelId}
      />
    </div>
  );
}
