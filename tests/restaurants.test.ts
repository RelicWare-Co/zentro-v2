import { describe, test, expect } from "bun:test";
import { createTestDb } from "./helpers/test-db";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedShift,
  seedRestaurantArea,
  seedRestaurantTable,
  makeUser,
} from "./helpers/seed";
import { buildMockContext } from "./helpers/orpc-context";
import { createServerORPCClient } from "../server/orpc/client/server";
import {
  restaurantOrder,
  restaurantOrderItem,
  restaurantKitchenTicket,
  restaurantArea,
  restaurantTable,
} from "../database/drizzle/schema/restaurant.schema";
import { sale } from "../database/drizzle/schema/sales.schema";
import { organization } from "../database/drizzle/schema/auth.schema";
import { eq, and } from "drizzle-orm";
import { serializeOrganizationSettingsMetadata } from "../features/settings/settings.shared";

async function setRestaurantModuleEnabled(
  db: ReturnType<typeof createTestDb>["db"],
  organizationId: string,
  enabled: boolean,
) {
  await db
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata({
        modules: {
          restaurants: { enabled },
        },
        restaurants: {
          kitchen: {
            displayEnabled: true,
            printTicketsEnabled: true,
            autoPrintOnSend: true,
          },
        },
      } as any),
    })
    .where(eq(organization.id, organizationId));
}

async function setKitchenDisplayEnabled(
  db: ReturnType<typeof createTestDb>["db"],
  organizationId: string,
  displayEnabled: boolean,
) {
  await db
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata({
        modules: {
          restaurants: { enabled: true },
        },
        restaurants: {
          kitchen: {
            displayEnabled,
            printTicketsEnabled: true,
            autoPrintOnSend: true,
          },
        },
      } as any),
    })
    .where(eq(organization.id, organizationId));
}

describe("restaurant module", () => {
  describe("VAL-REST-001: bootstrap rejects when restaurant module is disabled", () => {
    test("restaurant bootstrap rejects when module disabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      // Default metadata has restaurants disabled

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      await expect(client.restaurants.bootstrap()).rejects.toThrow(
        "El módulo de restaurantes no está habilitado",
      );

      await cleanup();
    });
  });

  describe("VAL-REST-002: add order item creates open order with correct totals", () => {
    test("add order item creates open order and returns correct totals", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, { organizationId, name: "Terrace" });
      const tableId = await seedRestaurantTable(db, {
        organizationId,
        areaId,
        name: "T1",
      });
      const productId = await seedProduct(db, {
        organizationId,
        name: "Burger",
        price: 15000,
        stock: 10,
        trackInventory: false,
      });

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      const result = await client.restaurants.addOrderItem({
        tableId,
        productId,
        quantity: 2,
      });
      expect(result.orderId).toBeString();
      expect(result.itemId).toBeString();
      expect(result.tableId).toBe(tableId);

      // Verify order is open
      const orderRows = await db
        .select()
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, result.orderId));
      expect(orderRows.length).toBe(1);
      expect(orderRows[0].status).toBe("open");
      expect(orderRows[0].tableId).toBe(tableId);

      // Verify item totals
      const itemRows = await db
        .select()
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, result.orderId));
      expect(itemRows.length).toBe(1);
      expect(itemRows[0].quantity).toBe(2);
      expect(itemRows[0].unitPrice).toBe(15000);
      expect(itemRows[0].status).toBe("draft");

      await cleanup();
    });
  });

  describe("VAL-REST-003: send to kitchen creates ticket and updates item status", () => {
    test("send to kitchen creates kitchen ticket and marks items as sent", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, { organizationId, name: "Terrace" });
      const tableId = await seedRestaurantTable(db, {
        organizationId,
        areaId,
        name: "T1",
      });
      const productId = await seedProduct(db, {
        organizationId,
        name: "Pizza",
        price: 20000,
        stock: 10,
        trackInventory: false,
      });

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Add item to table
      const addResult = await client.restaurants.addOrderItem({
        tableId,
        productId,
        quantity: 1,
      });

      // Send to kitchen
      const sendResult = await client.restaurants.sendToKitchen({
        orderId: addResult.orderId,
      });
      expect(sendResult.ticket.id).toBeString();
      expect(sendResult.ticket.sequenceNumber).toBe(1);
      expect(sendResult.ticket.items.length).toBe(1);

      // Verify ticket exists in DB
      const ticketRows = await db
        .select()
        .from(restaurantKitchenTicket)
        .where(eq(restaurantKitchenTicket.id, sendResult.ticket.id));
      expect(ticketRows.length).toBe(1);
      expect(ticketRows[0].status).toBe("sent");

      // Verify items updated
      const itemRows = await db
        .select()
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, addResult.orderId));
      expect(itemRows.length).toBe(1);
      expect(itemRows[0].status).toBe("sent");
      expect(itemRows[0].kitchenTicketId).toBe(sendResult.ticket.id);

      await cleanup();
    });
  });

  describe("VAL-REST-004: close order creates a sale and marks order closed", () => {
    test("close order creates sale and marks order closed", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, { organizationId, name: "Terrace" });
      const tableId = await seedRestaurantTable(db, {
        organizationId,
        areaId,
        name: "T1",
      });
      const productId = await seedProduct(db, {
        organizationId,
        name: "Steak",
        price: 25000,
        stock: 10,
        trackInventory: false,
      });
      const shiftId = await seedShift(db, {
        organizationId,
        userId,
        status: "open",
      });

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Add item, send to kitchen, then close
      const addResult = await client.restaurants.addOrderItem({
        tableId,
        productId,
        quantity: 1,
      });
      await client.restaurants.sendToKitchen({ orderId: addResult.orderId });

      const closeResult = await client.restaurants.closeOrder({
        orderId: addResult.orderId,
        shiftId,
        payments: [{ method: "cash", amount: 25000 }],
      });
      expect(closeResult.saleId).toBeString();
      expect(closeResult.status).toBe("completed");
      expect(closeResult.totalAmount).toBe(25000);

      // Verify order closed
      const orderRows = await db
        .select()
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, addResult.orderId));
      expect(orderRows.length).toBe(1);
      expect(orderRows[0].status).toBe("closed");
      expect(orderRows[0].saleId).toBe(closeResult.saleId);

      // Verify sale exists
      const saleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.id, closeResult.saleId));
      expect(saleRows.length).toBe(1);
      expect(saleRows[0].totalAmount).toBe(25000);
      expect(saleRows[0].status).toBe("completed");

      await cleanup();
    });
  });

  describe("VAL-REST-005: area/table CRUD requires manager access", () => {
    test("non-manager is rejected from createArea, updateArea, deleteArea", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId: managerId } = await seedOrganizationWithMember(
        db,
        { memberRole: "owner", userEmail: "manager@example.com" },
      );
      const { userId: cashierId } = await seedOrganizationWithMember(db, {
        orgName: "Same Org",
        userEmail: "cashier@example.com",
        memberRole: "member",
      });
      // Add cashier as member of same organization
      const memberId = crypto.randomUUID();
      const now = new Date();
      await db
        .insert((await import("../database/drizzle/schema/auth.schema")).member)
        .values({
          id: memberId,
          organizationId,
          userId: cashierId,
          role: "member",
          createdAt: now,
        });

      await setRestaurantModuleEnabled(db, organizationId, true);

      const manager = makeUser({ id: managerId, email: "manager@example.com" });
      const managerCtx = buildMockContext(db, manager, organizationId);
      const managerClient = createServerORPCClient(managerCtx);

      const area = await managerClient.restaurants.createArea({ name: "Patio" });
      const areaId = area[0].id;
      const table = await managerClient.restaurants.createTable({
        areaId,
        name: "T2",
        seats: 4,
      });
      const tableId = table[0].tables[0].id;

      const cashier = makeUser({ id: cashierId, email: "cashier@example.com" });
      const cashierCtx = buildMockContext(db, cashier, organizationId);
      const cashierClient = createServerORPCClient(cashierCtx);

      // createArea rejected
      await expect(
        cashierClient.restaurants.createArea({ name: "Forbidden Area" }),
      ).rejects.toThrow("administrador de la organización");

      // updateArea rejected
      await expect(
        cashierClient.restaurants.updateArea({ id: areaId, name: "New Name" }),
      ).rejects.toThrow("administrador de la organización");

      // deleteArea rejected
      await expect(
        cashierClient.restaurants.deleteArea({ id: areaId }),
      ).rejects.toThrow("administrador de la organización");

      // createTable rejected
      await expect(
        cashierClient.restaurants.createTable({ areaId, name: "Forbidden Table", seats: 2 }),
      ).rejects.toThrow("administrador de la organización");

      // updateTable rejected
      await expect(
        cashierClient.restaurants.updateTable({ id: tableId, name: "New Table Name" }),
      ).rejects.toThrow("administrador de la organización");

      // deleteTable rejected
      await expect(
        cashierClient.restaurants.deleteTable({ id: tableId }),
      ).rejects.toThrow("administrador de la organización");

      await cleanup();
    });

    test("manager can create, update, and delete area and table", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Create area
      const createAreaResult = await client.restaurants.createArea({ name: "Garden" });
      expect(createAreaResult.length).toBe(1);
      const areaId = createAreaResult[0].id;
      expect(createAreaResult[0].name).toBe("Garden");

      // Update area
      const updateAreaResult = await client.restaurants.updateArea({
        id: areaId,
        name: "Garden Updated",
      });
      expect(updateAreaResult[0].name).toBe("Garden Updated");

      // Create table
      const createTableResult = await client.restaurants.createTable({
        areaId,
        name: "GT1",
        seats: 6,
      });
      expect(createTableResult[0].tables.length).toBe(1);
      const tableId = createTableResult[0].tables[0].id;
      expect(createTableResult[0].tables[0].name).toBe("GT1");

      // Update table
      const updateTableResult = await client.restaurants.updateTable({
        id: tableId,
        name: "GT1 Updated",
        seats: 8,
      });
      const updatedTable = updateTableResult[0].tables.find((t: { id: string }) => t.id === tableId);
      expect(updatedTable?.name).toBe("GT1 Updated");
      expect(updatedTable?.seats).toBe(8);

      // Delete table
      const deleteTableResult = await client.restaurants.deleteTable({ id: tableId });
      expect(deleteTableResult[0].tables.length).toBe(0);

      // Delete area
      const deleteAreaResult = await client.restaurants.deleteArea({ id: areaId });
      expect(deleteAreaResult.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-REST-006: kitchen board rejects when display is disabled", () => {
    test("kitchen board rejects when kitchen display setting is disabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      // Enable restaurant module but disable kitchen display
      await setKitchenDisplayEnabled(db, organizationId, false);

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      await expect(client.restaurants.kitchenBoard()).rejects.toThrow(
        "La vista de cocina no está habilitada",
      );

      await cleanup();
    });

    test("kitchen board succeeds when kitchen display is enabled", async () => {
      const { db, cleanup } = createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setKitchenDisplayEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, { organizationId, name: "Terrace" });
      const tableId = await seedRestaurantTable(db, {
        organizationId,
        areaId,
        name: "T1",
      });
      const productId = await seedProduct(db, {
        organizationId,
        name: "Pasta",
        price: 18000,
        stock: 10,
        trackInventory: false,
      });

      const u = makeUser({ id: userId, email: "owner@example.com" });
      const ctx = buildMockContext(db, u, organizationId);
      const client = createServerORPCClient(ctx);

      // Add and send to kitchen to create a ticket
      const addResult = await client.restaurants.addOrderItem({
        tableId,
        productId,
        quantity: 1,
      });
      await client.restaurants.sendToKitchen({ orderId: addResult.orderId });

      // Kitchen board should return tickets
      const board = await client.restaurants.kitchenBoard();
      expect(board.tickets.length).toBeGreaterThanOrEqual(1);
      expect(board.tickets[0].items.length).toBeGreaterThanOrEqual(1);

      await cleanup();
    });
  });
});
