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
import { useSalesPage } from "@/features/sales/sales-page-context";

export function SalesCancelDialog() {
  const { state, actions } = useSalesPage();

  return (
    <AlertDialog
      onOpenChange={actions.setCancelDialogOpen}
      open={state.isCancelDialogOpen}
    >
      <AlertDialogContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Anular venta</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Esta venta quedará anulada. Sus pagos dejarán de contar para caja y
            sus valores no sumarán en ventas. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
            disabled={state.isCancelling}
          >
            Volver
          </AlertDialogCancel>
          <AlertDialogAction
            className="border-none bg-rose-500 text-white hover:bg-rose-600"
            disabled={state.isCancelling}
            onClick={() => {
              actions.confirmCancelSale().catch(() => undefined);
            }}
          >
            {state.isCancelling ? "Anulando…" : "Confirmar anulación"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
