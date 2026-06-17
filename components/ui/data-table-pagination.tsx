import { ActionIcon, Select } from "@mantine/core";
import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { darkSelectStyles } from "@/lib/mantine-dark";

interface DataTablePaginationProps<TData> {
  pageSizeOptions?: number[];
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50],
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">
      <div className="flex-1 whitespace-nowrap text-sm text-zinc-400">
        {table.getRowCount().toLocaleString()} producto(s) en total
      </div>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <p className="whitespace-nowrap font-medium text-sm text-zinc-300">
            Filas por página
          </p>
          <Select
            allowDeselect={false}
            comboboxProps={{ position: "top" }}
            data={pageSizeOptions.map((pageSize) => `${pageSize}`)}
            onChange={(value) => {
              if (value) {
                table.setPageSize(Number(value));
              }
            }}
            size="xs"
            styles={darkSelectStyles}
            value={`${table.getState().pagination.pageSize}`}
            w={72}
          />
        </div>
        <div className="flex items-center justify-center font-medium text-sm text-zinc-300">
          Página {(table.getState().pagination.pageIndex + 1).toLocaleString()}{" "}
          de {table.getPageCount().toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <ActionIcon
            aria-label="Primera página"
            className="hidden lg:flex"
            color="gray"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.setPageIndex(0)}
            variant="outline"
          >
            <ChevronsLeft aria-hidden="true" className="size-4" />
          </ActionIcon>
          <ActionIcon
            aria-label="Página anterior"
            color="gray"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </ActionIcon>
          <ActionIcon
            aria-label="Página siguiente"
            color="gray"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </ActionIcon>
          <ActionIcon
            aria-label="Última página"
            className="hidden lg:flex"
            color="gray"
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            variant="outline"
          >
            <ChevronsRight aria-hidden="true" className="size-4" />
          </ActionIcon>
        </div>
      </div>
    </div>
  );
}
