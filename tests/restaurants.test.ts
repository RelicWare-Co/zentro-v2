import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { product } from "@/database/drizzle/schema/inventory.schema";
import {
  restaurantArea,
  restaurantKitchenTicket,
  restaurantKitchenTicketLine,
  restaurantOrder,
  restaurantOrderItem,
  restaurantTable,
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
  cancelRestaurantOrderViaZero,
  closeRestaurantOrderViaZero,
  createRestaurantAreaViaZero,
  createRestaurantTableViaZero,
  deleteRestaurantAreaViaZero,
  deleteRestaurantOrderItemViaZero,
  deleteRestaurantTableViaZero,
  ensureDefaultRestaurantAreasViaZero,
  getKitchenBoardViaZero,
  getRestaurantBootstrapViaZero,
  getRestaurantTableDetailViaZero,
  sendRestaurantOrderToKitchenViaZero,
  updateRestaurantAreaViaZero,
  updateRestaurantOrderItemStatusViaZero,
  updateRestaurantOrderItemViaZero,
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
  describe("VAL-REST-000: special areas can be restored for existing organizations", () => {
    test("creates only the missing delivery and pickup areas", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);
      await seedRestaurantArea(db, {
        organizationId,
        name: "Domicilios",
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);

      await ensureDefaultRestaurantAreasViaZero({ zeroDb, ctx });
      await ensureDefaultRestaurantAreasViaZero({ zeroDb, ctx });

      const areas = await db
        .select({ name: restaurantArea.name })
        .from(restaurantArea)
        .where(eq(restaurantArea.organizationId, organizationId));
      expect(areas.map((area) => area.name).sort()).toEqual([
        "Domicilios",
        "Recogida",
      ]);

      await cleanup();
    });
  });

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
      expect(sendResult.ticket.kind).toBe("initial");
      expect(sendResult.ticket.lines).toHaveLength(1);

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

  describe("VAL-REST-003A: item notes persist and create immutable corrections", () => {
    test("sends a correction for a note change without altering the original ticket", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T1",
        }),
        seedProduct(db, {
          organizationId,
          name: "Hamburguesa",
          price: 15_000,
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

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderItemId: addResult.itemId,
          quantity: 1,
          notes: "Sin cebolla",
        },
      });

      const [itemRow, tableDetail] = await Promise.all([
        db
          .select({ notes: restaurantOrderItem.notes })
          .from(restaurantOrderItem)
          .where(eq(restaurantOrderItem.id, addResult.itemId)),
        getRestaurantTableDetailViaZero({
          zeroDb,
          ctx: zeroCtx,
          tableId,
        }),
      ]);
      expect(itemRow[0]?.notes).toBe("Sin cebolla");
      expect(tableDetail.openOrder?.items[0]?.notes).toBe("Sin cebolla");

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderItemId: addResult.itemId,
          quantity: 1,
          notes: null,
        },
      });
      const [clearedItemRow, clearedTableDetail] = await Promise.all([
        db
          .select({ notes: restaurantOrderItem.notes })
          .from(restaurantOrderItem)
          .where(eq(restaurantOrderItem.id, addResult.itemId)),
        getRestaurantTableDetailViaZero({
          zeroDb,
          ctx: zeroCtx,
          tableId,
        }),
      ]);
      expect(clearedItemRow[0]?.notes).toBeNull();
      expect(clearedTableDetail.openOrder?.items[0]?.notes).toBeNull();

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderItemId: addResult.itemId,
          quantity: 1,
          notes: "Sin cebolla",
        },
      });

      const initialSend = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });

      const kitchenBoard = await getKitchenBoardViaZero({
        zeroDb,
        ctx: zeroCtx,
      });
      expect(kitchenBoard.tickets[0]?.lines[0]?.notes).toBe("Sin cebolla");

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderItemId: addResult.itemId,
          quantity: 1,
          notes: "Sin tomate",
        },
      });
      const pendingCorrectionDetail = await getRestaurantTableDetailViaZero({
        zeroDb,
        ctx: zeroCtx,
        tableId,
      });
      expect(pendingCorrectionDetail.openOrder?.hasPendingKitchenChanges).toBe(
        true
      );

      const correctionSend = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });
      expect(correctionSend.ticket.kind).toBe("correction");
      expect(correctionSend.ticket.sequenceNumber).toBe(2);

      const ticketLines = await db
        .select({
          kitchenTicketId: restaurantKitchenTicketLine.kitchenTicketId,
          notes: restaurantKitchenTicketLine.notes,
          operation: restaurantKitchenTicketLine.operation,
        })
        .from(restaurantKitchenTicketLine)
        .where(eq(restaurantKitchenTicketLine.orderItemId, addResult.itemId));
      const initialLines = ticketLines.filter(
        (line) => line.kitchenTicketId === initialSend.ticket.id
      );
      const correctionLines = ticketLines.filter(
        (line) => line.kitchenTicketId === correctionSend.ticket.id
      );
      expect(initialLines).toEqual([
        expect.objectContaining({ operation: "prepare", notes: "Sin cebolla" }),
      ]);
      expect(correctionLines).toEqual([
        expect.objectContaining({ operation: "cancel", notes: "Sin cebolla" }),
        expect.objectContaining({ operation: "prepare", notes: "Sin tomate" }),
      ]);

      const correctionBoard = await getKitchenBoardViaZero({
        zeroDb,
        ctx: zeroCtx,
      });
      expect(correctionBoard.tickets[0]).toMatchObject({
        kind: "correction",
        orderNumber: kitchenBoard.tickets[0]?.orderNumber,
        sequenceNumber: 2,
      });
      expect(correctionBoard.tickets[0]?.lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: "cancel",
            notes: "Sin cebolla",
          }),
          expect.objectContaining({
            operation: "prepare",
            notes: "Sin tomate",
          }),
        ])
      );

      await cleanup();
    });
  });

  describe("VAL-REST-003B: quantity, cancellation, and replacement corrections", () => {
    test("emits only the deltas for quantity changes and item replacement", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, burgerId, saladId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T2",
        }),
        seedProduct(db, {
          organizationId,
          name: "Hamburguesa",
          price: 15_000,
          stock: 10,
          trackInventory: false,
        }),
        seedProduct(db, {
          organizationId,
          name: "Ensalada",
          price: 12_000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);
      const burger = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx,
        input: { tableId, productId: burgerId, quantity: 2 },
      });
      const initial = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: burger.orderId },
      });
      const [initialBurgerSnapshot] = await db
        .select({ sentProductName: restaurantOrderItem.sentProductName })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, burger.itemId));
      expect(initialBurgerSnapshot?.sentProductName).toBe("Hamburguesa");

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx,
        input: { orderItemId: burger.itemId, quantity: 3 },
      });
      const increase = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: burger.orderId },
      });

      const [increaseLine] = await db
        .select({
          operation: restaurantKitchenTicketLine.operation,
          quantity: restaurantKitchenTicketLine.quantity,
        })
        .from(restaurantKitchenTicketLine)
        .where(
          eq(restaurantKitchenTicketLine.kitchenTicketId, increase.ticket.id)
        );
      expect(increaseLine).toEqual({ operation: "prepare", quantity: 1 });
      const [increasedBurgerSnapshot] = await db
        .select({
          sentProductName: restaurantOrderItem.sentProductName,
          sentQuantity: restaurantOrderItem.sentQuantity,
        })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, burger.itemId));
      expect(increasedBurgerSnapshot?.sentProductName).toBe("Hamburguesa");
      expect(increasedBurgerSnapshot?.sentQuantity).toBe(3);

      await db
        .update(product)
        .set({ name: "Hamburguesa renovada" })
        .where(eq(product.id, burgerId));

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx,
        input: { orderItemId: burger.itemId, quantity: 1 },
      });
      const decrease = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: burger.orderId },
      });
      const [decreaseLine] = await db
        .select({
          operation: restaurantKitchenTicketLine.operation,
          productName: restaurantKitchenTicketLine.productName,
          quantity: restaurantKitchenTicketLine.quantity,
        })
        .from(restaurantKitchenTicketLine)
        .where(
          eq(restaurantKitchenTicketLine.kitchenTicketId, decrease.ticket.id)
        );
      expect(decreaseLine).toEqual({
        operation: "cancel",
        productName: "Hamburguesa",
        quantity: 2,
      });

      await deleteRestaurantOrderItemViaZero({
        zeroDb,
        ctx,
        input: { orderItemId: burger.itemId },
      });
      const salad = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx,
        input: { tableId, productId: saladId, quantity: 1 },
      });
      expect(salad.orderId).toBe(burger.orderId);

      const replacement = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: burger.orderId },
      });
      const replacementLines = await db
        .select({
          operation: restaurantKitchenTicketLine.operation,
          productName: restaurantKitchenTicketLine.productName,
          quantity: restaurantKitchenTicketLine.quantity,
        })
        .from(restaurantKitchenTicketLine)
        .where(
          eq(restaurantKitchenTicketLine.kitchenTicketId, replacement.ticket.id)
        );
      expect(replacementLines).toEqual(
        expect.arrayContaining([
          { operation: "cancel", productName: "Hamburguesa", quantity: 1 },
          { operation: "prepare", productName: "Ensalada", quantity: 1 },
        ])
      );

      const [burgerRow] = await db
        .select({
          kitchenTicketId: restaurantOrderItem.kitchenTicketId,
          status: restaurantOrderItem.status,
        })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, burger.itemId));
      expect(burgerRow).toEqual({
        kitchenTicketId: replacement.ticket.id,
        status: "cancelled",
      });

      const [initialLine] = initial.ticket.lines;
      if (!initialLine) {
        throw new Error("La comanda inicial no creó una línea de cocina.");
      }
      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx,
        input: { ticketLineId: initialLine.id, status: "ready" },
      });
      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx,
        input: { ticketLineId: initialLine.id, status: "served" },
      });
      const [afterHistoricalStatusUpdate] = await db
        .select({
          kitchenTicketId: restaurantOrderItem.kitchenTicketId,
          status: restaurantOrderItem.status,
        })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, burger.itemId));
      expect(afterHistoricalStatusUpdate).toEqual({
        kitchenTicketId: replacement.ticket.id,
        status: "cancelled",
      });
      await expect(
        updateRestaurantOrderItemViaZero({
          zeroDb,
          ctx,
          input: { orderItemId: burger.itemId, quantity: 2 },
        })
      ).rejects.toThrow("Solo puedes editar ítems que siguen en preparación.");
      await expect(
        deleteRestaurantOrderItemViaZero({
          zeroDb,
          ctx,
          input: { orderItemId: burger.itemId },
        })
      ).rejects.toThrow(
        "Solo puedes eliminar ítems que siguen en preparación."
      );

      await cleanup();
    });
  });

  describe("VAL-REST-003C: correction authorization and terminal states", () => {
    test("keeps corrections isolated by organization and rejects edits after ready", async () => {
      const { db, cleanup } = await createTestDb();
      const [ownerA, ownerB] = await Promise.all([
        seedOrganizationWithMember(db, { memberRole: "owner" }),
        seedOrganizationWithMember(db, { memberRole: "owner" }),
      ]);
      await Promise.all([
        setRestaurantModuleEnabled(db, ownerA.organizationId, true),
        setRestaurantModuleEnabled(db, ownerB.organizationId, true),
      ]);

      const areaId = await seedRestaurantArea(db, {
        organizationId: ownerA.organizationId,
        name: "Terraza",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId: ownerA.organizationId,
          areaId,
          name: "T3",
        }),
        seedProduct(db, {
          organizationId: ownerA.organizationId,
          name: "Sopa",
          price: 8000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const ctxA = createZeroContext(ownerA.userId, ownerA.organizationId);
      const ctxB = createZeroContext(ownerB.userId, ownerB.organizationId);
      const added = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx: ctxA,
        input: { tableId, productId, quantity: 1 },
      });
      const sent = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: ctxA,
        input: { orderId: added.orderId },
      });

      await expect(
        sendRestaurantOrderToKitchenViaZero({
          db,
          zeroDb,
          ctx: ctxB,
          input: { orderId: added.orderId },
        })
      ).rejects.toThrow("La cuenta no existe o ya no está abierta.");

      const [ticketLine] = sent.ticket.lines;
      if (!ticketLine) {
        throw new Error("La comanda inicial no creó una línea de cocina.");
      }
      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx: ctxA,
        input: { ticketLineId: ticketLine.id, status: "ready" },
      });
      await expect(
        updateRestaurantOrderItemViaZero({
          zeroDb,
          ctx: ctxA,
          input: { orderItemId: added.itemId, quantity: 2 },
        })
      ).rejects.toThrow("Solo puedes editar ítems que siguen en preparación.");

      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx: ctxA,
        input: { ticketLineId: ticketLine.id, status: "served" },
      });
      await expect(
        deleteRestaurantOrderItemViaZero({
          zeroDb,
          ctx: ctxA,
          input: { orderItemId: added.itemId },
        })
      ).rejects.toThrow(
        "Solo puedes eliminar ítems que siguen en preparación."
      );

      await cleanup();
    });

    test("does not let a delayed KDS action regress a served line", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, firstProductId, secondProductId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T3B",
        }),
        seedProduct(db, {
          organizationId,
          name: "Sopa",
          price: 8000,
          stock: 10,
          trackInventory: false,
        }),
        seedProduct(db, {
          organizationId,
          name: "Ensalada",
          price: 9000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);
      const firstItem = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx,
        input: { tableId, productId: firstProductId, quantity: 1 },
      });
      await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx,
        input: { tableId, productId: secondProductId, quantity: 1 },
      });
      const sent = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: firstItem.orderId },
      });
      const ticketLines = await db
        .select({
          id: restaurantKitchenTicketLine.id,
          orderItemId: restaurantKitchenTicketLine.orderItemId,
        })
        .from(restaurantKitchenTicketLine)
        .where(eq(restaurantKitchenTicketLine.kitchenTicketId, sent.ticket.id));
      const firstLine = ticketLines.find(
        (line) => line.orderItemId === firstItem.itemId
      );
      if (!firstLine) {
        throw new Error(
          "La comanda inicial no creó la primera línea de cocina."
        );
      }

      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx,
        input: { ticketLineId: firstLine.id, status: "served" },
      });
      await expect(
        updateRestaurantOrderItemStatusViaZero({
          zeroDb,
          ctx,
          input: { ticketLineId: firstLine.id, status: "ready" },
        })
      ).rejects.toThrow("La línea ya está finalizada.");

      const [[lineRow], [itemRow]] = await Promise.all([
        db
          .select({ status: restaurantKitchenTicketLine.status })
          .from(restaurantKitchenTicketLine)
          .where(eq(restaurantKitchenTicketLine.id, firstLine.id)),
        db
          .select({ status: restaurantOrderItem.status })
          .from(restaurantOrderItem)
          .where(eq(restaurantOrderItem.id, firstItem.itemId)),
      ]);
      expect(lineRow?.status).toBe("served");
      expect(itemRow?.status).toBe("served");

      await cleanup();
    });
  });

  describe("VAL-REST-003D: historical kitchen lines preserve the latest correction state", () => {
    test("does not let an old line block an item whose correction remains sent", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Terraza",
      });
      const [tableId, productId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T4",
        }),
        seedProduct(db, {
          organizationId,
          name: "Arepa",
          price: 6000,
          stock: 10,
          trackInventory: false,
        }),
      ]);
      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);
      const added = await addRestaurantOrderItemViaZero({
        db,
        zeroDb,
        ctx,
        input: {
          tableId,
          productId,
          quantity: 1,
          notes: "Con queso",
        },
      });
      const initial = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: added.orderId },
      });

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx,
        input: {
          orderItemId: added.itemId,
          quantity: 1,
          notes: "Sin queso",
        },
      });
      const correction = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx,
        input: { orderId: added.orderId },
      });
      const [initialLine] = initial.ticket.lines;
      if (!initialLine) {
        throw new Error("La comanda inicial no creó una línea de cocina.");
      }

      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx,
        input: { ticketLineId: initialLine.id, status: "ready" },
      });

      const [afterReady] = await db
        .select({
          kitchenTicketId: restaurantOrderItem.kitchenTicketId,
          status: restaurantOrderItem.status,
        })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, added.itemId));
      expect(afterReady).toEqual({
        kitchenTicketId: correction.ticket.id,
        status: "sent",
      });

      await updateRestaurantOrderItemViaZero({
        zeroDb,
        ctx,
        input: { orderItemId: added.itemId, quantity: 2, notes: "Sin queso" },
      });

      await updateRestaurantOrderItemStatusViaZero({
        zeroDb,
        ctx,
        input: { ticketLineId: initialLine.id, status: "served" },
      });
      const [afterServed] = await db
        .select({
          kitchenTicketId: restaurantOrderItem.kitchenTicketId,
          status: restaurantOrderItem.status,
        })
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.id, added.itemId));
      expect(afterServed).toEqual({
        kitchenTicketId: correction.ticket.id,
        status: "sent",
      });

      await cleanup();
    });
  });

  describe("VAL-REST-004: cancel order releases the table without creating a sale", () => {
    test("cancels an order already sent to kitchen", async () => {
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
          trackInventory: true,
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
      const sent = await sendRestaurantOrderToKitchenViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: { orderId: addResult.orderId },
      });

      await cancelRestaurantOrderViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderId: addResult.orderId,
          reason: "El cliente se retiró",
        },
      });

      const [orderRow] = await db
        .select()
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, addResult.orderId));
      expect(orderRow?.status).toBe("cancelled");
      expect(orderRow?.cancelledByUserId).toBe(userId);
      expect(orderRow?.cancellationReason).toBe("El cliente se retiró");
      expect(orderRow?.cancelledAt).toBeInstanceOf(Date);
      expect(orderRow?.saleId).toBeNull();

      const itemRows = await db
        .select()
        .from(restaurantOrderItem)
        .where(eq(restaurantOrderItem.orderId, addResult.orderId));
      expect(itemRows).toHaveLength(1);
      expect(itemRows[0]?.status).toBe("cancelled");
      expect(itemRows[0]?.cancelledAt).toBeInstanceOf(Date);

      const ticketRows = await db
        .select()
        .from(restaurantKitchenTicket)
        .where(eq(restaurantKitchenTicket.orderId, addResult.orderId));
      expect(ticketRows).toHaveLength(1);
      expect(ticketRows[0]?.status).toBe("cancelled");

      const [ticketLine] = sent.ticket.lines;
      if (!ticketLine) {
        throw new Error("La comanda inicial no creó una línea de cocina.");
      }
      await expect(
        updateRestaurantOrderItemStatusViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { ticketLineId: ticketLine.id, status: "ready" },
        })
      ).rejects.toThrow("La comanda ya no está activa en cocina.");
      const [unchangedTicketLine] = await db
        .select({ status: restaurantKitchenTicketLine.status })
        .from(restaurantKitchenTicketLine)
        .where(eq(restaurantKitchenTicketLine.id, ticketLine.id));
      expect(unchangedTicketLine?.status).toBe("sent");

      const [tableDetail, kitchenBoard, saleRows] = await Promise.all([
        getRestaurantTableDetailViaZero({
          zeroDb,
          ctx: zeroCtx,
          tableId,
        }),
        getKitchenBoardViaZero({ zeroDb, ctx: zeroCtx }),
        db.select().from(sale),
      ]);
      expect(tableDetail.openOrder).toBeNull();
      expect(kitchenBoard.tickets).toHaveLength(0);
      expect(saleRows).toHaveLength(0);

      await expect(
        cancelRestaurantOrderViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: {
            orderId: addResult.orderId,
            reason: "Segundo intento",
          },
        })
      ).rejects.toThrow("La cuenta no existe o ya no está abierta.");

      await cleanup();
    });
  });

  describe("VAL-REST-005: close order creates a sale and marks order closed", () => {
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
      const sent = await sendRestaurantOrderToKitchenViaZero({
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

      const [ticketLine] = sent.ticket.lines;
      if (!ticketLine) {
        throw new Error("La comanda inicial no creó una línea de cocina.");
      }
      await expect(
        updateRestaurantOrderItemStatusViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { ticketLineId: ticketLine.id, status: "served" },
        })
      ).rejects.toThrow("La comanda ya no está activa en cocina.");
      const [unchangedTicketLine] = await db
        .select({ status: restaurantKitchenTicketLine.status })
        .from(restaurantKitchenTicketLine)
        .where(eq(restaurantKitchenTicketLine.id, ticketLine.id));
      expect(unchangedTicketLine?.status).toBe("sent");

      await expect(
        updateRestaurantOrderItemViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { orderItemId: addResult.itemId, quantity: 2 },
        })
      ).rejects.toThrow("La cuenta no existe o ya no está abierta.");
      await expect(
        deleteRestaurantOrderItemViaZero({
          zeroDb,
          ctx: zeroCtx,
          input: { orderItemId: addResult.itemId },
        })
      ).rejects.toThrow("La cuenta no existe o ya no está abierta.");

      await cleanup();
    });

    test("close table order applies sale-level discount", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Salon",
      });
      const [tableId, productId, shiftId] = await Promise.all([
        seedRestaurantTable(db, {
          organizationId,
          areaId,
          name: "T2",
        }),
        seedProduct(db, {
          organizationId,
          price: 25_000,
          taxRate: 0,
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

      const closeResult = await closeRestaurantOrderViaZero({
        db,
        zeroDb,
        ctx: zeroCtx,
        input: {
          orderId: addResult.orderId,
          shiftId,
          discountAmount: 5000,
          payments: [{ method: "cash", amount: 20_000 }],
        },
      });

      expect(closeResult.saleId).toBeString();
      expect(closeResult.status).toBe("completed");
      expect(closeResult.totalAmount).toBe(20_000);

      const discountedSaleRows = await db
        .select()
        .from(sale)
        .where(eq(sale.id, closeResult.saleId));
      expect(discountedSaleRows.length).toBe(1);
      expect(discountedSaleRows[0].discountAmount).toBe(5000);
      expect(discountedSaleRows[0].totalAmount).toBe(20_000);

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

    test("manager can create, update, and delete active restaurant configuration", async () => {
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

      const emptyAreaResult = await createRestaurantAreaViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { name: "Empty garden" },
      });
      const emptyAreaId = emptyAreaResult.find(
        (area) => area.name === "Empty garden"
      )?.id;
      expect(emptyAreaId).toBeString();

      const deleteAreaResult = await deleteRestaurantAreaViaZero({
        zeroDb,
        ctx: zeroCtx,
        input: { id: emptyAreaId ?? "" },
      });
      expect(deleteAreaResult.map((area) => area.name)).toEqual([
        "Garden Updated",
      ]);

      await cleanup();
    });

    test("manager can soft-delete a table with closed order history", async () => {
      const { db, cleanup } = await createTestDb();
      const { organizationId, userId } = await seedOrganizationWithMember(db, {
        memberRole: "owner",
      });
      await setRestaurantModuleEnabled(db, organizationId, true);

      const areaId = await seedRestaurantArea(db, {
        organizationId,
        name: "Historic area",
      });
      const tableId = await seedRestaurantTable(db, {
        organizationId,
        areaId,
        name: "Historic table",
      });
      const orderId = crypto.randomUUID();
      const now = new Date();
      await db.insert(restaurantOrder).values({
        id: orderId,
        organizationId,
        tableId,
        openedByUserId: userId,
        orderNumber: 1,
        status: "closed",
        guestCount: 2,
        createdAt: now,
        updatedAt: now,
        closedAt: now,
      });

      const zeroDb = createZeroTestDb(db);
      const ctx = createZeroContext(userId, organizationId);

      const configuration = await deleteRestaurantTableViaZero({
        zeroDb,
        ctx,
        input: { id: tableId },
      });

      expect(configuration[0]?.tables).toEqual([]);

      const [tableRow] = await db
        .select({ deletedAt: restaurantTable.deletedAt })
        .from(restaurantTable)
        .where(eq(restaurantTable.id, tableId));
      expect(tableRow?.deletedAt).toBeInstanceOf(Date);

      const [orderRow] = await db
        .select({ tableId: restaurantOrder.tableId })
        .from(restaurantOrder)
        .where(eq(restaurantOrder.id, orderId));
      expect(orderRow?.tableId).toBe(tableId);

      const areasAfterDelete = await deleteRestaurantAreaViaZero({
        zeroDb,
        ctx,
        input: { id: areaId },
      });
      expect(areasAfterDelete).toEqual([]);

      const [areaRow] = await db
        .select({ deletedAt: restaurantArea.deletedAt })
        .from(restaurantArea)
        .where(eq(restaurantArea.id, areaId));
      expect(areaRow?.deletedAt).toBeInstanceOf(Date);

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
      expect(board.tickets[0].lines.length).toBeGreaterThanOrEqual(1);

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
