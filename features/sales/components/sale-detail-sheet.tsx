import { Drawer } from "@mantine/core";
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
    <Drawer
      onClose={() => actions.setDetailOpen(false)}
      opened={state.isDetailOpen}
      position="right"
      size="min(1000px, 100vw)"
      title="Detalle de venta"
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-zinc-800 border-b px-6 py-4">
          <p className="text-base text-zinc-400">
            Revisa cliente, pagos e items registrados para esta venta.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <SaleDetailPane />
        </div>
      </div>
    </Drawer>
  );
}
