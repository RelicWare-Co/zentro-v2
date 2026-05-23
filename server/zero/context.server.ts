// Build a `ZeroContext` from the current Hono request.
//
// This is the trust boundary for Zero. The handler **must** call this and
// pass the resulting context to `handleQueryRequest`/`handleMutateRequest`
// — never accept identity from the client payload.
//
// Returns `null` when the request has no valid better-auth session, no active
// organization, or no current membership row for that organization (the (app)
// routes are guarded elsewhere; Zero clients are only mounted there).

import { and, eq } from "drizzle-orm";
import { db } from "@/database/drizzle/db";
import { member } from "@/database/drizzle/schema";
import { auth as authInstance } from "@/server/auth";
import type { ZeroContext } from "@/src/zero/context";

type AuthSession = (typeof authInstance)["$Infer"]["Session"];

export interface ZeroAuth {
  /** Pass to mutator/query handlers as `ctx`. */
  ctx: ZeroContext;
  /** Raw better-auth session, in case downstream handlers need cookies/IP/etc. */
  session: AuthSession["session"];
  /** Raw better-auth user. */
  user: AuthSession["user"];
  /** Pass to `handleQueryRequest`/`handleMutateRequest`'s `userID` field. */
  userID: string;
}

export type ResolvedAuthSession = AuthSession | null;

function asOrgRole(role: string | null | undefined): ZeroContext["role"] {
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }
  return null;
}

function asSystemRole(
  role: string | null | undefined
): ZeroContext["systemRole"] {
  return role === "admin" ? "admin" : null;
}

/**
 * Resolve the better-auth session for an incoming request and project it
 * into a Zero auth bundle. Returns `null` if the user is not authenticated,
 * has no active organization, or is no longer a member of that organization.
 *
 * The active member's role is read directly from Drizzle (not via the
 * better-auth REST surface) because we already have a connection and it's
 * one indexed lookup vs an extra round-trip through the auth router.
 */
export async function resolveZeroAuthFromSession(
  fullSession: ResolvedAuthSession
): Promise<ZeroAuth | null> {
  if (!(fullSession?.session && fullSession?.user)) {
    return null;
  }

  const orgID = fullSession.session.activeOrganizationId;
  if (!orgID) {
    // No active org → no Zero context. Surface this to the client as a
    // logged-out request so it sees an empty result set instead of an error.
    return null;
  }

  const [memberRow] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, fullSession.user.id),
        eq(member.organizationId, orgID)
      )
    )
    .limit(1);

  if (!memberRow) {
    // A stale activeOrganizationId is not authorization. If the user has been
    // removed from the org, Zero must behave as logged out for that org.
    return null;
  }

  const ctx: ZeroContext = {
    id: fullSession.user.id,
    orgID,
    role: asOrgRole(memberRow.role),
    systemRole: asSystemRole(fullSession.user.role),
  };

  return {
    userID: fullSession.user.id,
    ctx,
    session: fullSession.session,
    user: fullSession.user,
  };
}

export async function resolveZeroAuth(
  headers: Headers
): Promise<ZeroAuth | null> {
  let fullSession: ResolvedAuthSession = null;
  try {
    fullSession = await authInstance.api.getSession({ headers });
  } catch {
    return null;
  }

  return resolveZeroAuthFromSession(fullSession);
}
