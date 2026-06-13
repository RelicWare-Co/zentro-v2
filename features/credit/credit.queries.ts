import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import "@/zero/context";
import { hasOrgContext } from "@/zero/queries.shared";
import { zql } from "@/zero/schema";

const creditTransactionsArgsSchema = z.object({
  creditAccountId: z.string().trim().optional().nullable(),
  limit: z.number().int().positive().max(500).optional(),
});

function normalizeCreditTransactionsLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 100, 1), 500);
}

export const creditQueries = {
  credit: {
    accounts: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.creditAccount.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.creditAccount
        .where("organizationId", ctx.orgID)
        .related("customer")
        .orderBy("id", "asc");
    }),
    transactions: defineQuery(creditTransactionsArgsSchema, ({ args, ctx }) => {
      const normalizedCreditAccountId = args.creditAccountId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedCreditAccountId)) {
        return zql.creditTransaction.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.creditTransaction
        .where("organizationId", ctx.orgID)
        .where("creditAccountId", normalizedCreditAccountId)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(normalizeCreditTransactionsLimit(args.limit));
    }),
  },
};
