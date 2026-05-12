import { useRef, useState, useEffect, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualProductCatalogProps<T> {
	items: T[];
	getItemId: (item: T) => string;
	renderItem: (item: T) => ReactNode;
	viewMode: "grid" | "list";
	isLoading?: boolean;
	loadingNode?: ReactNode;
	emptyNode?: ReactNode;
	minColumnWidth?: number;
	gap?: number;
	listItemHeight?: number;
	gridRowHeight?: number;
	className?: string;
}

function useGridColumns(
	ref: React.RefObject<HTMLDivElement | null>,
	minColumnWidth: number,
) {
	const [columns, setColumns] = useState(2);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const update = () => {
			const width = el.clientWidth;
			setColumns(Math.max(1, Math.floor(width / minColumnWidth)));
		};

		update();

		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, [ref, minColumnWidth]);

	return columns;
}

export function VirtualProductCatalog<T>({
	items,
	getItemId,
	renderItem,
	viewMode,
	isLoading,
	loadingNode,
	emptyNode,
	minColumnWidth = 160,
	gap = 12,
	listItemHeight = 72,
	gridRowHeight = 220,
	className,
}: VirtualProductCatalogProps<T>) {
	const parentRef = useRef<HTMLDivElement>(null);

	if (isLoading && loadingNode) {
		return <div className={className}>{loadingNode}</div>;
	}

	if (items.length === 0 && emptyNode) {
		return <div className={className}>{emptyNode}</div>;
	}

	if (viewMode === "list") {
		return (
			<VirtualList
				items={items}
				getItemId={getItemId}
				renderItem={renderItem}
				parentRef={parentRef}
				estimateSize={listItemHeight}
				gap={gap}
				className={className}
			/>
		);
	}

	return (
		<VirtualGrid
			items={items}
			getItemId={getItemId}
			renderItem={renderItem}
			parentRef={parentRef}
			minColumnWidth={minColumnWidth}
			gap={gap}
			rowHeight={gridRowHeight}
			className={className}
		/>
	);
}

function VirtualList<T>({
	items,
	getItemId,
	renderItem,
	parentRef,
	estimateSize,
	gap,
	className,
}: {
	items: T[];
	getItemId: (item: T) => string;
	renderItem: (item: T) => ReactNode;
	parentRef: React.RefObject<HTMLDivElement | null>;
	estimateSize: number;
	gap: number;
	className?: string;
}) {
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => estimateSize,
		overscan: 5,
		getItemKey: (index) => getItemId(items[index]),
	});

	const virtualItems = virtualizer.getVirtualItems();

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
							{renderItem(items[virtualRow.index])}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function VirtualGrid<T>({
	items,
	getItemId,
	renderItem,
	parentRef,
	minColumnWidth,
	gap,
	rowHeight,
	className,
}: {
	items: T[];
	getItemId: (item: T) => string;
	renderItem: (item: T) => ReactNode;
	parentRef: React.RefObject<HTMLDivElement | null>;
	minColumnWidth: number;
	gap: number;
	rowHeight: number;
	className?: string;
}) {
	const columns = useGridColumns(parentRef, minColumnWidth);
	const rowCount = Math.ceil(items.length / columns);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => rowHeight,
		overscan: 3,
	});

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div ref={parentRef} className={cn("overflow-auto", className)}>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					position: "relative",
					width: "100%",
				}}
			>
				{virtualItems.map((virtualRow) => {
					const rowIndex = virtualRow.index;
					const startIndex = rowIndex * columns;
					const rowItems = items.slice(startIndex, startIndex + columns);

					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							className="absolute left-0 w-full"
							style={{
								height: `${virtualRow.size}px`,
								transform: `translateY(${virtualRow.start}px)`,
								display: "grid",
								gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
								gap,
								paddingBottom: gap,
							}}
						>
							{rowItems.map((item) => (
								<div key={getItemId(item)}>{renderItem(item)}</div>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}
