import { z } from "zod";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const restaurantTableIdArgsSchema = z.object({
  tableId: z.string().trim().optional().nullable(),
});

export const restaurantsQueries = {
  restaurants: {
    layout: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.restaurantArea);
      }

      return zql.restaurantArea
        .where("organizationId", ctx.orgID)
        .where("deletedAt", "IS", null)
        .related("tables", (query) =>
          query
            .where("deletedAt", "IS", null)
            .orderBy("sortOrder", "asc")
            .orderBy("name", "asc")
        )
        .orderBy("sortOrder", "asc")
        .orderBy("name", "asc");
    }),
    openOrders: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.restaurantOrder);
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
          query
            .related("lines", (lineQuery) =>
              lineQuery.orderBy("createdAt", "asc").orderBy("id", "asc")
            )
            .orderBy("sequenceNumber", "desc")
        );
    }),
    tableById: defineZentroQuery(
      restaurantTableIdArgsSchema,
      ({ args, ctx }) => {
        const normalizedTableId = args.tableId?.trim() ?? "";
        if (!(hasOrgContext(ctx) && normalizedTableId)) {
          return denyQuery(zql.restaurantTable);
        }

        return zql.restaurantTable
          .where("id", normalizedTableId)
          .where("organizationId", ctx.orgID)
          .where("deletedAt", "IS", null)
          .related("area")
          .limit(1);
      }
    ),
    kitchenBoard: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.restaurantKitchenTicket);
      }

      return zql.restaurantKitchenTicket
        .where("organizationId", ctx.orgID)
        .where(({ cmp, or }) =>
          or(cmp("status", "=", "sent"), cmp("status", "=", "ready"))
        )
        .whereExists("order", (query) => query.where("status", "open"))
        .whereExists("lines", (query) =>
          query.where(({ cmp, or }) =>
            or(cmp("status", "=", "sent"), cmp("status", "=", "ready"))
          )
        )
        .related("order", (query) =>
          query
            .where("status", "open")
            .related("table", (tableQuery) => tableQuery.related("area"))
        )
        .related("lines", (query) =>
          query.orderBy("createdAt", "desc").orderBy("id", "desc")
        )
        .orderBy("createdAt", "desc");
    }),
  },
};
