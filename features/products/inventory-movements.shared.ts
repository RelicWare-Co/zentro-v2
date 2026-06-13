import type { z } from "zod";
import type {
  InventoryMovementListCursorSchema,
  InventoryMovementTypeSchema,
  ListInventoryMovementsInputSchema,
} from "@/features/products/inventory-movements.schema";
import { toTimestamp } from "@/features/sales/sales.shared";

export type InventoryMovementType = z.infer<typeof InventoryMovementTypeSchema>;
export type InventoryMovementListCursor = z.infer<
  typeof InventoryMovementListCursorSchema
>;
export type InventoryMovementsListParams = z.infer<
  typeof ListInventoryMovementsInputSchema
>;

export interface InventoryMovementWithRelations {
  createdAt: Date | number | string;
  id: string;
  notes?: string | null;
  organizationId: string;
  product?: {
    barcode?: string | null;
    id?: string;
    name?: string | null;
    sku?: string | null;
    stock?: number | null;
  } | null;
  productId: string;
  quantity: number;
  type: string;
  user?: {
    email?: string | null;
    id?: string;
    name?: string | null;
  } | null;
  userId?: string | null;
}

export interface InventoryMovementListItem {
  createdAt: number;
  id: string;
  notes: string | null;
  productBarcode: string | null;
  productId: string;
  productName: string;
  productSku: string | null;
  productStock: number | null;
  quantity: number;
  quantityLabel: string;
  type: InventoryMovementType;
  typeLabel: string;
  userName: string | null;
}

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<
  InventoryMovementType,
  string
> = {
  sale: "Venta",
  restock: "Reposición",
  waste: "Merma",
  adjustment: "Ajuste",
};

export function normalizeInventoryMovementType(
  value: string | null | undefined
): InventoryMovementType {
  if (
    value === "sale" ||
    value === "restock" ||
    value === "waste" ||
    value === "adjustment"
  ) {
    return value;
  }
  return "adjustment";
}

export function formatInventoryMovementQuantity(quantity: number) {
  if (quantity > 0) {
    return `+${quantity}`;
  }
  return String(quantity);
}

export function buildInventoryMovementListItem(
  row: InventoryMovementWithRelations
): InventoryMovementListItem {
  const type = normalizeInventoryMovementType(row.type);
  const quantity = Math.trunc(row.quantity);

  return {
    id: row.id,
    createdAt: toTimestamp(row.createdAt) ?? 0,
    productId: row.productId,
    productName: row.product?.name ?? "Producto",
    productSku: row.product?.sku ?? null,
    productBarcode: row.product?.barcode ?? null,
    productStock:
      typeof row.product?.stock === "number" ? row.product.stock : null,
    type,
    typeLabel: INVENTORY_MOVEMENT_TYPE_LABELS[type],
    quantity,
    quantityLabel: formatInventoryMovementQuantity(quantity),
    userName: row.user?.name ?? null,
    notes: row.notes?.trim() || null,
  };
}

export function normalizeInventoryMovementsListLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

export function buildInventoryMovementsListPage(
  rows: InventoryMovementWithRelations[],
  limit: number
): {
  data: InventoryMovementListItem[];
  hasMore: boolean;
  nextCursor: InventoryMovementListCursor | null;
  total: number | null;
} {
  const pageSize = normalizeInventoryMovementsListLimit(limit);
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const data = pageRows.map((row) => buildInventoryMovementListItem(row));
  const lastRow = pageRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? {
          createdAt: toTimestamp(lastRow.createdAt) ?? 0,
          id: lastRow.id,
        }
      : null;

  return {
    data,
    hasMore,
    nextCursor,
    total: hasMore ? null : data.length,
  };
}

export const KARDEX_EXPORT_ROW_LIMIT = 10_000;

const CSV_ESCAPE_PATTERN = /[",\n\r]/;

export function buildInventoryMovementsCsv(
  rows: InventoryMovementListItem[]
): string {
  const header = [
    "Fecha",
    "Producto",
    "SKU",
    "Tipo",
    "Cantidad",
    "Stock actual",
    "Usuario",
    "Notas",
  ];
  const lines = rows.map((row) => [
    new Date(row.createdAt).toISOString(),
    row.productName,
    row.productSku ?? "",
    row.typeLabel,
    String(row.quantity),
    row.productStock === null ? "" : String(row.productStock),
    row.userName ?? "",
    row.notes ?? "",
  ]);

  const escapeCell = (value: string) => {
    if (CSV_ESCAPE_PATTERN.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  };

  return [header, ...lines]
    .map((cells) => cells.map((cell) => escapeCell(cell)).join(","))
    .join("\r\n");
}

export async function fetchInventoryMovementsForExport({
  listParams,
  runQuery,
}: {
  listParams: Omit<InventoryMovementsListParams, "cursor">;
  runQuery: (
    args: InventoryMovementsListParams
  ) => Promise<InventoryMovementWithRelations[]>;
}): Promise<{ rows: InventoryMovementListItem[]; truncated: boolean }> {
  const exportedRows: InventoryMovementListItem[] = [];
  let cursor: InventoryMovementListCursor | null = null;
  let truncated = false;

  while (exportedRows.length < KARDEX_EXPORT_ROW_LIMIT) {
    const batch = await runQuery({
      ...listParams,
      limit: 100,
      cursor,
    });

    if (batch.length === 0) {
      break;
    }

    const pageItems = batch.map((row) => buildInventoryMovementListItem(row));
    const remaining = KARDEX_EXPORT_ROW_LIMIT - exportedRows.length;
    if (pageItems.length > remaining) {
      exportedRows.push(...pageItems.slice(0, remaining));
      truncated = true;
      break;
    }

    exportedRows.push(...pageItems);

    if (batch.length <= 100) {
      break;
    }

    const lastRow = batch.at(-1);
    if (!lastRow) {
      break;
    }
    cursor = {
      createdAt:
        typeof lastRow.createdAt === "number"
          ? lastRow.createdAt
          : new Date(lastRow.createdAt).getTime(),
      id: lastRow.id,
    };
  }

  return { rows: exportedRows, truncated };
}

export function downloadInventoryMovementsCsv(
  filename: string,
  csvContent: string
) {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
