import { describe, expect, test } from "bun:test";
import type { ZeroContext } from "@/zero/context";
import {
  resolveStableZeroContext,
  zeroContextFingerprint,
} from "@/zero/zero-context-stable.shared";

const baseContext: ZeroContext = {
  id: "user-1",
  orgID: "org-1",
  email: "user@example.com",
  role: "owner",
  systemRole: null,
  organizationPolicy: {
    allowSelfServiceCreation: true,
    contactHref: null,
    contactLabel: "Contactar al administrador",
    contactMessage: "Puedes crear una organización nueva.",
  },
};

describe("zeroContextFingerprint", () => {
  test("returns null for missing context", () => {
    expect(zeroContextFingerprint(null)).toBeNull();
    expect(zeroContextFingerprint(undefined)).toBeNull();
  });

  test("changes when auth-relevant fields change", () => {
    const otherOrg: ZeroContext = { ...baseContext, orgID: "org-2" };
    expect(zeroContextFingerprint(baseContext)).not.toBe(
      zeroContextFingerprint(otherOrg)
    );
  });
});

describe("resolveStableZeroContext", () => {
  test("reuses previous context when fingerprint is unchanged", () => {
    const previousFingerprint = zeroContextFingerprint(baseContext);
    const nextContext = { ...baseContext };

    const resolved = resolveStableZeroContext(
      baseContext,
      previousFingerprint,
      nextContext
    );

    expect(resolved.context).toBe(baseContext);
    expect(resolved.fingerprint).toBe(previousFingerprint);
  });

  test("returns next context when fingerprint changes", () => {
    const nextContext: ZeroContext = { ...baseContext, role: "member" };

    const resolved = resolveStableZeroContext(
      baseContext,
      zeroContextFingerprint(baseContext),
      nextContext
    );

    expect(resolved.context).toBe(nextContext);
  });
});
