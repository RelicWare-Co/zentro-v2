import type { z } from "zod";
import type {
  KitchenBoardSchema,
  RestaurantBootstrapSchema,
  RestaurantConfigurationSchema,
  RestaurantTableDetailSchema,
} from "@/features/restaurants/restaurants.schema";
import { getRestaurantModuleSettings } from "@/features/restaurants/restaurants-settings.shared";
import {
  getEnabledPaymentMethods,
  type OrganizationSettings,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";

export type RestaurantBootstrap = z.infer<typeof RestaurantBootstrapSchema>;
export type RestaurantTableDetail = z.infer<typeof RestaurantTableDetailSchema>;
export type RestaurantConfiguration = z.infer<
  typeof RestaurantConfigurationSchema
>;
export type KitchenBoard = z.infer<typeof KitchenBoardSchema>;

export interface RestaurantOrderItemModifierRow {
  id: string;
  modifierProduct?: { name?: string | null } | null;
  modifierProductId: string;
  quantity: number;
  unitPrice: number;
}

export interface RestaurantOrderItemRow {
  cancelledAt?: number | null;
  createdAt: number;
  discountAmount?: number | null;
  id: string;
  kitchenTicketId?: string | null;
  modifiers?: RestaurantOrderItemModifierRow[] | null;
  notes?: string | null;
  orderId: string;
  product?: { name?: string | null } | null;
  productId: string;
  quantity: number;
  readyAt?: number | null;
  sentAt?: number | null;
  servedAt?: number | null;
  status?: string | null;
  taxRate?: number | null;
  unitPrice: number;
  updatedAt: number;
}

export interface RestaurantKitchenTicketRow {
  createdAt: number;
  id: string;
  items?: RestaurantOrderItemRow[] | null;
  order?: RestaurantOpenOrderRow | null;
  orderId: string;
  printedAt?: number | null;
  sequenceNumber: number;
  status?: string | null;
}

export interface RestaurantOpenOrderRow {
  createdAt: number;
  guestCount?: number | null;
  id: string;
  items?: RestaurantOrderItemRow[] | null;
  kitchenTickets?: RestaurantKitchenTicketRow[] | null;
  notes?: string | null;
  orderNumber: number;
  status?: string | null;
  table?: RestaurantTableRow | null;
  tableId: string | null;
  updatedAt: number;
}

export interface RestaurantTableRow {
  area?: { id?: string; name?: string | null } | null;
  areaId: string;
  id: string;
  isActive: boolean;
  name: string;
  seats: number;
  sortOrder: number;
}

export interface RestaurantAreaRow {
  id: string;
  name: string;
  sortOrder: number;
  tables?: RestaurantTableRow[] | null;
}

export interface RestaurantActiveShiftRow {
  closedAt?: number | null;
  id: string;
  notes?: string | null;
  openedAt?: number | null;
  startingCash?: number | null;
  status?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
}

export interface RestaurantCategoryRow {
  description?: string | null;
  id: string;
  name: string;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue.getTime();
}

function calculateModifierTotal(
  baseQuantity: number,
  modifiers: Array<{ quantity: number; unitPrice: number }>
) {
  let total = 0;
  for (const modifier of modifiers) {
    total += baseQuantity * modifier.quantity * modifier.unitPrice;
  }
  return total;
}

export function assertRestaurantModuleEnabled(settings: OrganizationSettings) {
  if (!settings.modules.restaurants.enabled) {
    throw new Error("El módulo de restaurantes no está habilitado.");
  }
}

export function assertKitchenDisplayEnabled(settings: OrganizationSettings) {
  const moduleSettings = getRestaurantModuleSettings(settings);
  if (!moduleSettings.kitchen.displayEnabled) {
    throw new Error("La vista de cocina no está habilitada.");
  }
}

export function buildOrderSummary(
  items: Array<{
    quantity: number;
    status?: string | null;
    totalAmount: number;
  }>
) {
  let itemCount = 0;
  let totalAmount = 0;
  let draftItemsCount = 0;
  let readyItemsCount = 0;
  let servedItemsCount = 0;

  for (const item of items) {
    if (item.status === "cancelled") {
      continue;
    }
    itemCount += item.quantity;
    totalAmount += item.totalAmount;
    if (item.status === "draft") {
      draftItemsCount += item.quantity;
    }
    if (item.status === "ready") {
      readyItemsCount += item.quantity;
    }
    if (item.status === "served") {
      servedItemsCount += item.quantity;
    }
  }

  return {
    itemCount,
    totalAmount,
    draftItemsCount,
    readyItemsCount,
    servedItemsCount,
  };
}

export function mapRestaurantOrderItem(itemRow: RestaurantOrderItemRow) {
  const modifiers = (itemRow.modifiers ?? []).map((modifierRow) => ({
    id: modifierRow.id,
    modifierProductId: modifierRow.modifierProductId,
    quantity: modifierRow.quantity,
    unitPrice: modifierRow.unitPrice,
    name: modifierRow.modifierProduct?.name ?? "Modificador",
  }));
  const modifiersTotal = calculateModifierTotal(itemRow.quantity, modifiers);
  const baseSubtotal = itemRow.quantity * itemRow.unitPrice;

  return {
    id: itemRow.id,
    orderId: itemRow.orderId,
    productId: itemRow.productId,
    productName: itemRow.product?.name ?? "Producto",
    kitchenTicketId: itemRow.kitchenTicketId ?? null,
    quantity: itemRow.quantity,
    unitPrice: itemRow.unitPrice,
    taxRate: itemRow.taxRate ?? 0,
    discountAmount: itemRow.discountAmount ?? 0,
    notes: itemRow.notes ?? null,
    status: itemRow.status ?? "draft",
    modifiers,
    baseSubtotal,
    modifiersTotal,
    totalAmount: baseSubtotal + modifiersTotal - (itemRow.discountAmount ?? 0),
    createdAt: toTimestamp(itemRow.createdAt) ?? Date.now(),
    updatedAt: toTimestamp(itemRow.updatedAt) ?? Date.now(),
    sentAt: toTimestamp(itemRow.sentAt),
    readyAt: toTimestamp(itemRow.readyAt),
    servedAt: toTimestamp(itemRow.servedAt),
    cancelledAt: toTimestamp(itemRow.cancelledAt),
  };
}

export function mapRestaurantKitchenTicket(
  ticketRow: RestaurantKitchenTicketRow
) {
  return {
    id: ticketRow.id,
    sequenceNumber: ticketRow.sequenceNumber,
    status: ticketRow.status ?? "sent",
    createdAt: toTimestamp(ticketRow.createdAt) ?? Date.now(),
    printedAt: toTimestamp(ticketRow.printedAt),
  };
}

export function buildRestaurantOpenOrder(
  orderRow: RestaurantOpenOrderRow
): NonNullable<RestaurantTableDetail["openOrder"]> {
  const items = (orderRow.items ?? [])
    .slice()
    .sort(
      (left, right) =>
        (toTimestamp(left.createdAt) ?? 0) -
          (toTimestamp(right.createdAt) ?? 0) || left.id.localeCompare(right.id)
    )
    .map((itemRow) => mapRestaurantOrderItem(itemRow));
  const tickets = (orderRow.kitchenTickets ?? [])
    .slice()
    .sort((left, right) => right.sequenceNumber - left.sequenceNumber)
    .map((ticketRow) => mapRestaurantKitchenTicket(ticketRow));

  return {
    id: orderRow.id,
    orderNumber: orderRow.orderNumber,
    guestCount: orderRow.guestCount ?? 0,
    notes: orderRow.notes ?? null,
    createdAt: toTimestamp(orderRow.createdAt) ?? Date.now(),
    updatedAt: toTimestamp(orderRow.updatedAt) ?? Date.now(),
    items,
    tickets,
    totals: buildOrderSummary(items),
  };
}

function sortTables<OpenOrder>(
  tables: Array<RestaurantTableRow & { openOrder: OpenOrder }>
) {
  return tables.toSorted(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name, "es-CO")
  );
}

function groupAreasWithTables<OpenOrder>(
  areas: RestaurantAreaRow[],
  tables: Array<RestaurantTableRow & { openOrder: OpenOrder }>
): Array<{
  id: string;
  name: string;
  sortOrder: number;
  tables: Array<RestaurantTableRow & { openOrder: OpenOrder }>;
}> {
  const tablesByAreaId = new Map<
    string,
    Array<RestaurantTableRow & { openOrder: OpenOrder }>
  >();
  for (const table of tables) {
    const collection = tablesByAreaId.get(table.areaId) ?? [];
    collection.push(table);
    tablesByAreaId.set(table.areaId, collection);
  }

  return areas
    .slice()
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "es-CO")
    )
    .map((area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      tables: sortTables(tablesByAreaId.get(area.id) ?? []),
    }));
}

export function buildRestaurantConfiguration(
  areas: RestaurantAreaRow[],
  organizationMetadata: string | null | undefined
): RestaurantConfiguration {
  assertRestaurantModuleEnabled(
    parseOrganizationSettingsMetadata(organizationMetadata)
  );

  return areas
    .slice()
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "es-CO")
    )
    .map((area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      tables: sortTables(
        (area.tables ?? []).map((table) => ({
          id: table.id,
          areaId: table.areaId,
          name: table.name,
          seats: table.seats,
          sortOrder: table.sortOrder,
          isActive: table.isActive,
          openOrder: null,
        }))
      ),
    }));
}

export function buildRestaurantBootstrap(params: {
  activeShift: RestaurantActiveShiftRow | null;
  categories: RestaurantCategoryRow[];
  organizationMetadata: string | null | undefined;
  areas: RestaurantAreaRow[];
  openOrders: RestaurantOpenOrderRow[];
}): RestaurantBootstrap {
  const organizationSettings = parseOrganizationSettingsMetadata(
    params.organizationMetadata
  );
  assertRestaurantModuleEnabled(organizationSettings);

  const summariesByOrderId = new Map(
    params.openOrders.map((orderRow) => {
      const items = (orderRow.items ?? []).map((itemRow) =>
        mapRestaurantOrderItem(itemRow)
      );
      return [orderRow.id, buildOrderSummary(items)] as const;
    })
  );

  const openOrderByTableId = new Map<
    string,
    {
      id: string;
      orderNumber: number;
      itemCount: number;
      totalAmount: number;
      draftItemsCount: number;
      readyItemsCount: number;
      servedItemsCount: number;
    }
  >();

  for (const orderRow of params.openOrders) {
    const summary = summariesByOrderId.get(orderRow.id);
    if (!(summary && orderRow.tableId)) {
      continue;
    }
    openOrderByTableId.set(orderRow.tableId, {
      id: orderRow.id,
      orderNumber: orderRow.orderNumber,
      ...summary,
    });
  }

  const tables = params.areas.flatMap((area) =>
    (area.tables ?? []).map((table) => ({
      id: table.id,
      areaId: table.areaId,
      name: table.name,
      seats: table.seats,
      sortOrder: table.sortOrder,
      isActive: table.isActive,
      openOrder: openOrderByTableId.get(table.id) ?? null,
    }))
  );

  const paymentMethods = getEnabledPaymentMethods(organizationSettings).map(
    (paymentMethod) => ({
      id: paymentMethod.id,
      label: paymentMethod.label,
      requiresReference: paymentMethod.requiresReference,
    })
  );

  return {
    activeShift: params.activeShift
      ? {
          id: params.activeShift.id,
          terminalId: params.activeShift.terminalId ?? null,
          terminalName: params.activeShift.terminalName ?? null,
          status: params.activeShift.status ?? "open",
          startingCash: params.activeShift.startingCash ?? 0,
          openedAt: toTimestamp(params.activeShift.openedAt),
          closedAt: toTimestamp(params.activeShift.closedAt),
          notes: params.activeShift.notes ?? null,
        }
      : null,
    categories: params.categories
      .filter((category) => category.id && category.name)
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description ?? null,
      })),
    settings: {
      paymentMethods,
      defaultTerminalName: organizationSettings.pos.defaultTerminalName,
      restaurant: getRestaurantModuleSettings(organizationSettings),
    },
    areas: groupAreasWithTables(params.areas, tables),
  };
}

export function buildRestaurantTableDetail(params: {
  organizationMetadata: string | null | undefined;
  table: RestaurantTableRow;
  openOrder: RestaurantOpenOrderRow | null;
}): RestaurantTableDetail {
  assertRestaurantModuleEnabled(
    parseOrganizationSettingsMetadata(params.organizationMetadata)
  );

  return {
    table: {
      id: params.table.id,
      areaId: params.table.areaId,
      name: params.table.name,
      seats: params.table.seats,
      isActive: params.table.isActive,
      areaName: params.table.area?.name ?? "",
    },
    openOrder: params.openOrder
      ? buildRestaurantOpenOrder(params.openOrder)
      : null,
  };
}

export function buildKitchenBoard(params: {
  organizationMetadata: string | null | undefined;
  tickets: RestaurantKitchenTicketRow[];
}): KitchenBoard {
  const organizationSettings = parseOrganizationSettingsMetadata(
    params.organizationMetadata
  );
  assertRestaurantModuleEnabled(organizationSettings);
  assertKitchenDisplayEnabled(organizationSettings);

  const tickets = params.tickets
    .slice()
    .sort(
      (left, right) =>
        (toTimestamp(right.createdAt) ?? 0) - (toTimestamp(left.createdAt) ?? 0)
    )
    .flatMap((ticketRow) => {
      const orderRow = ticketRow.order;
      const tableRow = orderRow?.table;
      if (!(orderRow && tableRow && orderRow.status === "open")) {
        return [];
      }

      const items = (ticketRow.items ?? [])
        .filter(
          (itemRow) => itemRow.status === "sent" || itemRow.status === "ready"
        )
        .map((itemRow) => ({
          id: itemRow.id,
          kitchenTicketId: itemRow.kitchenTicketId ?? null,
          productName: itemRow.product?.name ?? "Producto",
          quantity: itemRow.quantity,
          status: itemRow.status ?? "sent",
          notes: itemRow.notes ?? null,
        }));

      if (items.length === 0) {
        return [];
      }

      return [
        {
          id: ticketRow.id,
          orderId: ticketRow.orderId,
          orderNumber: orderRow.orderNumber,
          sequenceNumber: ticketRow.sequenceNumber,
          status: ticketRow.status ?? "sent",
          createdAt: toTimestamp(ticketRow.createdAt) ?? Date.now(),
          table: {
            id: tableRow.id,
            name: tableRow.name,
            areaName: tableRow.area?.name ?? "",
          },
          items,
        },
      ];
    });

  return { tickets };
}
