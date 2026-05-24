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
import { useCustomersPage } from "@/features/customers/customers-page-context";

export function CustomerDeleteDialog() {
  const { state, actions, meta } = useCustomersPage();
  const isOpen = state.activeOverlay?.type === "delete";

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
          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {state.customerToDelete?.name} será removido de la lista activa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => {
              actions.confirmDelete().catch(() => undefined);
            }}
          >
            {meta.isDeletePending ? "Eliminando…" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
