"use no memo";

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

interface VirtualListRowProps {
  data: unknown[];
  estimateSize: number;
  measureElement: (node: Element | null) => void;
  RowComponent: ComponentType<{ data: unknown; index: number }>;
  virtualRow: VirtualItem;
}

function VirtualListRow({
  data,
  estimateSize,
  measureElement,
  RowComponent,
  virtualRow,
}: VirtualListRowProps) {
  "use no memo";

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
}

// react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- this shared virtualizer boundary is intentionally compiler opt-out.
const MemoizedVirtualListRow = memo(VirtualListRow) as typeof VirtualListRow;

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

type VirtualListImplProps = VirtualListProps<unknown>;

export function VirtualList<T>(props: VirtualListProps<T>) {
  return <VirtualListImpl {...(props as unknown as VirtualListImplProps)} />;
}

function VirtualListImpl({
  data,
  RowComponent,
  getItemKey,
  estimateSize = 64,
  overscan = 5,
  gap = 0,
  className,
  innerClassName,
  emptyState,
}: VirtualListImplProps) {
  "use no memo";

  const parentRef = useRef<HTMLDivElement>(null);

  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- TanStack Virtual expects stable option callbacks.
  const getScrollElement = useCallback(() => parentRef.current, []);
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- TanStack Virtual expects stable option callbacks.
  const getEstimatedSize = useCallback(() => estimateSize, [estimateSize]);
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- TanStack Virtual expects stable option callbacks.
  const getVirtualItemKey = useCallback(
    (index: number) => {
      const item = data[index];
      if (!getItemKey || item === undefined) {
        return index;
      }
      return getItemKey(item, index);
    },
    [data, getItemKey]
  );
  // react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- keep the virtualizer options object stable across renders.
  const virtualizerOptions = useMemo(
    () => ({
      count: data.length,
      getScrollElement,
      estimateSize: getEstimatedSize,
      overscan,
      getItemKey: getItemKey ? getVirtualItemKey : undefined,
    }),
    [
      data.length,
      getEstimatedSize,
      getItemKey,
      getScrollElement,
      getVirtualItemKey,
      overscan,
    ]
  );

  // react-doctor-disable-next-line react-hooks-js/incompatible-library -- TanStack Virtual is intentionally isolated in this compiler opt-out component.
  const virtualizer = useVirtualizer(virtualizerOptions);

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
            <MemoizedVirtualListRow
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
