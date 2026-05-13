import { ORPCError, os } from "@orpc/server";
import type { auth } from "../../auth";

type AuthInstance = typeof auth;
type AuthSession = AuthInstance["$Infer"]["Session"];

export const requireOrgMiddleware = os
  .$context<{
    session?: AuthSession["session"];
  }>()
  .middleware(async ({ context, next }) => {
    const organizationId = context.session?.activeOrganizationId;

    if (!organizationId) {
      throw new ORPCError("BAD_REQUEST", {
        message: "No hay una organización activa.",
      });
    }

    return next({
      context: {
        organizationId,
      },
    });
  });
