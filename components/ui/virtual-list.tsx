import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualListProps<T> {
	data: T[];
	renderItem: (item: T, index: number) => ReactNode;
	getItemKey?: (item: T, index: number) => string;
	estimateSize?: number;
	overscan?: number;
	gap?: number;
	className?: string;
	innerClassName?: string;
	emptyState?: ReactNode;
}

export function VirtualList<T>({
	data,
	renderItem,
	getItemKey,
	estimateSize = 64,
	overscan = 5,
	gap = 0,
	className,
	innerClassName,
	emptyState,
}: VirtualListProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: data.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		overscan,
		getItemKey: getItemKey ? (index) => getItemKey(data[index], index) : undefined,
	});

	const virtualItems = virtualizer.getVirtualItems();

	if (data.length === 0 && emptyState) {
		return <div className={className}>{emptyState}</div>;
	}

	return (
		<div ref={parentRef} className={cn("overflow-auto", className)}>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					position: "relative",
					width: "100%",
				}}
			>
				<div
					className={innerClassName}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
						display: "flex",
						flexDirection: "column",
						gap,
					}}
				>
					{virtualItems.map((virtualRow) => (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{ minHeight: estimateSize }}
						>
							{renderItem(data[virtualRow.index], virtualRow.index)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
