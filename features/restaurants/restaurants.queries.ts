import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import "@/zero/context";
import { hasOrgContext } from "@/zero/queries.shared";
import { zql } from "@/zero/schema";

const restaurantTableIdArgsSchema = z.object({
  tableId: z.string().trim().optional().nullable(),
});

export const restaurantsQueries = {
  restaurants: {
    layout: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantArea.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantArea
        .where("organizationId", ctx.orgID)
        .related("tables", (query) =>
          query.orderBy("sortOrder", "asc").orderBy("name", "asc")
        )
        .orderBy("sortOrder", "asc")
        .orderBy("name", "asc");
    }),
    openOrders: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantOrder.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantOrder
        .where("organizationId", ctx.orgID)
        .where("status", "open")
        .related("items", (query) =>
          query
            .related("product")
            .related("modifiers", (modifierQuery) =>
              modifierQuery.related("modifierProduct")
            )
            .orderBy("createdAt", "asc")
            .orderBy("id", "asc")
        )
        .related("kitchenTickets", (query) =>
          query.orderBy("sequenceNumber", "desc")
        );
    }),
    tableById: defineQuery(restaurantTableIdArgsSchema, ({ args, ctx }) => {
      const normalizedTableId = args.tableId?.trim() ?? "";
      if (!(hasOrgContext(ctx) && normalizedTableId)) {
        return zql.restaurantTable.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantTable
        .where("id", normalizedTableId)
        .where("organizationId", ctx.orgID)
        .related("area")
        .limit(1);
    }),
    kitchenBoard: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.restaurantKitchenTicket.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.restaurantKitchenTicket
        .where("organizationId", ctx.orgID)
        .where(({ cmp, or }) =>
          or(cmp("status", "=", "sent"), cmp("status", "=", "ready"))
        )
        .whereExists("order", (query) => query.where("status", "open"))
        .whereExists("items", (query) =>
          query.where(({ cmp, or }) =>
            or(cmp("status", "=", "sent"), cmp("status", "=", "ready"))
          )
        )
        .related("order", (query) =>
          query
            .where("status", "open")
            .related("table", (tableQuery) => tableQuery.related("area"))
        )
        .related("items", (query) =>
          query
            .related("product")
            .orderBy("createdAt", "desc")
            .orderBy("id", "desc")
        )
        .orderBy("createdAt", "desc");
    }),
  },
};
