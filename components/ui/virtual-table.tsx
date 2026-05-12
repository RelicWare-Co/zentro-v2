import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface VirtualTableProps<T> {
	data: T[];
	header: ReactNode;
	renderRow: (item: T, index: number) => ReactNode;
	getItemKey?: (item: T, index: number) => string;
	estimateSize?: number;
	overscan?: number;
	maxHeight?: number | string;
	className?: string;
	emptyState?: ReactNode;
	/**
	 * When true, all rows are rendered at exactly `estimateSize` height.
	 * This eliminates layout shifts during scroll. Set to false only if
	 * rows have truly unpredictable heights.
	 */
	fixedSize?: boolean;
}

export function VirtualTable<T>({
	data,
	header,
	renderRow,
	getItemKey,
	estimateSize = 64,
	overscan = 8,
	maxHeight = 600,
	className,
	emptyState,
	fixedSize = true,
}: VirtualTableProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: data.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		overscan,
		getItemKey: getItemKey ? (index) => getItemKey(data[index], index) : undefined,
		measureElement: fixedSize ? undefined : (el) => el.getBoundingClientRect().height,
	});

	const virtualItems = virtualizer.getVirtualItems();
	const totalSize = virtualizer.getTotalSize();

	const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
	const paddingBottom =
		virtualItems.length > 0
			? totalSize - virtualItems[virtualItems.length - 1].end
			: 0;

	return (
		<div
			ref={parentRef}
			className={cn("overflow-auto rounded-xl border border-gray-800 bg-[var(--color-carbon)]", className)}
			style={{ maxHeight }}
		>
			<Table>
				<TableHeader className="sticky top-0 z-10 bg-[var(--color-carbon)]">
					{header}
				</TableHeader>
				<TableBody>
					{data.length === 0 && emptyState ? (
						<TableRow className="border-gray-800">
							<td colSpan={100} className="p-0">
								{emptyState}
							</td>
						</TableRow>
					) : (
						<>
							{paddingTop > 0 && (
								<tr>
									<td colSpan={100} style={{ height: `${paddingTop}px` }} />
								</tr>
							)}
							{virtualItems.map((virtualRow) => {
								const item = data[virtualRow.index];
								return (
									<TableRow
										key={virtualRow.key}
										data-index={virtualRow.index}
										ref={fixedSize ? undefined : virtualizer.measureElement}
										className={cn(
											"border-gray-800 hover:bg-white/5",
											fixedSize && "overflow-hidden",
										)}
										style={{
											height: fixedSize ? `${estimateSize}px` : `${virtualRow.size}px`,
										}}
									>
										{renderRow(item, virtualRow.index)}
									</TableRow>
								);
							})}
							{paddingBottom > 0 && (
								<tr>
									<td colSpan={100} style={{ height: `${paddingBottom}px` }} />
								</tr>
							)}
							</>
						)}
					</TableBody>
					</Table>
				</div>
			);
			}
