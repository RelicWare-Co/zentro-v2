import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  restaurantKitchenTicket,
  restaurantOrder,
  restaurantOrderItem,
} from "@/database/drizzle/schema/restaurant.schema";
import { sale } from "@/database/drizzle/schema/sales.schema";
import { serializeOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedRestaurantArea,
  seedRestaurantTable,
  seedShift,
} from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  addRestaurantOrderItemViaZero,
  closeRestaurantOrderViaZero,
  createRestaurantAreaViaZero,
  createRestaurantTableViaZero,
  deleteRestaurantAreaViaZero,
  deleteRestaurantTableViaZero,
  getKitchenBoardViaZero,
  getRestaurantBootstrapViaZero,
  sendRestaurantOrderToKitchenViaZero,
  updateRestaurantAreaViaZero,
  updateRestaurantTableViaZero,
} from "./helpers/zero-restaurants";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

async function setRestaurantModuleEnabled(
  db: TestDb,
  organizationId: string,
  enabled: boolean
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
  db: TestDb,
  organizationId: string,
  displayEnabled: boolean
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
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      await expect(
        getRestaurantBootstrapViaZero({ zeroDb, ctx: zeroCtx })
      ).rejects.toThrow("El módulo de restaurantes no está habilitado");

      await cleanup();
    });
  });

  describe("VAL-REST-002: add order item creates open order with correct totals", () => {
    test("add order item creates open order and returns correct totals", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terrace",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Burger",
          price: 15_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const result = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId,
          quantity: 2,
        },
      });
      expect(result.orderId).toBeString();
      expect(result.itemId).toBeString();
      expect(result.tableId).toBe(tableId);

      const orderRows = await db
        .select()
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, result.orderId));
      expect(orderRows.length).toBe(1);
      expect(orderRows[0].status).toBe("open");
      expect(orderRows[0].tableId).toBe(tableId);

      const itemRows = await db
        .select()
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, result.orderId));
      expect(itemRows.length).toBe(1);
      expect(itemRows[0].quantity).toBe(2);
      expect(itemRows[0].unitPrice).toBe(15_000);
      expect(itemRows[0].status).toBe("draft");

      await cleanup();
    });
  });

  describe("VAL-REST-003: send to kitchen creates ticket and updates item status", () => {
    test("send to kitchen creates kitchen ticket and marks items as sent", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terrace",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Pizza",
          price: 20_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const addResult = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId,
          quantity: 1,
        },
      });

      const sendResult = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });
      expect(sendResult.ticket.id).toBeString();
      expect(sendResult.ticket.sequenceNumber).toBe(1);
      expect(sendResult.ticket.items.length).toBe(1);

      const ticketRows = await db
        .select()
        .from(restaurantKitchenTicket)
        .where(eq(restaurantKitchenTicket.id, sendResult.ticket.id));
      expect(ticketRows.length).toBe(1);
      expect(ticketRows[0].status).toBe("sent");

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
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terrace",
      });
      const [tableId, productId, shiftId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Steak",
          price: 25_000,
          stock: 10,
          trackInventory: false,
        }),
        seedShift(db, {
          organizationId,
          userId,
          status: "open",
        }),
      ]);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const addResult = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId,
          quantity: 1,
        },
      });
      await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });

      const closeResult = await closeRestaurantOrderViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderId: addResult.orderId,
          shiftId,
          payments: [{ method: "cash", amount: 25_000 }],
        },
      });
      expect(closeResult.saleId).toBeString();
      expect(closeResult.status).toBe("completed");
      expect(closeResult.totalAmount).toBe(25_000);

      const orderRows = await db
        .select()
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, addResult.orderId));
      expect(orderRows.length).toBe(1);
      expect(orderRows[0].status).toBe("closed");
      expect(orderRows[0].saleId).toBe(closeResult.saleId);

      const saleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.id, closeResult.saleId));
      expect(saleRows.length).toBe(1);
      expect(saleRows[0].totalAmount).toBe(25_000);
      expect(saleRows[0].status).toBe("completed");

      await cleanup();
    });
  });

  describe("VAL-REST-005: area/table CRUD requires manager access", () => {
    test("non-manager is rejected from createArea, updateArea, deleteArea", async () => {
      const { db, cleanup } = await createTestDb();
      const [{ organizationId, userId: managerId }, { userId: cashierId }] =
        await Promise.all([
          seedOrganizationWithMember(db, {
            memberRole: "owner",
            userEmail: "manager@example.com",
          }),
          seedOrganizationWithMember(db, {
            orgName: "Same Org",
            userEmail: "cashier@example.com",
            memberRole: "member",
          }),
        ]);

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

      const managerZeroDb = createZeroTestDb(db);
      const managerCtx = createZeroContext(managerId, organizationId);
      const cashierZeroDb = createZeroTestDb(db);
      const cashierCtx = createZeroContext(cashierId, organizationId);

      const area = await createRestaurantAreaViaZero({
        zeroDb: managerZeroDb,
        ctx: managerCtx,
        input: { name: "Patio" },
      });
      const areaId = area[0].id;
      const table = await createRestaurantTableViaZero({
        zeroDb: managerZeroDb,
        ctx: managerCtx,
        input: {
          areaId,
          name: "T2",
          seats: 4,
        },
      });
      const tableId = table[0].tables[0].id;

      await expect(
        createRestaurantAreaViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: { name: "Forbidden Area" },
        })
      ).rejects.toThrow("administrador de la organización");

      await expect(
        updateRestaurantAreaViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: { id: areaId, name: "New Name" },
        })
      ).rejects.toThrow("administrador de la organización");

      await expect(
        deleteRestaurantAreaViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: { id: areaId },
        })
      ).rejects.toThrow("administrador de la organización");

      await expect(
        createRestaurantTableViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: {
            areaId,
            name: "Forbidden Table",
            seats: 2,
          },
        })
      ).rejects.toThrow("administrador de la organización");

      await expect(
        updateRestaurantTableViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: {
            id: tableId,
            name: "New Table Name",
          },
        })
      ).rejects.toThrow("administrador de la organización");

      await expect(
        deleteRestaurantTableViaZero({
          zeroDb: cashierZeroDb,
          ctx: cashierCtx,
          input: { id: tableId },
        })
      ).rejects.toThrow("administrador de la organización");

      await cleanup();
    });

    test("manager can create, update, and delete area and table", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const createAreaResult = await createRestaurantAreaViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { name: "Garden" },
      });
      expect(createAreaResult.length).toBe(1);
      const areaId = createAreaResult[0].id;
      expect(createAreaResult[0].name).toBe("Garden");

      const updateAreaResult = await updateRestaurantAreaViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { id: areaId, name: "Garden Updated" },
      });
      expect(updateAreaResult[0].name).toBe("Garden Updated");

      const createTableResult = await createRestaurantTableViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          areaId,
          name: "GT1",
          seats: 6,
        },
      });
      expect(createTableResult[0].tables.length).toBe(1);
      const tableId = createTableResult[0].tables[0].id;
      expect(createTableResult[0].tables[0].name).toBe("GT1");

      const updateTableResult = await updateRestaurantTableViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          id: tableId,
          name: "GT1 Updated",
          seats: 8,
        },
      });
      const updatedTable = updateTableResult[0].tables.find(
        (table) => table.id === tableId
      );
      expect(updatedTable?.name).toBe("GT1 Updated");
      expect(updatedTable?.seats).toBe(8);

      const deleteTableResult = await deleteRestaurantTableViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { id: tableId },
      });
      expect(deleteTableResult[0].tables.length).toBe(0);

      const deleteAreaResult = await deleteRestaurantAreaViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { id: areaId },
      });
      expect(deleteAreaResult.length).toBe(0);

      await cleanup();
    });
  });

  describe("VAL-REST-006: kitchen board rejects when display is disabled", () => {
    test("kitchen board rejects when kitchen display setting is disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setKitchenDisplayEnabled(db, organizationId, false);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      await expect(
        getKitchenBoardViaZero({ zeroDb, ctx: zeroCtx })
      ).rejects.toThrow("La vista de cocina no está habilitada");

      await cleanup();
    });

    test("kitchen board succeeds when kitchen display is enabled", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setKitchenDisplayEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terrace",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Pasta",
          price: 18_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const addResult = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId,
          quantity: 1,
        },
      });
      await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });

      const board = await getKitchenBoardViaZero({ zeroDb, ctx: zeroCtx });
      expect(board.tickets.length).toBeGreaterThanOrEqual(1);
      expect(board.tickets[0].items.length).toBeGreaterThanOrEqual(1);

      await cleanup();
    });
  });

  describe("VAL-REST-007: kitchen board only returns active tickets", () => {
    test("kitchen board excludes terminal tickets", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setKitchenDisplayEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terrace",
      });
      const [tableId, activeProductId, terminalProductId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Arepa",
          price: 12_000,
          stock: 10,
          trackInventory: false,
        }),
        seedProduct(db, {
          organizationId,
          name: "Sopa",
          price: 14_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);

      const zeroDb = createZeroTestDb(db);
      const zeroCtx = createZeroContext(userId, organizationId);

      const activeOrderItem = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId: activeProductId,
          quantity: 1,
        },
      });
      const activeTicket = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: activeOrderItem.orderId },
      });

      const terminalOrderItem = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          tableId,
          productId: terminalProductId,
          quantity: 1,
        },
      });
      const terminalTicket = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: terminalOrderItem.orderId },
      });

      await db
        .update(restaurantKitchenTicket)
        .set({ status: "served" })
        .where(eq(restaurantKitchenTicket.id, terminalTicket.ticket.id));
      await db
        .update(restaurantOrderItem)
        .set({ status: "served" })
        .where(
          eq(restaurantOrderItem.kitchenTicketId, terminalTicket.ticket.id)
        );

      const board = await getKitchenBoardViaZero({ zeroDb, ctx: zeroCtx });
      expect(board.tickets.map((ticket) => ticket.id)).toEqual([
        activeTicket.ticket.id,
      ]);

      await cleanup();
    });
  });
});
