import { Button, Select } from "@mantine/core";
import { LIST_PAGE_SIZE_OPTIONS } from "@/features/listing/listing.constants.shared";
import { ShiftListItemCard } from "@/features/shifts/components/shift-list-item";
import { useShiftsPage } from "@/features/shifts/shifts-page-context";

function ShiftsListContent() {
  const { state, meta } = useShiftsPage();
  const shiftsQuery = meta.shiftsQuery;

  if (shiftsQuery.isLoading && !shiftsQuery.isPlaceholderData) {
    return (
      <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center text-sm text-zinc-500">
        Cargando turnos…
      </div>
    );
  }

  if (shiftsQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-800 border-dashed px-4 py-16 text-center text-rose-300 text-sm">
        <p className="font-medium">Error al cargar turnos</p>
        <p className="mt-1 text-xs text-zinc-400">
          {shiftsQuery.error?.message ?? "Intenta de nuevo más tarde."}
        </p>
        <Button
          color="gray"
          mt="md"
          onClick={() => shiftsQuery.refetch()}
          type="button"
          variant="outline"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  if (state.shifts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center text-sm text-zinc-500">
        No hay turnos que coincidan con los filtros actuales.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.shifts.map((shift) => (
        <ShiftListItemCard
          key={shift.id}
          paymentMethodLabels={meta.paymentMethodLabels}
          shift={shift}
        />
      ))}
    </div>
  );
}

export function ShiftsListPanel() {
  const { state, actions } = useShiftsPage();

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ShiftsListContent />
      </div>

      <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-zinc-800 border-t bg-black/10 p-4 text-sm text-zinc-400 sm:flex-row">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-start">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <Select
              allowDeselect={false}
              data={LIST_PAGE_SIZE_OPTIONS.map((size) => `${size}`)}
              onChange={(value) => {
                if (value) {
                  actions.setPageSize(Number(value));
                }
              }}
              size="xs"
              value={`${state.pageSize}`}
              w={70}
            />
            <span>filas</span>
          </div>
          <div className="hidden tabular-nums sm:block">{state.rangeLabel}</div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button
            color="gray"
            disabled={state.pageIndex === 0}
            onClick={actions.goToPreviousPage}
            size="xs"
            type="button"
            variant="outline"
          >
            Anterior
          </Button>
          <Button
            c="black"
            color="voltage.5"
            disabled={state.nextCursor === null}
            onClick={actions.goToNextPage}
            size="xs"
            type="button"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </>
  );
}
