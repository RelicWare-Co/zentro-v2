import { describe, expect, test } from "bun:test";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// biome-ignore lint/performance/noNamespaceImport: drizzle requires all schemas as a namespace object
import * as schema from "@/database/drizzle/schema";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  restaurantKitchenTicket,
  restaurantOrder,
} from "@/database/drizzle/schema/restaurant.schema";
import { serializeOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import { schema as zeroSchema } from "@/zero/schema";
import {
  seedOrganizationWithMember,
  seedProduct,
  seedRestaurantArea,
  seedRestaurantTable,
  seedShift,
} from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";
import {
  acknowledgeKitchenTicketPrintViaZero,
  addRestaurantOrderItemViaZero,
  cancelRestaurantOrderViaZero,
  claimKitchenTicketPrintViaZero,
  closeRestaurantOrderViaZero,
  failKitchenTicketPrintViaZero,
  getPendingKitchenPrintsViaZero,
  getSalonKitchenTicketsViaZero,
  markKitchenTicketPrintedViaZero,
  requeueKitchenTicketPrintViaZero,
  sendRestaurantOrderToKitchenViaZero,
} from "./helpers/zero-restaurants";
import { createZeroContext, createZeroTestDb } from "./helpers/zero-shifts";

async function setRestaurantSettings(
  db: TestDb,
  organizationId: string,
  settings?: {
    autoPrintOnSend?: boolean;
    displayEnabled?: boolean;
    printTicketsEnabled?: boolean;
  }
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
            displayEnabled: settings?.displayEnabled ?? true,
            printTicketsEnabled: settings?.printTicketsEnabled ?? true,
            autoPrintOnSend: settings?.autoPrintOnSend ?? true,
          },
        },
      } as Parameters<typeof serializeOrganizationSettingsMetadata>[0]),
    })
    .where(eq(organization.id, organizationId));
}

async function seedScenario(
  db: TestDb,
  options?: { printTicketsEnabled?: boolean; withShift?: boolean }
) {
  const { organizationId, userId } = await seedOrganizationWithMember(db, {
    memberRole: "owner",
  });
  await setRestaurantSettings(db, organizationId, {
    printTicketsEnabled: options?.printTicketsEnabled,
  });

  const areaId = await seedRestaurantArea(db, {
    organizationId,
    name: "Salón",
  });
  const [tableId, productId] = await Promise.all([
    seedRestaurantTable(db, { organizationId, areaId, name: "M1" }),
    seedProduct(db, {
      organizationId,
      name: "Bandeja",
      price: 20_000,
      stock: 10,
      trackInventory: false,
    }),
  ]);
  const shiftId =
    options?.withShift === false
      ? null
      : await seedShift(db, {
          organizationId,
          userId,
          status: "open",
          terminalName: "Caja 1",
        });

  const zeroDb = createZeroTestDb(db);
  const ctx = createZeroContext(userId, organizationId);

  return {
    areaId,
    ctx,
    db,
    organizationId,
    productId,
    shiftId,
    tableId,
    userId,
    zeroDb,
  };
}

async function createCajaTicket(params: {
  ctx: ReturnType<typeof createZeroContext>;
  db: TestDb;
  printTarget?: "caja" | "sender";
  productId: string;
  tableId: string;
  zeroDb: ReturnType<typeof createZeroTestDb>;
}) {
  const addResult = await addRestaurantOrderItemViaZero({
    db: params.db,
    zeroDb: params.zeroDb,
    ctx: params.ctx,
    input: {
      tableId: params.tableId,
      productId: params.productId,
      quantity: 1,
    },
  });
  const sendResult = await sendRestaurantOrderToKitchenViaZero({
    db: params.db,
    zeroDb: params.zeroDb,
    ctx: params.ctx,
    input: {
      orderId: addResult.orderId,
      printTarget: params.printTarget ?? "caja",
    },
  });

  return { orderId: addResult.orderId, ticketId: sendResult.ticket.id };
}

async function getTicketRow(db: TestDb, ticketId: string) {
  const [ticketRow] = await db
    .select()
    .from(restaurantKitchenTicket)
    .where(eq(restaurantKitchenTicket.id, ticketId))
    .limit(1);
  if (!ticketRow) {
    throw new Error(`Ticket no encontrado: ${ticketId}`);
  }
  return ticketRow;
}

function createSecondZeroDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 1 });
  const secondDb = drizzle(client, { schema });
  const zeroDb = zeroDrizzle(
    zeroSchema,
    secondDb as unknown as Parameters<typeof zeroDrizzle>[1]
  );

  return { client, zeroDb };
}

describe("restaurant print queue", () => {
  describe("sendToKitchen print target stamping", () => {
    test("stamps sender tickets as legacy and caja tickets as pending", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);

      const senderTicket = await createCajaTicket({
        ...scenario,
        printTarget: "sender",
      });
      const senderRow = await getTicketRow(db, senderTicket.ticketId);
      expect(senderRow.printTarget).toBe("sender");
      expect(senderRow.printStatus).toBeNull();

      const cajaTicket = await createCajaTicket({
        ...scenario,
        printTarget: "caja",
      });
      const cajaRow = await getTicketRow(db, cajaTicket.ticketId);
      expect(cajaRow.printTarget).toBe("caja");
      expect(cajaRow.printStatus).toBe("pending");
      expect(cajaRow.printClaimedBy).toBeNull();
      expect(cajaRow.printClaimedAt).toBeNull();

      await cleanup();
    });

    test("stamps caja tickets even when print tickets are disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db, { printTicketsEnabled: false });

      const { ticketId } = await createCajaTicket(scenario);
      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printTarget).toBe("caja");
      expect(ticketRow.printStatus).toBe("pending");

      await cleanup();
    });
  });

  describe("claimKitchenTicketPrint", () => {
    test("requires an open shift for the claiming user", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db, { withShift: false });
      const { ticketId } = await createCajaTicket(scenario);

      await expect(
        claimKitchenTicketPrintViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId, claimToken: "token-a" },
        })
      ).rejects.toThrow("turno abierto");

      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("pending");

      await cleanup();
    });

    test("rejects the claim when printing is disabled", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db, { printTicketsEnabled: false });
      const { ticketId } = await createCajaTicket(scenario);

      await expect(
        claimKitchenTicketPrintViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId, claimToken: "token-a" },
        })
      ).rejects.toThrow("impresión de comandas está deshabilitada");

      await cleanup();
    });

    test("only one claim wins and markPrinted requires the winning token", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      let ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("printing");
      expect(ticketRow.printClaimedBy).toBe("token-a");

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-b" },
      });
      ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printClaimedBy).toBe("token-a");

      await expect(
        markKitchenTicketPrintedViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId, claimToken: "token-b" },
        })
      ).rejects.toThrow("claim de impresión ya no es válido");

      await markKitchenTicketPrintedViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("printed");
      expect(ticketRow.printedAt).not.toBeNull();
      // `printedByTerminal` se deriva del turno abierto en el servidor, no de
      // un argumento del cliente: es un campo de auditoría y no debe poder
      // escribirlo el navegador.
      expect(ticketRow.printedByTerminal).toBe("Caja 1");

      await cleanup();
    });

    test("concurrent claims from two connections leave a single owner", async () => {
      const { db, cleanup, databaseUrl } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);
      const second = createSecondZeroDb(databaseUrl);

      try {
        await Promise.all([
          claimKitchenTicketPrintViaZero({
            zeroDb: scenario.zeroDb,
            ctx: scenario.ctx,
            input: { ticketId, claimToken: "token-a" },
          }),
          claimKitchenTicketPrintViaZero({
            zeroDb: second.zeroDb,
            ctx: scenario.ctx,
            input: { ticketId, claimToken: "token-b" },
          }),
        ]);

        const ticketRow = await getTicketRow(db, ticketId);
        expect(ticketRow.printStatus).toBe("printing");
        expect(
          ticketRow.printClaimedBy === "token-a" ||
            ticketRow.printClaimedBy === "token-b"
        ).toBe(true);

        const winningToken = ticketRow.printClaimedBy ?? "";
        const losingToken = winningToken === "token-a" ? "token-b" : "token-a";

        await markKitchenTicketPrintedViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId, claimToken: winningToken },
        });
        await expect(
          markKitchenTicketPrintedViaZero({
            zeroDb: second.zeroDb,
            ctx: scenario.ctx,
            input: { ticketId, claimToken: losingToken },
          })
        ).rejects.toThrow("claim de impresión ya no es válido");
      } finally {
        await second.client.end();
        await cleanup();
      }
    });

    test("reclaims stale printing claims after the TTL", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      await db
        .update(restaurantKitchenTicket)
        .set({
          printClaimedAt: new Date(Date.now() - 3 * 60 * 1000),
        })
        .where(eq(restaurantKitchenTicket.id, ticketId));

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-b" },
      });
      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printClaimedBy).toBe("token-b");

      await cleanup();
    });
  });

  describe("claim skips orders that are no longer open", () => {
    test("marks skipped when the order was closed without the close runner", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { orderId, ticketId } = await createCajaTicket(scenario);

      await db
        .update(restaurantOrder)
        .set({ status: "closed" })
        .where(eq(restaurantOrder.id, orderId));

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("skipped");
      expect(ticketRow.printClaimedBy).toBeNull();

      await cleanup();
    });

    test("closeOrder marks pending caja tickets as skipped", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { orderId, ticketId } = await createCajaTicket(scenario);

      await closeRestaurantOrderViaZero({
        db,
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: {
          orderId,
          shiftId: scenario.shiftId ?? "",
          payments: [{ method: "cash", amount: 20_000, reference: null }],
        },
      });

      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("skipped");

      await cleanup();
    });

    test("cancelOrder marks pending caja tickets as skipped", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { orderId, ticketId } = await createCajaTicket(scenario);

      await cancelRestaurantOrderViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { orderId, reason: "Mesa se retiró" },
      });

      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("skipped");

      await cleanup();
    });
  });

  describe("fail, requeue and acknowledge transitions", () => {
    test("requeue only accepts failed tickets", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);

      await expect(
        requeueKitchenTicketPrintViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId },
        })
      ).rejects.toThrow("Solo puedes reimprimir");

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      await failKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId, claimToken: "token-a" },
      });
      let ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("failed");

      await requeueKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId },
      });
      ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("pending");
      expect(ticketRow.printClaimedBy).toBeNull();

      await cleanup();
    });

    test("acknowledge only accepts pending or failed tickets", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);

      await acknowledgeKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId },
      });
      const ticketRow = await getTicketRow(db, ticketId);
      expect(ticketRow.printStatus).toBe("skipped");

      await expect(
        acknowledgeKitchenTicketPrintViaZero({
          zeroDb: scenario.zeroDb,
          ctx: scenario.ctx,
          input: { ticketId },
        })
      ).rejects.toThrow("Solo puedes atender sin imprimir");

      await cleanup();
    });
  });

  describe("print queue queries", () => {
    test("pendingPrints only returns caja tickets waiting or printing", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);

      const senderTicket = await createCajaTicket({
        ...scenario,
        printTarget: "sender",
      });
      const cajaTicket = await createCajaTicket({
        ...scenario,
        printTarget: "caja",
      });

      const pendingRows = await getPendingKitchenPrintsViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
      });
      const pendingIds = pendingRows.map((row) => row.id);
      expect(pendingIds).toContain(cajaTicket.ticketId);
      expect(pendingIds).not.toContain(senderTicket.ticketId);

      await claimKitchenTicketPrintViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId: cajaTicket.ticketId, claimToken: "token-a" },
      });
      await markKitchenTicketPrintedViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        input: { ticketId: cajaTicket.ticketId, claimToken: "token-a" },
      });

      const afterPrintRows = await getPendingKitchenPrintsViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
      });
      expect(afterPrintRows.map((row) => row.id)).not.toContain(
        cajaTicket.ticketId
      );

      await cleanup();
    });

    test("salonTickets filters by creation date", async () => {
      const { db, cleanup } = await createTestDb();
      const scenario = await seedScenario(db);
      const { ticketId } = await createCajaTicket(scenario);

      const todayRows = await getSalonKitchenTicketsViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        from: 0,
      });
      expect(todayRows.map((row) => row.id)).toContain(ticketId);

      const futureRows = await getSalonKitchenTicketsViaZero({
        zeroDb: scenario.zeroDb,
        ctx: scenario.ctx,
        from: Date.now() + 60_000,
      });
      expect(futureRows.map((row) => row.id)).not.toContain(ticketId);

      await cleanup();
    });
  });
});
