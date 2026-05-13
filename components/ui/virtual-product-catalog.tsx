import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VirtualProductCatalogProps<T> {
  className?: string;
  emptyNode?: ReactNode;
  gap?: number;
  getItemId: (item: T) => string;
  gridRowHeight?: number;
  isLoading?: boolean;
  items: T[];
  listItemHeight?: number;
  loadingNode?: ReactNode;
  minColumnWidth?: number;
  renderItem: (item: T) => ReactNode;
  viewMode: "grid" | "list";
}

function useGridColumns(
  ref: React.RefObject<HTMLDivElement | null>,
  minColumnWidth: number
) {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

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
        className={className}
        estimateSize={listItemHeight}
        gap={gap}
        getItemId={getItemId}
        items={items}
        parentRef={parentRef}
        renderItem={renderItem}
      />
    );
  }

  return (
    <VirtualGrid
      className={className}
      gap={gap}
      getItemId={getItemId}
      items={items}
      minColumnWidth={minColumnWidth}
      parentRef={parentRef}
      renderItem={renderItem}
      rowHeight={gridRowHeight}
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
    <div className={cn("overflow-auto", className)} ref={parentRef}>
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
              data-index={virtualRow.index}
              key={virtualRow.key}
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
    <div className={cn("overflow-auto", className)} ref={parentRef}>
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
              className="absolute left-0 w-full"
              data-index={virtualRow.index}
              key={virtualRow.key}
              ref={virtualizer.measureElement}
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
