import { Badge, Button, Select } from "@mantine/core";
import { ArrowRight, UserRound } from "lucide-react";
import { Link } from "@/components/link";
import { LIST_PAGE_SIZE_OPTIONS } from "@/features/listing/listing.constants.shared";
import {
  formatItemCountLabel,
  formatPaymentSummary,
  formatSaleStatus,
  formatSalesCurrency,
  getSaleStatusBadgeClass,
  salesDateTimeFormatter,
} from "@/features/sales/sales-formatters.shared";
import { useSalesPage } from "@/features/sales/sales-page-context";
import { darkSelectStyles } from "@/lib/mantine-dark";

export function SalesListPanel() {
  const { state, actions, meta } = useSalesPage();

  if (state.sales.length === 0) {
    return (
      <div className="p-4 pt-4">
        <div className="rounded-xl border border-zinc-800 border-dashed px-4 py-16 text-center">
          <p className="text-zinc-400">{state.viewSummary.emptyTitle}</p>
          <Button
            color="gray"
            component={Link}
            href="/pos"
            mt="md"
            variant="outline"
          >
            Registrar una venta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-4">
      <div className="space-y-2">
        <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)_84px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_44px] gap-4 px-3 font-medium text-[11px] text-zinc-500 uppercase tracking-[0.16em] md:grid">
          <span>Cliente</span>
          <span>Fecha/Hora</span>
          <span>Items</span>
          <span>Método</span>
          <span className="text-right">Monto total</span>
          <span className="text-right">Estado</span>
          <span />
        </div>

        <div className="space-y-2 [content-visibility:auto]">
          {state.sales.map((sale) => {
            const paymentSummary = formatPaymentSummary(
              sale,
              meta.paymentMethodLabels
            );

            return (
              <button
                className={`group w-full touch-manipulation rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-voltage)]/30 ${
                  state.selectedSaleSummary?.id === sale.id
                    ? "border-[var(--color-voltage)]/30 bg-[var(--color-voltage)]/10"
                    : "border-zinc-800 bg-black/10 hover:border-zinc-700 hover:bg-white/5"
                }`}
                key={sale.id}
                onClick={() => actions.openSaleDetail(sale.id)}
                type="button"
              >
                <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)_84px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_44px] md:items-center md:gap-4">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserRound
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-zinc-500"
                      />
                      <p className="truncate font-medium text-white">
                        {sale.customerName ?? "Cliente mostrador"}
                      </p>
                    </div>
                    <p className="mt-1 truncate pl-5 text-xs text-zinc-500">
                      {sale.cashierName ?? "Sin cajero"}
                    </p>
                  </div>

                  <div className="min-w-0 text-sm text-zinc-300 tabular-nums">
                    <p>{salesDateTimeFormatter.format(sale.createdAt)}</p>
                  </div>

                  <div className="text-sm text-zinc-300">
                    {formatItemCountLabel(sale.itemCount)}
                  </div>

                  <div className="min-w-0 text-sm text-zinc-300">
                    <p className="truncate" title={paymentSummary}>
                      {paymentSummary}
                    </p>
                  </div>

                  <div className="tabular-nums md:text-right">
                    <p className="font-semibold text-[var(--color-voltage)] text-base">
                      {formatSalesCurrency(sale.totalAmount)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Badge
                      className={`${getSaleStatusBadgeClass(
                        sale.status
                      )} border-0`}
                      size="sm"
                      tt="none"
                    >
                      {formatSaleStatus(sale.status)}
                    </Badge>
                    <p className="text-sm text-zinc-400 md:text-right">
                      {sale.balanceDue > 0
                        ? `Pendiente ${formatSalesCurrency(sale.balanceDue)}`
                        : "Sin saldo pendiente"}
                    </p>
                  </div>

                  <div className="hidden justify-end md:flex">
                    <div className="rounded-full border border-zinc-800 p-2 text-zinc-400 transition-colors group-hover:border-zinc-700 group-hover:text-white">
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="-mx-4 mt-4 -mb-4 flex flex-col items-center justify-between gap-4 border-zinc-800 border-t bg-black/10 p-4 text-sm text-zinc-400 sm:flex-row">
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
                styles={darkSelectStyles}
                value={`${state.pageSize}`}
                w={70}
              />
              <span>filas</span>
            </div>
            <div className="hidden tabular-nums sm:block">
              {state.rangeLabel}
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button
              color="gray"
              disabled={state.pageIndex === 0}
              onClick={actions.goToPreviousPage}
              size="xs"
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
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
