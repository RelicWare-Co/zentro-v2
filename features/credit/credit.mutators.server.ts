import { registerCreditPaymentArgsSchema } from "@/features/credit/credit.mutators";
import type { CreditPaymentDbExecutor } from "@/features/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/features/credit/register-payment.server";
import { defineZentroServerMutator } from "@/zero/sdk.server";

export const creditServerMutators = {
  registerPayment: defineZentroServerMutator(
    registerCreditPaymentArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      await runRegisterCreditPayment(
        drizzleTx as unknown as CreditPaymentDbExecutor,
        args,
        { organizationId: auth.organizationId, userId: auth.userId }
      );
    },
    { operationName: "El registro de abonos de crédito" }
  ),
};
