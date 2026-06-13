import { describe, expect, test } from "bun:test";
import { member } from "@/database/drizzle/schema/auth.schema";
import { serverMutators } from "@/zero/mutators.server";
import { seedOrganizationWithMember, seedUser } from "./helpers/seed";
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
