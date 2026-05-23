// Shared Zero queries.
//
// Each entry is a named `defineQuery(...)` so the server endpoint
// (`/api/zero/query`) can re-derive the authoritative query text from
// `(name, args)` without trusting raw client AST.
//
// Conventions:
// - Always validate `args` with a Standard-Schema validator (Zod) when the
//   query takes inputs. The client may lie; the validator is the trust
//   boundary.
// - Always read identity/permissions from `ctx`, never from `args`.
// - When the user is not allowed to see anything, return an empty query
//   instead of throwing. Throwing on the server kills the whole batch.
// - Keep query text identical client/server — Zero merges them by name.

import { defineQueries, defineQuery } from "@rocicorp/zero";
import { z } from "zod";
// Importing `./context` registers `ZeroContext` into Zero's DefaultTypes so
// `ctx` here is typed as `ZeroContext | undefined`.
import "./context";
import { zql } from "./schema";

const customersSearchArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

const productsSearchArgsSchema = z.object({
  categoryId: z.string().trim().optional().nullable(),
  limit: z.number().int().min(1).max(1000).optional(),
  searchQuery: z.string().trim().optional().nullable(),
});

function normalizeLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function normalizeProductLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 1000, 1), 1000);
}

export const queries = defineQueries({
  /**
   * Returns the active membership rows of the authenticated user for their
   * active organization. Useful as a low-cost auth probe and for surfacing
   * the user's role in the UI (badges, conditional rendering).
   *
   * Logged-out clients receive an empty result via the `cmpLit(false, '=', true)`
   * permission gate (Zero's idiomatic "deny everything" predicate).
   */
  myMembership: defineQuery(({ ctx }) => {
    if (!ctx) {
      return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
  customers: {
    search: defineQuery(customersSearchArgsSchema, ({ args, ctx }) => {
      if (!ctx) {
        return zql.customer.where(({ cmpLit }) => cmpLit(false, "=", true));
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
  products: {
    categories: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.category.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.category
        .where("organizationId", ctx.orgID)
        .orderBy("name", "asc")
        .orderBy("id", "asc");
    }),
    search: defineQuery(productsSearchArgsSchema, ({ args, ctx }) => {
      if (!ctx) {
        return zql.product.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      const normalizedSearch = args.searchQuery?.trim() ?? "";
      const normalizedCategoryId = args.categoryId?.trim() ?? "";
      const searchPattern = `%${normalizedSearch}%`;
      let query = zql.product
        .where("organizationId", ctx.orgID)
        .where("deletedAt", "IS", null)
        .related("category");

      if (normalizedCategoryId === "uncategorized") {
        query = query.where("categoryId", "IS", null);
      } else if (normalizedCategoryId) {
        query = query.where("categoryId", normalizedCategoryId);
      }

      if (normalizedSearch) {
        query = query.where(({ cmp, or }) =>
          or(
            cmp("name", "ILIKE", searchPattern),
            cmp("sku", "ILIKE", searchPattern),
            cmp("barcode", "ILIKE", searchPattern)
          )
        );
      }

      return query
        .orderBy("name", "asc")
        .orderBy("id", "asc")
        .limit(normalizeProductLimit(args.limit));
    }),
  },
});

export type Queries = typeof queries;
