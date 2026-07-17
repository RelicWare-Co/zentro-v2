import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { member } from "@/database/drizzle/schema/auth.schema";
import { shift } from "@/database/drizzle/schema/pos.schema";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import {
  seedOrganizationWithMember,
  seedShift,
  seedUser,
} from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import {
  closeShiftViaZero,
  createZeroContext,
  createZeroTestDb,
  getShiftCloseSummaryViaZero,
  getShiftDetailViaZero,
  listShiftsViaZero,
  openShiftViaZero,
  registerCashMovementViaZero,
} from "./helpers/zero-shifts";

const INVALID_CASH_MOVEMENT_TYPE_PATTERN =
  /Invalid option|Tipo de movimiento de caja inválido/;

describe("Zero shifts", () => {
  test("sales window prefers open shifts and falls back to the latest closed shift", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const olderClosedShift = await seedShift(db, {
      organizationId,
      userId,
      status: "closed",
      openedAt: new Date("2026-01-01T18:00:00Z"),
      closedAt: new Date("2026-01-02T02:00:00Z"),
    });
    const latestClosedShift = await seedShift(db, {
      organizationId,
      userId,
      status: "closed",
      openedAt: new Date("2026-01-02T18:00:00Z"),
      closedAt: new Date("2026-01-03T02:00:00Z"),
    });
    const openShift = await seedShift(db, {
      organizationId,
      userId,
      status: "open",
      openedAt: new Date("2026-01-03T18:00:00Z"),
    });

    const openRows = await zeroDb.run(
      queries.shifts.salesWindow.open.fn({ args: undefined, ctx })
    );
    const closedRows = await zeroDb.run(
      queries.shifts.salesWindow.lastClosed.fn({ args: undefined, ctx })
    );

    expect(openRows.map((row) => row.id)).toEqual([openShift]);
    expect(closedRows[0]?.id).toBe(latestClosedShift);
    expect(closedRows[0]?.id).not.toBe(olderClosedShift);

    await db
      .update(shift)
      .set({ status: "closed", closedAt: new Date("2026-01-04T02:00:00Z") })
      .where(eq(shift.id, openShift));

    const fallbackOpenRows = await zeroDb.run(
      queries.shifts.salesWindow.open.fn({ args: undefined, ctx })
    );
    const fallbackClosedRows = await zeroDb.run(
      queries.shifts.salesWindow.lastClosed.fn({ args: undefined, ctx })
    );

    expect(fallbackOpenRows).toHaveLength(0);
    expect(fallbackClosedRows[0]?.id).toBe(openShift);

    await cleanup();
  });

  test("open, close summary, and close run through Zero without oRPC", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const shiftOpen = await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 8000 },
    });

    await registerCashMovementViaZero({
      zeroDb,
      ctx,
      input: {
        shiftId: shiftOpen.id,
        type: "inflow",
        paymentMethod: "cash",
        amount: 2000,
        description: "Ajuste manual",
      },
    });

    const summary = await getShiftCloseSummaryViaZero({
      zeroDb,
      ctx,
      shiftId: shiftOpen.id,
    });
    expect(
      summary.summaryByMethod.find((row) => row.paymentMethod === "cash")
    ).toMatchObject({
      expectedAmount: 10_000,
    });

    await closeShiftViaZero({
      zeroDb,
      ctx,
      input: {
        shiftId: shiftOpen.id,
        closures: [{ paymentMethod: "cash", actualAmount: 10_000 }],
      },
    });

    const detail = await getShiftDetailViaZero({
      zeroDb,
      ctx,
      shiftId: shiftOpen.id,
    });
    expect(detail.status).toBe("closed");
    expect(detail.totals.totalActual).toBe(10_000);
    expect(detail.totals.totalDifference).toBe(0);

    const list = await listShiftsViaZero({
      zeroDb,
      ctx,
      input: { status: "closed", limit: 10 },
    });
    expect(list.data).toHaveLength(1);
    expect(list.data[0].id).toBe(shiftOpen.id);

    await cleanup();
  });

  test("duplicate open shift for same user is rejected", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 1000 },
    });

    await expect(
      openShiftViaZero({
        zeroDb,
        ctx,
        input: { startingCash: 2000 },
      })
    ).rejects.toThrow("El usuario ya tiene un turno abierto");

    await cleanup();
  });
});

describe("Zero shifts cashMovement validation", () => {
  test("rejects movement on a closed shift", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const shiftOpen = await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 1000 },
    });

    await closeShiftViaZero({
      zeroDb,
      ctx,
      input: {
        shiftId: shiftOpen.id,
        closures: [{ paymentMethod: "cash", actualAmount: 1000 }],
      },
    });

    await expect(
      registerCashMovementViaZero({
        zeroDb,
        ctx,
        input: {
          shiftId: shiftOpen.id,
          type: "inflow",
          paymentMethod: "cash",
          amount: 500,
          description: "Tarde",
        },
      })
    ).rejects.toThrow("No se puede registrar movimiento en un turno cerrado");

    await cleanup();
  });

  test("rejects movement by another cashier", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const otherUser = await seedUser(db);
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: otherUser.id,
      role: "member",
      createdAt: new Date(),
    });

    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);
    const otherCtx = createZeroContext(otherUser.id, organizationId);

    const shiftOpen = await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 1000 },
    });

    await expect(
      registerCashMovementViaZero({
        zeroDb,
        ctx: otherCtx,
        input: {
          shiftId: shiftOpen.id,
          type: "inflow",
          paymentMethod: "cash",
          amount: 500,
          description: "Otro cajero",
        },
      })
    ).rejects.toThrow("Solo el cajero del turno puede registrar movimientos");

    await cleanup();
  });

  test("rejects disabled payment method", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const shiftOpen = await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 1000 },
    });

    await expect(
      registerCashMovementViaZero({
        zeroDb,
        ctx,
        input: {
          shiftId: shiftOpen.id,
          type: "inflow",
          paymentMethod: "bitcoin",
          amount: 500,
          description: "Crypto",
        },
      })
    ).rejects.toThrow("Método de pago no habilitado: bitcoin");

    await cleanup();
  });

  test("rejects invalid movement type", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    const shiftOpen = await openShiftViaZero({
      zeroDb,
      ctx,
      input: { startingCash: 1000 },
    });

    await expect(
      zeroDb.transaction((tx) =>
        serverMutators.shifts.cashMovement.fn({
          args: {
            id: crypto.randomUUID(),
            shiftId: shiftOpen.id,
            type: "invalid" as "inflow",
            paymentMethod: "cash",
            amount: 500,
            description: "Tipo inválido",
          },
          ctx,
          tx,
        })
      )
    ).rejects.toThrow(INVALID_CASH_MOVEMENT_TYPE_PATTERN);

    await cleanup();
  });

  test("rejects movement for nonexistent shift", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = createZeroContext(userId, organizationId);

    await expect(
      registerCashMovementViaZero({
        zeroDb,
        ctx,
        input: {
          shiftId: crypto.randomUUID(),
          type: "inflow",
          paymentMethod: "cash",
          amount: 500,
          description: "Sin turno",
        },
      })
    ).rejects.toThrow("Turno no encontrado para la organización activa");

    await cleanup();
  });
});
