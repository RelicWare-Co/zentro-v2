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
import { useProductsPage } from "@/features/products/products-page-context";

export function ProductDeleteDialog() {
  const { state, actions, meta } = useProductsPage();
  const { mutations } = meta;

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          actions.setProductToDelete(null);
        }
      }}
      open={Boolean(state.productToDelete)}
    >
      <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            {state.productToDelete?.name} será removido del catálogo activo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={() => {
              actions.confirmDeleteProduct().catch(() => undefined);
            }}
          >
            {mutations.deleteProductMutation.isPending
              ? "Eliminando..."
              : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
