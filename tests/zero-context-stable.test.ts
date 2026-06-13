import { describe, expect, test } from "bun:test";
import type { ZeroContext } from "@/zero/context";
import {
  resolveStableZeroContext,
  zeroContextSignature,
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

describe("zeroContextSignature", () => {
  test("returns null for missing context", () => {
    expect(zeroContextSignature(null)).toBeNull();
    expect(zeroContextSignature(undefined)).toBeNull();
  });

  test("changes when auth-relevant fields change", () => {
    const otherOrg: ZeroContext = { ...baseContext, orgID: "org-2" };
    expect(zeroContextSignature(baseContext)).not.toBe(
      zeroContextSignature(otherOrg)
    );
  });
});

describe("resolveStableZeroContext", () => {
  test("reuses previous context when signature is unchanged", () => {
    const previousSignature = zeroContextSignature(baseContext);
    const nextContext = { ...baseContext };

    const resolved = resolveStableZeroContext(
      baseContext,
      previousSignature,
      nextContext
    );

    expect(resolved.context).toBe(baseContext);
    expect(resolved.signature).toBe(previousSignature);
  });

  test("returns next context when signature changes", () => {
    const nextContext: ZeroContext = { ...baseContext, role: "member" };

    const resolved = resolveStableZeroContext(
      baseContext,
      zeroContextSignature(baseContext),
      nextContext
    );

    expect(resolved.context).toBe(nextContext);
  });
});
