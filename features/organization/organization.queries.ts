import { defineQuery } from "@rocicorp/zero";
import "@/zero/context";
import { denyAllMembers, hasOrgContext } from "@/zero/queries.shared";
import { zql } from "@/zero/schema";

export const organizationQueries = {
  /**
   * Returns the active membership rows of the authenticated user for their
   * active organization. Useful as a low-cost auth probe and for surfacing
   * the user's role in the UI (badges, conditional rendering).
   *
   * Logged-out clients receive an empty result via the `cmpLit(false, '=', true)`
   * permission gate (Zero's idiomatic "deny everything" predicate).
   */
  myMembership: defineQuery(({ ctx }) => {
    if (!hasOrgContext(ctx)) {
      return denyAllMembers();
    }
    return zql.member
      .where("userId", ctx.id)
      .where("organizationId", ctx.orgID);
  }),
  organization: {
    current: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
    selection: defineQuery(({ ctx }) => {
      if (!ctx) {
        return zql.invitation.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.invitation
        .where("email", ctx.email)
        .where("status", "pending")
        .related("organization")
        .orderBy("createdAt", "desc");
    }),
    management: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
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
    environment: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization
        .where("id", ctx.orgID)
        .related("members")
        .related("invitations")
        .related("products", (query) => query.where("deletedAt", "IS", null))
        .related("customers", (query) => query.where("deletedAt", "IS", null))
        .limit(1);
    }),
    moduleEntitlements: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organizationModuleEntitlement.where(({ cmpLit }) =>
          cmpLit(false, "=", true)
        );
      }

      return zql.organizationModuleEntitlement.where(
        "organizationId",
        ctx.orgID
      );
    }),
  },
};
