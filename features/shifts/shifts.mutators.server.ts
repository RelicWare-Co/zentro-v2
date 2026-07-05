import type { z } from "zod";
import { closeShiftArgsSchema } from "@/features/shifts/shifts.mutators";
import { buildExpectedAmountsByMethod } from "@/features/shifts/shifts.shared";
import { normalizeNumber } from "@/lib/domain-values.shared";
import { zql } from "@/zero/schema";
import {
  assertOrgZeroContext,
  defineZentroMutator,
  normalizeOptionalString,
  normalizeRequiredString,
  resolveTimestamp,
  toNonNegativeInteger,
  type ZeroContext,
  type ZeroMutatorTransaction,
} from "@/zero/sdk";

export async function runCloseShiftServerMutator({
  args,
  ctx,
  tx,
}: {
  args: z.infer<typeof closeShiftArgsSchema>;
  ctx: ZeroContext | undefined;
  tx: ZeroMutatorTransaction;
}) {
  const zeroContext = assertOrgZeroContext(ctx);
  const closedAt = resolveTimestamp(args.closedAt);
  const notes = normalizeOptionalString(args.notes);
  const actualByMethod = new Map<string, number>();

  for (const closure of args.closures) {
    const paymentMethod = normalizeRequiredString(
      closure.paymentMethod,
      "paymentMethod"
    ).toLowerCase();
    if (actualByMethod.has(paymentMethod)) {
      throw new Error(`Método de pago duplicado en cierre: ${paymentMethod}`);
    }
    actualByMethod.set(
      paymentMethod,
      toNonNegativeInteger(
        closure.actualAmount,
        `actualAmount (${paymentMethod})`
      )
    );
  }

  const targetShifts = await tx.run(
    zql.shift
      .where("id", args.shiftId)
      .where("organizationId", zeroContext.orgID)
      .limit(1)
  );
  const targetShift = targetShifts[0];
  if (!targetShift) {
    throw new Error("Turno no encontrado para la organización activa");
  }
  if (targetShift.status !== "open") {
    throw new Error("El turno ya está cerrado");
  }
  if (targetShift.userId !== zeroContext.id) {
    throw new Error("Solo el cajero del turno puede cerrar caja");
  }

  const existingClosures = await tx.run(
    zql.shiftClosure.where("shiftId", args.shiftId).limit(1)
  );
  if (existingClosures.length > 0) {
    throw new Error("El turno ya cuenta con un cierre registrado");
  }

  const shiftRows = await tx.run(
    zql.shift
      .where("id", args.shiftId)
      .where("organizationId", zeroContext.orgID)
      .related("payments", (query) =>
        query.related("sale").related("creditTransactions")
      )
      .related("cashMovements")
      .limit(1)
  );
  const shiftRow = shiftRows[0];
  if (!shiftRow) {
    throw new Error("Turno no encontrado para la organización activa");
  }

  const registeredPayments = (shiftRow.payments ?? [])
    .filter(
      (paymentRow) =>
        (!paymentRow.saleId || paymentRow.sale?.status !== "cancelled") &&
        !(paymentRow.creditTransactions ?? []).some(
          (tx) => tx.type === "payment"
        )
    )
    .map((paymentRow) => ({
      method: paymentRow.method,
      amount: paymentRow.amount,
      appliedAmount: paymentRow.appliedAmount,
      changeAmount: paymentRow.changeAmount,
      saleId: paymentRow.saleId,
      saleTotalAmount: paymentRow.sale?.totalAmount ?? null,
    }));
  const registeredMovements = (shiftRow.cashMovements ?? []).map(
    (movementRow) => ({
      type: movementRow.type,
      paymentMethod: movementRow.paymentMethod ?? "cash",
      amount: movementRow.amount,
    })
  );
  const expectedByMethod = buildExpectedAmountsByMethod(
    normalizeNumber(targetShift.startingCash),
    registeredPayments,
    registeredMovements
  );

  const allMethods = new Set<string>([
    ...expectedByMethod.keys(),
    ...actualByMethod.keys(),
  ]);
  if (allMethods.size === 0) {
    allMethods.add("cash");
  }

  for (const paymentMethod of allMethods) {
    const expectedAmount = expectedByMethod.get(paymentMethod) ?? 0;
    const actualAmount = actualByMethod.get(paymentMethod) ?? 0;
    await tx.mutate.shiftClosure.insert({
      id: crypto.randomUUID(),
      shiftId: args.shiftId,
      paymentMethod,
      expectedAmount,
      actualAmount,
      difference: actualAmount - expectedAmount,
    });
  }

  await tx.mutate.shift.update({
    id: args.shiftId,
    status: "closed",
    closedAt,
    notes: notes ?? targetShift.notes,
  });
}

export const shiftsServerMutators = {
  close: defineZentroMutator(closeShiftArgsSchema, runCloseShiftServerMutator),
};
