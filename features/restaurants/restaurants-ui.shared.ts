import type { RestaurantBootstrap } from "@/features/restaurants/restaurants.shared";

export type RestaurantTableSummary =
  RestaurantBootstrap["areas"][number]["tables"][number];

export type RestaurantAreaSummary = RestaurantBootstrap["areas"][number];

export type TableOccupancyStatus =
  | "free"
  | "draft"
  | "kitchen"
  | "ready"
  | "occupied";

export function getTableOccupancyStatus(
  table: RestaurantTableSummary
): TableOccupancyStatus {
  const order = table.openOrder;
  if (!order) {
    return "free";
  }
  if (order.draftItemsCount > 0) {
    return "draft";
  }
  if (order.readyItemsCount > 0) {
    return "ready";
  }
  if (order.servedItemsCount < order.itemCount) {
    return "kitchen";
  }
  return "occupied";
}

export function getTableStatusLabel(status: TableOccupancyStatus): string {
  switch (status) {
    case "free":
      return "Libre";
    case "draft":
      return "Pendiente";
    case "kitchen":
      return "En cocina";
    case "ready":
      return "Listo";
    case "occupied":
      return "Ocupada";
    default:
      return "Libre";
  }
}

export function getOrderItemStatusLabel(status: string): string {
  if (status === "draft") {
    return "Pendiente";
  }
  if (status === "sent") {
    return "En cocina";
  }
  if (status === "ready") {
    return "Listo";
  }
  return "Servido";
}

const TABLE_NUMBER_SUFFIX_PATTERN = /(\d+)\s*$/;

export function suggestNextTableName(tables: RestaurantTableSummary[]): string {
  const numericNames = tables
    .map((table) => {
      const match = table.name.match(TABLE_NUMBER_SUFFIX_PATTERN);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null);

  const nextNumber =
    numericNames.length > 0 ? Math.max(...numericNames) + 1 : tables.length + 1;
  return `Mesa ${nextNumber}`;
}

export function countFloorStats(areas: RestaurantAreaSummary[]) {
  let total = 0;
  let occupied = 0;
  let draft = 0;

  for (const area of areas) {
    for (const table of area.tables) {
      if (!table.isActive) {
        continue;
      }
      total += 1;
      const status = getTableOccupancyStatus(table);
      if (status !== "free") {
        occupied += 1;
      }
      if (status === "draft") {
        draft += 1;
      }
    }
  }

  return {
    total,
    occupied,
    free: total - occupied,
    draft,
  };
}
