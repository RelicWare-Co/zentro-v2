"use no memo";

import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { type ComponentType, type ReactNode, useRef } from "react";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const dynamicMeasureElement = (el: Element) =>
  el.getBoundingClientRect().height;

interface VirtualTableRowProps<T> {
  data: T[];
  estimateSize: number;
  fixedSize: boolean;
  measureElement?: (node: Element | null) => void;
  RowComponent: ComponentType<{ data: T; index: number }>;
  virtualRow: VirtualItem;
}

function VirtualTableRow<T>({
  data,
  estimateSize,
  fixedSize,
  measureElement,
  RowComponent,
  virtualRow,
}: VirtualTableRowProps<T>) {
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

export function VirtualTable<T>({
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
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getScrollElement = () => parentRef.current;

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index: number) => getItemKey(data[index], index)
      : undefined,
    measureElement: fixedSize ? undefined : dynamicMeasureElement,
  });

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
                <tr tabIndex={-1}>
                  <td colSpan={100} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => (
                <VirtualTableRow
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
                <tr tabIndex={-1}>
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
