import { type FormEvent, useId, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminPanelUser } from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminPasswordDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [newPassword, setNewPassword] = useState("");
  const passwordId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await adminActions.setUserPassword.mutateAsync({
        userId: user.id,
        newPassword,
      });
      toast.success(`Contraseña de ${user.name} actualizada.`);
      actions.closeOverlay();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo cambiar la contraseña."));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogDescription className="text-zinc-400">
          Define una nueva contraseña para {user.name}. Sus sesiones activas no
          se cierran automáticamente.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={passwordId}>Nueva contraseña</Label>
        <Input
          className="border-zinc-700 bg-black/20"
          id={passwordId}
          minLength={8}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          type="password"
          value={newPassword}
        />
      </div>
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
          disabled={adminActions.setUserPassword.isPending || !newPassword}
          type="submit"
        >
          {adminActions.setUserPassword.isPending
            ? "Guardando…"
            : "Guardar contraseña"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdminPasswordDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "password";
  const user =
    state.activeOverlay?.type === "password" ? state.activeOverlay.user : null;

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
        {user ? <AdminPasswordDialogContent key={user.id} user={user} /> : null}
      </DialogContent>
    </Dialog>
  );
}
