import { z as zod } from "zod";
import { getEnabledPaymentMethods } from "@/features/settings/settings.shared";
import { zql } from "@/zero/schema";
import {
  assertOrgZeroContext,
  defineZentroMutator,
  getOrganizationSettingsFromTx,
  normalizeOptionalString,
  normalizeRequiredString,
  resolveTimestamp,
  toNonNegativeInteger,
  toPositiveInteger,
} from "@/zero/sdk";

export const openShiftArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  startingCash: zod.number().min(0),
  terminalId: zod.string().trim().optional().nullable(),
  terminalName: zod.string().trim().optional().nullable(),
  notes: zod.string().trim().optional().nullable(),
  openedAt: zod.number().int().min(0).optional(),
});
export const closeShiftArgsSchema = zod.object({
  shiftId: zod.string().trim().min(1),
  closures: zod
    .array(
      zod.object({
        paymentMethod: zod.string().trim().min(1),
        actualAmount: zod.number().int().min(0),
      })
    )
    .min(1),
  notes: zod.string().trim().optional().nullable(),
  closedAt: zod.number().int().min(0).optional(),
});
export const registerCashMovementArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  shiftId: zod.string().trim().min(1),
  type: zod.enum(["expense", "payout", "inflow"]),
  paymentMethod: zod.string().trim().min(1),
  amount: zod.number().int().positive(),
  description: zod.string().trim().min(1),
  createdAt: zod.number().int().min(0).optional(),
});

export const shiftsMutators = {
  shifts: {
    open: defineZentroMutator(
      openShiftArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const startingCash = toNonNegativeInteger(
          args.startingCash,
          "startingCash"
        );
        const terminalId = normalizeOptionalString(args.terminalId);
        const notes = normalizeOptionalString(args.notes);
        const openedAt = resolveTimestamp(args.openedAt);
        const organizationSettings = await getOrganizationSettingsFromTx({
          organizationId: zeroContext.orgID,
          tx,
        });
        const terminalName =
          normalizeOptionalString(args.terminalName) ??
          organizationSettings.pos.defaultTerminalName;

        const userOpenShifts = await tx.run(
          zql.shift
            .where("organizationId", zeroContext.orgID)
            .where("userId", zeroContext.id)
            .where("status", "open")
            .limit(1)
        );
        if (userOpenShifts.length > 0) {
          throw new Error("El usuario ya tiene un turno abierto");
        }

        if (terminalId) {
          const terminalOpenShifts = await tx.run(
            zql.shift
              .where("organizationId", zeroContext.orgID)
              .where("status", "open")
              .where("terminalId", terminalId)
              .limit(1)
          );
          if (terminalOpenShifts.length > 0) {
            throw new Error("La terminal indicada ya tiene un turno abierto");
          }
        }

        await tx.mutate.shift.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          userId: zeroContext.id,
          terminalId,
          terminalName,
          status: "open",
          startingCash,
          openedAt,
          notes,
        });
      }
    ),
    cashMovement: defineZentroMutator(
      registerCashMovementArgsSchema,
      async ({ args, ctx, tx }) => {
        const zeroContext = assertOrgZeroContext(ctx);
        const validTypes = ["expense", "payout", "inflow"] as const;
        if (!validTypes.includes(args.type)) {
          throw new Error("Tipo de movimiento de caja inválido");
        }

        const amount = toPositiveInteger(args.amount, "amount");
        const description = normalizeRequiredString(
          args.description,
          "description"
        );
        const paymentMethod = normalizeRequiredString(
          args.paymentMethod,
          "paymentMethod"
        ).toLowerCase();
        const createdAt = resolveTimestamp(args.createdAt);

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
          throw new Error(
            "No se puede registrar movimiento en un turno cerrado"
          );
        }
        if (targetShift.userId !== zeroContext.id) {
          throw new Error(
            "Solo el cajero del turno puede registrar movimientos"
          );
        }

        const organizationSettings = await getOrganizationSettingsFromTx({
          organizationId: zeroContext.orgID,
          tx,
        });
        const enabledPaymentMethodIds = new Set(
          getEnabledPaymentMethods(organizationSettings).map(
            (paymentMethod) => paymentMethod.id
          )
        );
        if (!enabledPaymentMethodIds.has(paymentMethod)) {
          throw new Error(`Método de pago no habilitado: ${paymentMethod}`);
        }

        await tx.mutate.cashMovement.insert({
          id: args.id,
          organizationId: zeroContext.orgID,
          shiftId: args.shiftId,
          type: args.type,
          paymentMethod,
          amount,
          description,
          createdAt,
        });
      }
    ),
    close: defineZentroMutator(closeShiftArgsSchema, async () => {
      // Server-only close. The authoritative override runs in
      // `features/shifts/shifts.mutators.server.ts` so client-side local reads
      // cannot compute a close from an incomplete cached shift graph.
    }),
  },
};
