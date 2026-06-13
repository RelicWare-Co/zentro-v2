import type { ZeroContext } from "@/zero/context";
import { zql } from "@/zero/schema";

export function denyAllMembers() {
  return zql.member.where(({ cmpLit }) => cmpLit(false, "=", true));
}

export function hasOrgContext(
  ctx: ZeroContext | undefined
): ctx is ZeroContext & { orgID: string } {
  return Boolean(ctx?.orgID);
}
