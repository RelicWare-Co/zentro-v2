import { z } from "zod";
import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

const customersSearchArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

function normalizeLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

export const customersQueries = {
  customers: {
    search: defineZentroQuery(customersSearchArgsSchema, ({ args, ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.customer);
      }

      const normalizedSearch = args.searchQuery?.trim() ?? "";
      const searchPattern = `%${normalizedSearch}%`;
      let query = zql.customer
        .where("organizationId", ctx.orgID)
        .where("deletedAt", "IS", null);

      if (normalizedSearch) {
        query = query.where(({ cmp, or }) =>
          or(
            cmp("name", "ILIKE", searchPattern),
            cmp("documentNumber", "ILIKE", searchPattern),
            cmp("phone", "ILIKE", searchPattern),
            cmp("email", "ILIKE", searchPattern)
          )
        );
      }

      return query
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(normalizeLimit(args.limit));
    }),
  },
};
