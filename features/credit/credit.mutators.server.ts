import { registerCreditPaymentArgsSchema } from "@/features/credit/credit.mutators";
import type { CreditPaymentDbExecutor } from "@/features/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/features/credit/register-payment.server";
import { defineZentroMutator, requireOrgContext } from "@/zero/sdk";

export const creditServerMutators = {
  registerPayment: defineZentroMutator(
    registerCreditPaymentArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "El registro de abonos de crédito solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runRegisterCreditPayment(
        drizzleTx as unknown as CreditPaymentDbExecutor,
        args,
        {
          organizationId: requireOrgContext(ctx).orgID,
          userId: ctx.id,
        }
      );
    }
  ),
};
