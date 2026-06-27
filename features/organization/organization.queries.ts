import { zql } from "@/zero/schema";
import {
  defineZentroQuery,
  denyAllMembers,
  denyQuery,
  hasOrgContext,
} from "@/zero/sdk";

export const organizationQueries = {
  /**
   * Returns the active membership rows of the authenticated user for their
   * active organization. Useful as a low-cost auth probe and for surfacing
   * the user's role in the UI (badges, conditional rendering).
   *
   * Logged-out clients receive an empty result via the `cmpLit(false, '=', true)`
   * permission gate (Zero's idiomatic "deny everything" predicate).
   */
  myMembership: defineZentroQuery(({ ctx }) => {
    if (!hasOrgContext(ctx)) {
      return denyAllMembers();
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
  organization: {
    current: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.organization);
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
    selection: defineZentroQuery(({ ctx }) => {
      if (!ctx) {
        return denyQuery(zql.invitation);
      }

      return zql.invitation
        .where("email", ctx.email)
        .where("status", "pending")
        .related("organization")
        .orderBy("createdAt", "desc");
    }),
    management: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.organization);
      }

      return zql.organization
        .where("id", ctx.orgID)
        .related("members", (query) =>
          query.related("user").orderBy("createdAt", "asc")
        )
        .related("invitations", (query) =>
          query.where("status", "pending").orderBy("createdAt", "desc")
        )
        .related("joinLinks", (query) => query.orderBy("createdAt", "desc"))
        .limit(1);
    }),
    environment: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.organization);
      }

      return zql.organization
        .where("id", ctx.orgID)
        .related("members")
        .related("invitations")
        .related("products", (query) => query.where("deletedAt", "IS", null))
        .related("customers", (query) => query.where("deletedAt", "IS", null))
        .limit(1);
    }),
    moduleEntitlements: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.organizationModuleEntitlement);
      }

      return zql.organizationModuleEntitlement.where(
        "organizationId",
        ctx.orgID
      );
    }),
  },
};
