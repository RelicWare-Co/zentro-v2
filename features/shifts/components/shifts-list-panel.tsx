import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          className="mt-4 border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
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
              onValueChange={(value) => actions.setPageSize(Number(value))}
              value={`${state.pageSize}`}
            >
              <SelectTrigger className="h-8 w-[70px] rounded-md border-zinc-700 bg-[var(--color-carbon)] text-white">
                <SelectValue placeholder={state.pageSize} />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
                {LIST_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>filas</span>
          </div>
          <div className="hidden tabular-nums sm:block">{state.rangeLabel}</div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button
            className="h-8 rounded-md border-zinc-700 bg-[var(--color-carbon)] px-3 text-zinc-300 hover:bg-white/5 hover:text-white"
            disabled={state.pageIndex === 0}
            onClick={actions.goToPreviousPage}
            size="sm"
            type="button"
            variant="outline"
          >
            Anterior
          </Button>
          <Button
            className="h-8 rounded-md border-none bg-[var(--color-voltage)] px-4 font-medium text-black hover:bg-[#c9e605]"
            disabled={state.nextCursor === null}
            onClick={actions.goToNextPage}
            size="sm"
            type="button"
            variant="default"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </>
  );
}
