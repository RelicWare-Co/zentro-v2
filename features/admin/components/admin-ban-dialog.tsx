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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMIN_BAN_DURATION_OPTIONS,
  type AdminBanDurationValue,
  type AdminPanelUser,
  getBanDurationSeconds,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

function AdminBanDialogContent({ user }: { user: AdminPanelUser }) {
  const { actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const [banReason, setBanReason] = useState("");
  const [duration, setDuration] = useState<AdminBanDurationValue>("permanent");
  const reasonId = useId();
  const durationId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const banExpiresIn = getBanDurationSeconds(duration);
      await adminActions.banUser.mutateAsync({
        userId: user.id,
        ...(banReason.trim() ? { banReason: banReason.trim() } : {}),
        ...(banExpiresIn ? { banExpiresIn } : {}),
      });
      toast.success(`${user.name} fue suspendido.`);
      actions.closeOverlay();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo suspender al usuario."));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Suspender usuario</DialogTitle>
        <DialogDescription className="text-zinc-400">
          {user.name} no podrá iniciar sesión y todas sus sesiones activas se
          cerrarán.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={durationId}>Duración</Label>
        <Select
          onValueChange={(value) => setDuration(value as AdminBanDurationValue)}
          value={duration}
        >
          <SelectTrigger
            className="w-full border-zinc-700 bg-black/20 text-white"
            id={durationId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            {ADMIN_BAN_DURATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={reasonId}>Motivo (opcional)</Label>
        <Textarea
          className="border-zinc-700 bg-black/20"
          id={reasonId}
          onChange={(event) => setBanReason(event.target.value)}
          placeholder="Ej. Uso indebido de la cuenta"
          value={banReason}
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
          className="bg-red-500 text-white hover:bg-red-600"
          disabled={adminActions.banUser.isPending}
          type="submit"
        >
          {adminActions.banUser.isPending ? "Suspendiendo…" : "Suspender"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AdminBanDialog() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "ban";
  const user =
    state.activeOverlay?.type === "ban" ? state.activeOverlay.user : null;

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
        {user ? <AdminBanDialogContent key={user.id} user={user} /> : null}
      </DialogContent>
    </Dialog>
  );
}
