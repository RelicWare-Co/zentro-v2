import { z } from "zod";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const creditTransactionsArgsSchema = z.object({
  creditAccountId: z.string().trim().optional().nullable(),
  limit: z.number().int().positive().max(500).optional(),
});

function normalizeCreditTransactionsLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 100, 1), 500);
}

export const creditQueries = {
  credit: {
    accounts: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.creditAccount);
      }

      return zql.creditAccount
        .where("organizationId", ctx.orgID)
        .related("customer")
        .orderBy("id", "asc");
    }),
    transactions: defineZentroQuery(
      creditTransactionsArgsSchema,
      ({ args, ctx }) => {
        const normalizedCreditAccountId = args.creditAccountId?.trim() ?? "";
        if (!(hasOrgContext(ctx) && normalizedCreditAccountId)) {
          return denyQuery(zql.creditTransaction);
        }

        return zql.creditTransaction
          .where("organizationId", ctx.orgID)
          .where("creditAccountId", normalizedCreditAccountId)
          .orderBy("createdAt", "desc")
          .orderBy("id", "desc")
          .limit(normalizeCreditTransactionsLimit(args.limit));
      }
    ),
  },
};
