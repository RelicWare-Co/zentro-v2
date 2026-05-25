import { Check, Pencil, UserX, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { parseRoleList } from "@/features/organization/access-control.shared";
import { MemberRemoveDialog } from "@/features/organization/components/member-remove-dialog";
import {
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from "@/features/organization/hooks/use-organization";
import { organizationDateFormatter } from "@/features/organization/organization-formatters.shared";
import { ORGANIZATION_ROLE_OPTIONS } from "@/features/organization/organization-page.constants.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";
import { getErrorMessage } from "@/lib/utils";

export function MembersTab() {
  const { state, actions } = useOrganizationPage();
  const data = state.data;

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{
    memberId: string;
    name: string;
  } | null>(null);

  const updateRoleMutation = useUpdateMemberRoleMutation();
  const removeMutation = useRemoveMemberMutation();

  if (!data) {
    return null;
  }

  const startEditRole = (memberId: string, currentRole: string) => {
    setEditingMemberId(memberId);
    setPendingRole(currentRole);
  };

  const saveRole = async (memberId: string) => {
    actions.setFeedback(null);
    try {
      await updateRoleMutation.mutateAsync({
        memberId,
        role: pendingRole,
      });
      await actions.refetchManagement();
      setEditingMemberId(null);
      actions.setFeedback("Rol actualizado.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo actualizar el rol."),
        "error"
      );
    }
  };

  const viewerIsOwner = parseRoleList(data.viewer.role).includes("owner");
  const canEditMembers = data.viewer.canManageAccess;

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
      <CardHeader>
        <CardTitle>Miembros Activos</CardTitle>
        <CardDescription className="text-zinc-400">
          Listado de usuarios con acceso a esta organización.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="px-4 text-zinc-400">Miembro</TableHead>
              <TableHead className="text-zinc-400">Rol</TableHead>
              <TableHead className="text-zinc-400">Ingreso</TableHead>
              {canEditMembers && (
                <TableHead className="text-right text-zinc-400">
                  Acciones
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.map((member) => {
              const isSelf = member.userId === data.viewer.userId;
              const isEditing = editingMemberId === member.memberId;
              const memberRoles = parseRoleList(member.role);
              const isMemberOwner = memberRoles.includes("owner");
              const canEditThis =
                canEditMembers && (viewerIsOwner || !isMemberOwner) && !isSelf;
              const canRemoveThis =
                canEditMembers && !isSelf && (viewerIsOwner || !isMemberOwner);

              return (
                <TableRow
                  className="border-zinc-800 hover:bg-white/5"
                  key={member.memberId}
                >
                  <TableCell className="px-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                        <span className="font-medium text-sm text-zinc-400">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm text-white">
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Select
                          disabled={updateRoleMutation.isPending}
                          onValueChange={setPendingRole}
                          value={pendingRole}
                        >
                          <SelectTrigger className="h-8 w-32 border-zinc-800 bg-black/30 text-xs">
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
                        <Button
                          className="text-emerald-400 hover:text-emerald-300"
                          disabled={updateRoleMutation.isPending}
                          onClick={() => {
                            saveRole(member.memberId).catch(() => undefined);
                          }}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          className="text-zinc-400 hover:text-zinc-300"
                          onClick={() => setEditingMemberId(null)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <XCircle className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge className="text-zinc-300" variant="outline">
                        {formatOrganizationRoleLabel(member.role)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {member.joinedAt
                      ? organizationDateFormatter.format(member.joinedAt)
                      : "N/A"}
                  </TableCell>
                  {canEditMembers && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEditThis && !isEditing && (
                          <Button
                            className="text-zinc-400 hover:text-white"
                            onClick={() =>
                              startEditRole(member.memberId, member.role)
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canRemoveThis && (
                          <Button
                            className="text-red-400 hover:text-red-300"
                            disabled={removeMutation.isPending}
                            onClick={() =>
                              setConfirmRemoveMember({
                                memberId: member.memberId,
                                name: member.name,
                              })
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            <UserX className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {data.members.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No hay miembros en la organización.
          </div>
        ) : null}
      </CardContent>

      <MemberRemoveDialog
        member={confirmRemoveMember}
        onOpenChange={() => setConfirmRemoveMember(null)}
        open={!!confirmRemoveMember}
      />
    </Card>
  );
}
