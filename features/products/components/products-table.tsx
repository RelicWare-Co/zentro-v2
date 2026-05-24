import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Edit3, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductStockBadge } from "@/features/products/components/product-stock-badge";
import type { Product } from "@/features/products/hooks/use-products";
import { formatProductCurrency } from "@/features/products/products-formatters.shared";
import { useProductsPage } from "@/features/products/products-page-context";

const columnHelper = createColumnHelper<Product>();

export function ProductsTable() {
  const { state, actions } = useProductsPage();

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Producto",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-white">
              {row.original.name}
            </p>
            {row.original.isModifier ? (
              <Badge className="mt-1 border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
                Modificador
              </Badge>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("categoryName", {
        header: "Categoría",
        cell: ({ getValue }) => getValue() ?? "Sin categoría",
      }),
      columnHelper.display({
        id: "sku",
        header: "SKU / Código",
        cell: ({ row }) => (
          <div className="text-sm text-zinc-300">
            <p>{row.original.sku || "-"}</p>
            {row.original.barcode ? (
              <p className="text-xs text-zinc-500">
                BC: {row.original.barcode}
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.display({
        id: "stock",
        header: "Stock",
        cell: ({ row }) => <ProductStockBadge product={row.original} />,
      }),
      columnHelper.accessor("price", {
        header: "Precio",
        cell: ({ getValue }) => (
          <span className="font-medium text-zinc-200">
            {formatProductCurrency(getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.trackInventory ? (
              <Button
                className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                onClick={() => actions.openInventoryForProduct(row.original)}
                size="sm"
                type="button"
                variant="outline"
              >
                Stock
              </Button>
            ) : null}
            <Button
              className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
              onClick={() => actions.openEditProduct(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Edit3 className="size-3.5" />
            </Button>
            <Button
              className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
              onClick={() => actions.requestDeleteProduct(row.original)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ],
    [actions]
  );

  const table = useReactTable({
    data: state.products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: state.total,
    onPaginationChange: actions.setPagination,
    state: {
      pagination: state.pagination,
    },
  });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[var(--color-carbon)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  className="border-zinc-800 hover:bg-transparent"
                  key={headerGroup.id}
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead className="px-4 text-zinc-400" key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    className="border-zinc-800 hover:bg-white/5"
                    key={row.id}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell className="px-4" key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-zinc-800">
                  <TableCell
                    className="p-10 text-center text-sm text-zinc-500"
                    colSpan={columns.length}
                  >
                    No hay productos que coincidan con los filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="border-zinc-800 border-t p-2">
          <DataTablePagination table={table} />
        </div>
      </div>
    </div>
  );
}
