import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { type CSSProperties, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

const virtualListOuterStyle: CSSProperties = {
  position: "relative",
  width: "100%",
};

const virtualListInnerBaseStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  display: "flex",
  flexDirection: "column",
};

interface VirtualListRowProps<T> {
  data: T[];
  estimateSize: number;
  measureElement: (node: Element | null) => void;
  renderItem: (item: T, index: number) => ReactNode;
  virtualRow: VirtualItem;
}

function VirtualListRow<T>({
  data,
  estimateSize,
  measureElement,
  renderItem,
  virtualRow,
}: VirtualListRowProps<T>) {
  const item = data[virtualRow.index];

  if (item === undefined) {
    return null;
  }

  return (
    <div
      data-index={virtualRow.index}
      ref={measureElement}
      style={{ minHeight: estimateSize }}
    >
      {renderItem(item, virtualRow.index)}
    </div>
  );
}

interface VirtualListProps<T> {
  className?: string;
  data: T[];
  emptyState?: ReactNode;
  estimateSize?: number;
  gap?: number;
  getItemKey?: (item: T, index: number) => string;
  innerClassName?: string;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
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
    getItemKey: getItemKey
      ? (index) => getItemKey(data[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={cn("overflow-auto", className)} ref={parentRef}>
      <div
        style={{
          ...virtualListOuterStyle,
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        <div
          className={innerClassName}
          style={{
            ...virtualListInnerBaseStyle,
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            gap,
          }}
        >
          {virtualItems.map((virtualRow) => (
            <VirtualListRow
              data={data}
              estimateSize={estimateSize}
              key={virtualRow.key}
              measureElement={virtualizer.measureElement}
              renderItem={renderItem}
              virtualRow={virtualRow}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
