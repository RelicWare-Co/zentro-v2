import { zql } from "@/zero/schema";
import { defineZentroQuery, denyQuery, hasOrgContext } from "@/zero/sdk";

export const modulesQueries = {
  modules: {
    capabilities: defineZentroQuery(({ ctx }) => {
      if (!hasOrgContext(ctx)) {
        return denyQuery(zql.organization);
      }

      return zql.organization.where("id", ctx.orgID).limit(1);
    }),
  },
};
