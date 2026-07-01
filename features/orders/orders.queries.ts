import { z } from "zod";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const PEDIDO_INBOX_LIMIT = 100;

const pedidoListArgsSchema = z.object({
  status: z.string().trim().optional(),
});

export const ordersQueries = {
  orders: {
    inbox: defineZentroQuery(pedidoListArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.pedido);
      }

      let query = zql.pedido
        .where("organizationId", ctx.orgID)
        .related("items", (itemQuery) => itemQuery.related("product"));

      if (args.status?.trim()) {
        query = query.where("status", args.status.trim());
      }

      return query
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(PEDIDO_INBOX_LIMIT);
    }),
  },
};
