import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";

// Vike guards override (they do not stack), so this re-applies the `(app)`
// group checks before the admin-only gate.
export const guard = (pageContext: PageContextServer) => {
  if (!pageContext.user) {
    throw redirect("/login");
  }

  // Platform admins are gated only on the admin role: they may have no active
  // organization (onboarding/support) or a stale active org, and the admin
  // panel + its API are designed to work without one. Non-admins still fall
  // through the regular `(app)` group checks.
  if (pageContext.zeroContext?.systemRole !== "admin") {
    if (!pageContext.zeroContext?.orgID) {
      throw redirect("/organization");
    }
    throw redirect("/dashboard");
  }
};
