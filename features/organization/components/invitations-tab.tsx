import { Loader2, UserPlus, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvitationCancelDialog } from "@/features/organization/components/invitation-cancel-dialog";
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
  const inviteEmailId = useId();
  const inviteRoleId = useId();

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
      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-[var(--color-voltage)]" />
            Invitar Miembro
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Envía una invitación por correo electrónico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.viewer.canManageAccess ? (
            <form className="space-y-4" onSubmit={handleInvite}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={inviteEmailId}>Correo electrónico</Label>
                  <Input
                    className="border-zinc-800 bg-black/30"
                    disabled={inviteMutation.isPending}
                    id={inviteEmailId}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colaborador@ejemplo.com"
                    required
                    type="email"
                    value={inviteEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={inviteRoleId}>Rol</Label>
                  <Select
                    disabled={inviteMutation.isPending}
                    onValueChange={setInviteRole}
                    value={inviteRole}
                  >
                    <SelectTrigger
                      className="border-zinc-800 bg-black/30"
                      id={inviteRoleId}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORGANIZATION_ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                disabled={inviteMutation.isPending}
                type="submit"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 size-4" />
                    Enviar Invitación
                  </>
                )}
              </Button>
            </form>
          ) : (
            <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
              <AlertTitle>Acceso restringido</AlertTitle>
              <AlertDescription>
                Solo owners y admins pueden enviar invitaciones.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <CardTitle>Invitaciones Pendientes</CardTitle>
          <CardDescription className="text-zinc-400">
            Invitaciones internas que todavía no han sido aceptadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
                    <Badge className="text-zinc-300" variant="outline">
                      {formatOrganizationRoleLabel(invitation.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {invitation.expiresAt
                      ? organizationDateTimeFormatter.format(
                          invitation.expiresAt
                        )
                      : "N/A"}
                  </TableCell>
                  {data.viewer.canManageAccess && (
                    <TableCell className="text-right">
                      <Button
                        className="text-red-400 hover:text-red-300"
                        disabled={cancelMutation.isPending}
                        onClick={() => setConfirmCancelId(invitation.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <XCircle className="mr-1.5 size-3.5" />
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
        </CardContent>
      </Card>

      <InvitationCancelDialog
        invitationId={confirmCancelId}
        onOpenChange={() => setConfirmCancelId(null)}
        open={!!confirmCancelId}
      />
    </div>
  );
}
