import { defineMutator } from "@rocicorp/zero";
import { registerCreditPaymentArgsSchema } from "@/features/credit/credit.mutators";
import type { CreditPaymentDbExecutor } from "@/features/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/features/credit/register-payment.server";
import { requireOrgContext } from "@/zero/mutators.shared";

export const creditServerMutators = {
  registerPayment: defineMutator(
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
