import type { ZeroContext } from "./context";

export function zeroContextFingerprint(
  context: ZeroContext | null | undefined
): string | null {
  if (!context) {
    return null;
  }

  const policy = context.organizationPolicy;

  return [
    context.id,
    context.orgID ?? "",
    context.role ?? "",
    context.systemRole ?? "",
    context.email,
    policy.allowSelfServiceCreation,
    policy.contactHref ?? "",
    policy.contactLabel,
    policy.contactMessage,
  ].join("\0");
}

export function resolveStableZeroContext(
  previous: ZeroContext | undefined,
  previousFingerprint: string | null,
  next: ZeroContext | null | undefined
): { context: ZeroContext | undefined; fingerprint: string | null } {
  const nextFingerprint = zeroContextFingerprint(next);

  if (nextFingerprint === previousFingerprint && previous !== undefined) {
    return { context: previous, fingerprint: previousFingerprint };
  }

  return { context: next ?? undefined, fingerprint: nextFingerprint };
}
