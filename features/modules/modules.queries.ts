import { defineQuery } from "@rocicorp/zero";
import "@/zero/context";
import { hasOrgContext } from "@/zero/queries.shared";
import { zql } from "@/zero/schema";

export const modulesQueries = {
  modules: {
    capabilities: defineQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return zql.organization.where(({ cmpLit }) => cmpLit(false, "=", true));
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
};
