import { Pagination, Select } from "@mantine/core";
import type { Table } from "@tanstack/react-table";

interface DataTablePaginationProps<TData> {
  pageSizeOptions?: number[];
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50],
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount();
  const currentPage =
    pageCount === 0
      ? 0
      : Math.min(table.getState().pagination.pageIndex + 1, pageCount);

  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-between gap-4 p-1 sm:flex-row sm:gap-8">
      <div className="whitespace-nowrap text-sm text-zinc-400">
        {table.getRowCount().toLocaleString()} producto(s) en total
      </div>
      <div className="flex w-full min-w-0 flex-col items-center gap-4 sm:w-auto sm:flex-row sm:gap-6">
        <div className="flex items-center gap-2">
          <p className="whitespace-nowrap font-medium text-sm text-zinc-300">
            Filas por página
          </p>
          <Select
            allowDeselect={false}
            aria-label="Filas por página"
            comboboxProps={{ position: "top" }}
            data={pageSizeOptions.map((pageSize) => `${pageSize}`)}
            onChange={(value) => {
              if (value) {
                table.setPageSize(Number(value));
              }
            }}
            size="xs"
            value={`${table.getState().pagination.pageSize}`}
            w={72}
          />
        </div>
        {pageCount > 1 ? (
          <Pagination
            className="w-full min-w-0 sm:w-auto"
            formatLabel={({ page, totalPages }) =>
              `Página ${page.toLocaleString()} de ${totalPages.toLocaleString()}`
            }
            getControlProps={(control) => ({
              "aria-label": {
                first: "Primera página",
                previous: "Página anterior",
                next: "Página siguiente",
                last: "Última página",
              }[control],
            })}
            getItemProps={(page) => ({
              "aria-label": `Ir a la página ${page.toLocaleString()}`,
            })}
            layout="responsive"
            onChange={(page) => table.setPageIndex(page - 1)}
            size="sm"
            total={pageCount}
            value={currentPage}
            withEdges
          />
        ) : (
          <div className="whitespace-nowrap font-medium text-sm text-zinc-300">
            Página {currentPage.toLocaleString()} de{" "}
            {pageCount.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
