import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { type ReactNode, useRef } from "react";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface VirtualTableRowProps<T> {
  data: T[];
  estimateSize: number;
  fixedSize: boolean;
  measureElement?: (node: Element | null) => void;
  renderRow: (item: T, index: number) => ReactNode;
  virtualRow: VirtualItem;
}

function VirtualTableRow<T>({
  data,
  estimateSize,
  fixedSize,
  measureElement,
  renderRow,
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
      {renderRow(item, virtualRow.index)}
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
  renderRow: (item: T, index: number) => ReactNode;
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
    getItemKey: getItemKey
      ? (index) => getItemKey(data[index], index)
      : undefined,
    measureElement: fixedSize
      ? undefined
      : (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

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
                <tr>
                  <td colSpan={100} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {virtualItems.map((virtualRow) => (
                <VirtualTableRow
                  data={data}
                  estimateSize={estimateSize}
                  fixedSize={fixedSize}
                  key={virtualRow.key}
                  measureElement={virtualizer.measureElement}
                  renderRow={renderRow}
                  virtualRow={virtualRow}
                />
              ))}
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
