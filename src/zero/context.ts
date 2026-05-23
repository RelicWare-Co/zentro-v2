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

export interface ZeroContext {
  /** better-auth user id (`session.userId`). */
  id: string;
  /** Active organization id from `session.activeOrganizationId`. */
  orgID: string;
  /**
   * Better-auth member role within `orgID`. May be `null` when the user is in
   * a transient state (just joined, role not yet provisioned). Permission
   * helpers should treat `null` as the lowest-trust role.
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
