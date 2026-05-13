import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

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
              data-index={virtualRow.index}
              key={virtualRow.key}
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
