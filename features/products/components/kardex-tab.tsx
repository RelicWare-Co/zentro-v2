import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCursorListPagination } from "@/features/listing/hooks/use-cursor-list-pagination";
import { KardexExportButton } from "@/features/products/components/kardex-export-button";
import {
  KardexFilters,
  type KardexFiltersState,
} from "@/features/products/components/kardex-filters";
import { useInventoryMovementsList } from "@/features/products/hooks/use-inventory-movements";
import { useProductsPage } from "@/features/products/products-page-context";

function getDefaultKardexDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function KardexTab() {
  const { state, actions } = useProductsPage();
  const defaultRange = useMemo(() => getDefaultKardexDateRange(), []);
  const [filters, setFilters] = useState<KardexFiltersState>({
    searchQuery: "",
    productId: "all",
    type: "all",
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
  });
  const deferredFilters = useDeferredValue(filters);
  const filterKey = JSON.stringify(deferredFilters);
  const { listCursor, pageIndex, goToNextPage, goToPreviousPage } =
    useCursorListPagination<{ createdAt: number; id: string }>(filterKey);

  const listParams = useMemo(
    () => ({
      limit: 50,
      cursor: listCursor,
      productId:
        deferredFilters.productId === "all" ? null : deferredFilters.productId,
      type:
        deferredFilters.type === "all"
          ? null
          : (deferredFilters.type as
              | "sale"
              | "restock"
              | "waste"
              | "adjustment"),
      searchQuery: deferredFilters.searchQuery.trim() || null,
      startDate: deferredFilters.startDate || null,
      endDate: deferredFilters.endDate || null,
    }),
    [deferredFilters, listCursor]
  );

  const { data, isLoading, isPlaceholderData } =
    useInventoryMovementsList(listParams);
  const exportParams = useMemo(
    () => ({ ...listParams, cursor: null }),
    [listParams]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <KardexFilters
          categories={state.categories}
          filters={filters}
          onChange={(patch) =>
            setFilters((current) => ({ ...current, ...patch }))
          }
          products={state.catalogProducts}
        />
        <KardexExportButton listParams={exportParams} />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Stock actual</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && data.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-zinc-400"
                    colSpan={8}
                  >
                    Cargando movimientos...
                  </TableCell>
                </TableRow>
              ) : null}
              {!isLoading && data.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-10 text-center text-zinc-400"
                    colSpan={8}
                  >
                    No hay movimientos con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : null}
              {data.data.map((movement) => (
                <TableRow
                  className={`border-zinc-800 ${isPlaceholderData ? "opacity-70" : ""}`}
                  key={movement.id}
                >
                  <TableCell className="text-zinc-300 tabular-nums">
                    {format(movement.createdAt, "dd MMM yyyy HH:mm", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-white">
                      {movement.productName}
                    </p>
                    {movement.productSku ? (
                      <p className="text-xs text-zinc-500">
                        SKU: {movement.productSku}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {movement.typeLabel}
                  </TableCell>
                  <TableCell
                    className={
                      movement.quantity > 0
                        ? "font-medium text-emerald-300 tabular-nums"
                        : "font-medium text-red-300 tabular-nums"
                    }
                  >
                    {movement.quantityLabel}
                  </TableCell>
                  <TableCell className="text-zinc-300 tabular-nums">
                    {movement.productStock ?? "—"}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {movement.userName ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-zinc-400">
                    {movement.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                      onClick={() => {
                        const product = state.catalogProducts.find(
                          (item) => item.id === movement.productId
                        );
                        if (product) {
                          actions.openInventoryForProduct(product);
                        }
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Movimiento
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Página {pageIndex + 1}
          {data.total === null ? "" : ` · ${data.total} movimientos`}
        </p>
        <div className="flex gap-2">
          <Button
            className="border-zinc-800 bg-[var(--color-carbon)] text-zinc-300"
            disabled={pageIndex === 0}
            onClick={goToPreviousPage}
            type="button"
            variant="outline"
          >
            Anterior
          </Button>
          <Button
            className="border-zinc-800 bg-[var(--color-carbon)] text-zinc-300"
            disabled={!(data.hasMore && data.nextCursor)}
            onClick={() => {
              if (data.nextCursor) {
                goToNextPage(data.nextCursor);
              }
            }}
            type="button"
            variant="outline"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
