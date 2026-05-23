import { describe, expect, test } from "bun:test";
import { seedOrganizationWithMember } from "./helpers/seed";
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
