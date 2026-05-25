import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SaleDetailContent } from "@/features/sales/components/sale-detail-content";
import { useSalesPage } from "@/features/sales/sales-page-context";

function SaleDetailPane() {
  const { state, actions, meta } = useSalesPage();
  const saleDetailQuery = meta.saleDetailQuery;

  if (saleDetailQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Cargando detalle…
      </div>
    );
  }

  if (saleDetailQuery.data) {
    return (
      <SaleDetailContent
        activeShiftId={meta.activeShiftId}
        isCancelling={state.isCancelling}
        onRequestCancel={actions.requestCancelSale}
        sale={saleDetailQuery.data}
      />
    );
  }

  return (
    <div className="py-12 text-center text-sm text-zinc-400">
      No se encontró el detalle.
    </div>
  );
}

export function SalesDetailSheet() {
  const { state, actions } = useSalesPage();

  return (
    <Sheet onOpenChange={actions.setDetailOpen} open={state.isDetailOpen}>
      <SheetContent
        className="!w-full !max-w-full sm:!w-[1000px] overflow-hidden border-zinc-800 bg-[var(--color-carbon)] p-0 text-[var(--color-photon)]"
        side="right"
      >
        <SheetHeader className="shrink-0 border-zinc-800 border-b px-6 py-5">
          <SheetTitle className="font-bold text-2xl text-[var(--color-photon)]">
            Detalle de venta
          </SheetTitle>
          <SheetDescription className="text-base text-zinc-400">
            Revisa cliente, pagos e items registrados para esta venta.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <SaleDetailPane />
        </div>
      </SheetContent>
    </Sheet>
  );
}
