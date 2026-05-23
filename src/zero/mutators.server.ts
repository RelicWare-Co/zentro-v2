import { defineMutator, defineMutators } from "@rocicorp/zero";
import type { CreditPaymentDbExecutor } from "@/server/credit/register-payment.server";
import { runRegisterCreditPayment } from "@/server/credit/register-payment.server";
import {
  registerCreditPaymentArgsSchema,
  mutators as sharedMutators,
} from "./mutators";

export const serverMutators = defineMutators(sharedMutators, {
  credit: {
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
            organizationId: ctx.orgID,
            userId: ctx.id,
          }
        );
      }
    ),
  },
});

export type ServerMutators = typeof serverMutators;
