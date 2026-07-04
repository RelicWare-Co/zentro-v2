import { Drawer } from "@mantine/core";
import { ShiftDetailContent } from "@/features/shifts/components/shift-detail-content";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

function ShiftDetailPane() {
  const { meta } = useShiftsPage();
  const { shiftDetailQuery } = meta;

  if (shiftDetailQuery.isLoading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Cargando detalle…
      </div>
    );
  }

  if (shiftDetailQuery.data) {
    return (
      <ShiftDetailContent
        productSummary={shiftDetailQuery.productSummary}
        shift={shiftDetailQuery.data}
      />
    );
  }

  return (
    <div className="py-12 text-center text-sm text-zinc-400">
      No se encontró el detalle.
    </div>
  );
}

export function ShiftDetailSheet() {
  const { state, actions } = useShiftsPage();

  return (
    <Drawer
      onClose={() => actions.setDetailOpen(false)}
      opened={state.isDetailOpen}
      position="right"
      size="min(800px, 100vw)"
      title="Detalle del turno"
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-zinc-800 border-b px-6 py-4">
          <p className="text-base text-zinc-400">
            Resumen de productos vendidos y categorías del turno.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ShiftDetailPane />
        </div>
      </div>
    </Drawer>
  );
}
