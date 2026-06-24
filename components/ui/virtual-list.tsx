import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  type ComponentType,
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  RowComponent: ComponentType<{ data: T; index: number }>;
  virtualRow: VirtualItem;
}

const VirtualListRow = memo(function VirtualListRow<T>({
  data,
  estimateSize,
  measureElement,
  RowComponent,
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
      <RowComponent data={item} index={virtualRow.index} />
    </div>
  );
}) as <T>(props: VirtualListRowProps<T>) => ReactNode;

interface VirtualListProps<T> {
  className?: string;
  data: T[];
  emptyState?: ReactNode;
  estimateSize?: number;
  gap?: number;
  getItemKey?: (item: T, index: number) => string;
  innerClassName?: string;
  overscan?: number;
  /** Component rendered per row. Receives `data` (the item) and `index`. */
  RowComponent: ComponentType<{ data: T; index: number }>;
}

export function VirtualList<T>({
  data,
  RowComponent,
  getItemKey,
  estimateSize = 64,
  overscan = 5,
  gap = 0,
  className,
  innerClassName,
  emptyState,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => parentRef.current, []);
  const estimateSizeFn = useCallback(() => estimateSize, [estimateSize]);

  const stableGetItemKey = useMemo(
    () =>
      getItemKey
        ? (index: number) => getItemKey(data[index], index)
        : undefined,
    [getItemKey, data]
  );

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement,
    estimateSize: estimateSizeFn,
    overscan,
    getItemKey: stableGetItemKey,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const measureElement = virtualizer.measureElement;

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
              measureElement={measureElement}
              RowComponent={RowComponent}
              virtualRow={virtualRow}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
