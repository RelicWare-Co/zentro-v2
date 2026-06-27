// Shift operations — server-only, reusable across domains.
//
// Other features (sales, credit, restaurants) import from here instead of
// redefining shift validation logic.

import { and, eq } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { shift } from "@/database/drizzle/schema/pos.schema";

type DrizzleTx = Pick<Database, "select" | "insert" | "update">;

export interface ShiftInfo {
  id: string;
  status: string;
  userId: string;
}

export async function assertOpenCashierShift(
  tx: DrizzleTx,
  input: { shiftId: string; organizationId: string; userId: string }
): Promise<ShiftInfo> {
  const [targetShift] = await tx
    .select({ id: shift.id, status: shift.status, userId: shift.userId })
    .from(shift)
    .where(
      and(
        eq(shift.id, input.shiftId),
        eq(shift.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!targetShift) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  if (targetShift.status !== "open") {
    throw new Error("No se puede registrar una venta en un turno cerrado");
  }
  if (targetShift.userId !== input.userId) {
    throw new Error("Solo el cajero del turno puede registrar ventas");
  }
  return targetShift;
}

export async function assertOpenShiftForCancellation(
  tx: DrizzleTx,
  input: { shiftId: string; organizationId: string; userId: string }
): Promise<ShiftInfo> {
  const [targetShift] = await tx
    .select({ id: shift.id, status: shift.status, userId: shift.userId })
    .from(shift)
    .where(
      and(
        eq(shift.id, input.shiftId),
        eq(shift.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!targetShift) {
    throw new Error("Turno no encontrado para la venta seleccionada");
  }
  if (targetShift.status !== "open") {
    throw new Error("Solo se puede anular una venta de un turno abierto");
  }
  if (targetShift.userId !== input.userId) {
    throw new Error("Solo el cajero del turno puede anular la venta");
  }
  return targetShift;
}

export async function assertOpenShiftForPayment(
  tx: DrizzleTx,
  input: { shiftId: string; organizationId: string; userId: string }
): Promise<ShiftInfo> {
  const [targetShift] = await tx
    .select({ id: shift.id, userId: shift.userId, status: shift.status })
    .from(shift)
    .where(
      and(
        eq(shift.id, input.shiftId),
        eq(shift.organizationId, input.organizationId)
      )
    )
    .limit(1);

  if (!targetShift) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  if (targetShift.status !== "open") {
    throw new Error("No se puede registrar pago en un turno cerrado");
  }
  if (targetShift.userId !== input.userId) {
    throw new Error("Solo el cajero del turno puede registrar pagos");
  }
  return targetShift;
}
