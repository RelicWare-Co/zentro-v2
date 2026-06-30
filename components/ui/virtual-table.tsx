"use no memo";

import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import {
  type ComponentType,
  memo,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const dynamicMeasureElement = (el: Element) =>
  el.getBoundingClientRect().height;

interface VirtualTableRowProps {
  data: unknown[];
  estimateSize: number;
  fixedSize: boolean;
  measureElement?: (node: Element | null) => void;
  RowComponent: ComponentType<{ data: unknown; index: number }>;
  virtualRow: VirtualItem;
}

function VirtualTableRow({
  data,
  estimateSize,
  fixedSize,
  measureElement,
  RowComponent,
  virtualRow,
}: VirtualTableRowProps) {
  "use no memo";

  const item = data[virtualRow.index];

  if (item === undefined) {
    return null;
  }

  return (
    <TableRow
      className={cn(
        "border-zinc-800 hover:bg-white/5",
        fixedSize && "overflow-hidden"
      )}
      data-index={virtualRow.index}
      ref={fixedSize ? undefined : measureElement}
      style={{
        height: fixedSize ? `${estimateSize}px` : `${virtualRow.size}px`,
      }}
    >
      <RowComponent data={item} index={virtualRow.index} />
    </TableRow>
  );
}

// react-doctor-disable-next-line react-doctor/react-compiler-no-manual-memoization -- this shared virtualizer boundary is intentionally compiler opt-out.
const MemoizedVirtualTableRow = memo(VirtualTableRow) as typeof VirtualTableRow;

interface VirtualTableProps<T> {
  className?: string;
  data: T[];
  emptyState?: ReactNode;
  estimateSize?: number;
  /**
   * When true, all rows are rendered at exactly `estimateSize` height.
   * This eliminates layout shifts during scroll. Set to false only if
   * rows have truly unpredictable heights.
   */
  fixedSize?: boolean;
  getItemKey?: (item: T, index: number) => string;
  header: ReactNode;
  maxHeight?: number | string;
  overscan?: number;
  /** Component rendered per row. Receives `data` (the item) and `index`. */
  RowComponent: ComponentType<{ data: T; index: number }>;
}

type VirtualTableImplProps = VirtualTableProps<unknown>;

export function VirtualTable<T>(props: VirtualTableProps<T>) {
  return <VirtualTableImpl {...(props as unknown as VirtualTableImplProps)} />;
}

function VirtualTableImpl({
  data,
  header,
  RowComponent,
  getItemKey,
  estimateSize = 64,
  overscan = 8,
  maxHeight = 600,
  className,
  emptyState,
  fixedSize = true,
}: VirtualTableImplProps) {
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
      measureElement: fixedSize ? undefined : dynamicMeasureElement,
    }),
    [
      data.length,
      fixedSize,
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
  const totalSize = virtualizer.getTotalSize();
  const stableMeasureElement = virtualizer.measureElement;

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const lastVirtualItem = virtualItems.at(-1);
  const paddingBottom = lastVirtualItem ? totalSize - lastVirtualItem.end : 0;

  return (
    <div
      className={cn(
        "overflow-auto rounded-xl border border-zinc-800 bg-[var(--color-carbon)]",
        className
      )}
      ref={parentRef}
      style={{ maxHeight }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[var(--color-carbon)]">
          {header}
        </TableHeader>
        <TableBody>
          {data.length === 0 && emptyState ? (
            <TableRow className="border-zinc-800">
              <td className="p-0" colSpan={100}>
                {emptyState}
              </td>
            </TableRow>
          ) : (
            <>
              {paddingTop > 0 && (
                <tr aria-label="Espaciador superior de filas virtualizadas">
                  <td colSpan={100} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => (
                <MemoizedVirtualTableRow
                  data={data}
                  estimateSize={estimateSize}
                  fixedSize={fixedSize}
                  key={virtualRow.key}
                  measureElement={stableMeasureElement}
                  RowComponent={RowComponent}
                  virtualRow={virtualRow}
                />
              ))}
              {paddingBottom > 0 && (
                <tr aria-label="Espaciador inferior de filas virtualizadas">
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
