// Build a `ZeroContext` from the current Hono request.
//
// This is the trust boundary for Zero. The handler **must** call this and
// pass the resulting context to `handleQueryRequest`/`handleMutateRequest`
// — never accept identity from the client payload.
//
// Returns `null` when the request has no valid better-auth session.
// Authenticated users without an active organization receive partial context
// (`orgID: null`) so org-selection and join-link flows can use Zero.

import { and, eq } from "drizzle-orm";
import { db } from "@/database/drizzle/db";
import { member } from "@/database/drizzle/schema";
import { auth as authInstance } from "@/server/auth";
import { getOrganizationAccessPolicy } from "@/server/organization/organization-policy";
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Resolve the better-auth session for an incoming request and project it
 * into a Zero auth bundle. Returns `null` if the user is not authenticated.
 *
 * When the user has no active organization, returns partial context with
 * `orgID: null` so selection and join-link redeem flows can still use Zero.
 */
export async function resolveZeroAuthFromSession(
  fullSession: ResolvedAuthSession
): Promise<ZeroAuth | null> {
  if (!(fullSession?.session && fullSession?.user)) {
    return null;
  }

  const orgID = fullSession.session.activeOrganizationId ?? null;
  const email = normalizeEmail(fullSession.user.email);
  const systemRole = asSystemRole(fullSession.user.role);
  const organizationPolicy = getOrganizationAccessPolicy({
    role: fullSession.user.role,
  });

  if (!orgID) {
    const ctx: ZeroContext = {
      id: fullSession.user.id,
      orgID: null,
      email,
      role: null,
      systemRole,
      organizationPolicy,
    };

    return {
      userID: fullSession.user.id,
      ctx,
      session: fullSession.session,
      user: fullSession.user,
    };
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
    // Stale activeOrganizationId — treat as partial auth without org.
    const ctx: ZeroContext = {
      id: fullSession.user.id,
      orgID: null,
      email,
      role: null,
      systemRole,
      organizationPolicy,
    };

    return {
      userID: fullSession.user.id,
      ctx,
      session: fullSession.session,
      user: fullSession.user,
    };
  }

  const ctx: ZeroContext = {
    id: fullSession.user.id,
    orgID,
    email,
    role: asOrgRole(memberRow.role),
    systemRole,
    organizationPolicy,
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
