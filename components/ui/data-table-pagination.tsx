import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
	table: Table<TData>;
	pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
	table,
	pageSizeOptions = [10, 20, 50],
}: DataTablePaginationProps<TData>) {
	return (
		<div className="flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8">
			<div className="flex-1 whitespace-nowrap text-sm text-gray-400">
				{table.getRowCount().toLocaleString()} producto(s) en total
			</div>
			<div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
				<div className="flex items-center space-x-2">
					<p className="whitespace-nowrap text-sm font-medium text-gray-300">
						Filas por página
					</p>
					<Select
						value={`${table.getState().pagination.pageSize}`}
						onValueChange={(value) => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger className="h-8 w-[4.5rem] border-gray-700 bg-black/20 text-white">
							<SelectValue
								placeholder={table.getState().pagination.pageSize}
							/>
						</SelectTrigger>
						<SelectContent side="top" className="border-gray-800 bg-[var(--color-carbon)] text-white">
							{pageSizeOptions.map((pageSize) => (
								<SelectItem key={pageSize} value={`${pageSize}`}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center justify-center text-sm font-medium text-gray-300">
					Página {(table.getState().pagination.pageIndex + 1).toLocaleString()} de{" "}
					{table.getPageCount().toLocaleString()}
				</div>
				<div className="flex items-center space-x-2">
					<Button
						aria-label="Primera página"
						variant="outline"
						className="hidden size-8 border-gray-700 bg-transparent p-0 text-gray-200 hover:bg-white/5 lg:flex"
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronsLeft className="size-4" aria-hidden="true" />
					</Button>
					<Button
						aria-label="Página anterior"
						variant="outline"
						size="icon"
						className="size-8 border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<ChevronLeft className="size-4" aria-hidden="true" />
					</Button>
					<Button
						aria-label="Página siguiente"
						variant="outline"
						size="icon"
						className="size-8 border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<ChevronRight className="size-4" aria-hidden="true" />
					</Button>
					<Button
						aria-label="Última página"
						variant="outline"
						size="icon"
						className="hidden size-8 border-gray-700 bg-transparent p-0 text-gray-200 hover:bg-white/5 lg:flex"
						onClick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<ChevronsRight className="size-4" aria-hidden="true" />
					</Button>
				</div>
			</div>
		</div>
	);
}
