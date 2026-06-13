import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { getErrorMessage } from "@/lib/utils";

export function AdminDeleteDialog() {
  const { state, actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const isOpen = state.activeOverlay?.type === "delete";
  const user =
    state.activeOverlay?.type === "delete" ? state.activeOverlay.user : null;

  const handleConfirm = async () => {
    if (!user) {
      return;
    }
    try {
      await adminActions.removeUser.mutateAsync({ userId: user.id });
      toast.success(`${user.name} fue eliminado.`);
      actions.closeOverlay();
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo eliminar el usuario."));
    }
  };

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {user?.name} ({user?.email}) se eliminará de forma permanente junto
            con sus sesiones y cuentas vinculadas. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => {
              handleConfirm().catch(() => undefined);
            }}
          >
            {adminActions.removeUser.isPending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
