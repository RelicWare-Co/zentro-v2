import { Pagination, Select } from "@mantine/core";

interface DataTablePaginationProps {
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  pageSizeOptions?: number[];
  rowCount: number;
}

export function DataTablePagination({
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageIndex,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  rowCount,
}: DataTablePaginationProps) {
  const currentPage =
    pageCount > 0 ? Math.min(Math.max(pageIndex + 1, 1), pageCount) : 1;

  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-between gap-4 p-1 sm:flex-row sm:gap-8">
      <div className="shrink-0 whitespace-nowrap text-sm text-zinc-400">
        {rowCount.toLocaleString()} producto(s) en total
      </div>
      <div className="flex w-full min-w-0 flex-col items-center gap-4 sm:w-auto sm:flex-1 sm:flex-row sm:justify-end sm:gap-6">
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
                onPageSizeChange(Number(value));
              }
            }}
            size="xs"
            value={`${pageSize}`}
            w={72}
          />
        </div>
        {pageCount > 1 && (
          <Pagination
            className="w-full min-w-0 sm:flex-1"
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
            onChange={(page) => onPageChange(page - 1)}
            size="sm"
            total={pageCount}
            value={currentPage}
            withEdges
          />
        )}
        {pageCount === 1 && (
          <div className="whitespace-nowrap font-medium text-sm text-zinc-300">
            Página {currentPage.toLocaleString()} de{" "}
            {pageCount.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
