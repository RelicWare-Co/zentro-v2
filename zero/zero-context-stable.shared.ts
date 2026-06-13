import type { ZeroContext } from "./context";

export function zeroContextSignature(
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
  previousSignature: string | null,
  next: ZeroContext | null | undefined
): { context: ZeroContext | undefined; signature: string | null } {
  const nextSignature = zeroContextSignature(next);

  if (nextSignature === previousSignature && previous !== undefined) {
    return { context: previous, signature: previousSignature };
  }

  return { context: next ?? undefined, signature: nextSignature };
}
