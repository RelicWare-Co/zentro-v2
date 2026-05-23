// Shared Zero auth context.
//
// `ZeroContext` is the trusted, server-derived bag of facts that every
// query/mutator receives via `ctx`. The server constructs it in
// `server/zero/context.server.ts` from the better-auth session. The client
// receives a parallel copy through `ZeroOptions.context` for optimistic
// reads/writes — but the **server copy is authoritative** and is what
// permission filters in queries/mutators must rely on.
//
// Never read membership, role, or org from the client args; always use `ctx`.

import type { OrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";

export interface ZeroContext {
  /** Normalized user email for invitation lookups and selection flows. */
  email: string;
  /** better-auth user id (`session.userId`). */
  id: string;
  /** Server-derived, sanitized organization access policy for client UI. */
  organizationPolicy: OrganizationAccessPolicy;
  /** Active organization id from `session.activeOrganizationId`, or null when unset. */
  orgID: string | null;
  /**
   * Better-auth member role within `orgID`. May be `null` when the user is in
   * a transient state (just joined, role not yet provisioned, or no active org).
   * Permission helpers should treat `null` as the lowest-trust role.
   */
  role: "owner" | "admin" | "member" | null;
  /**
   * Better-auth top-level role (admin plugin). `null` for regular users.
   * Useful for cross-org god-mode checks.
   */
  systemRole: "admin" | null;
}

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    context: ZeroContext | undefined;
  }
}
