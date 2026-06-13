import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ADMIN_ROLE_OPTIONS,
  type AdminPanelUser,
  type AdminRoleValue,
  isAdminUser,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminRoleDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [role, setRole] = useState<AdminRoleValue>(
    isAdminUser(user) ? "admin" : "user"
  );

  const handleSubmit = async () => {
    try {
      await adminActions.setRole.mutateAsync({ userId: user.id, role });
      toast.success(`Rol de ${user.name} actualizado.`);
      actions.closeOverlay();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo cambiar el rol."));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cambiar rol</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Define el rol de plataforma de {user.name}. Los administradores tienen
          control total sobre los usuarios.
        </DialogDescription>
      </DialogHeader>
      <Select
        onValueChange={(value) => setRole(value as AdminRoleValue)}
        value={role}
      >
        <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
          {ADMIN_ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button
          className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
          onClick={actions.closeOverlay}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          disabled={adminActions.setRole.isPending}
          onClick={() => {
            handleSubmit().catch(() => undefined);
          }}
          type="button"
        >
          {adminActions.setRole.isPending ? "Guardando…" : "Guardar rol"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AdminRoleDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "role";
  const user =
    state.activeOverlay?.type === "role" ? state.activeOverlay.user : null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <DialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
        {user ? <AdminRoleDialogContent key={user.id} user={user} /> : null}
      </DialogContent>
    </Dialog>
  );
}
