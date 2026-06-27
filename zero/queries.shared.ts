import type { Query } from "@rocicorp/zero";
import type { ZeroContext } from "@/zero/context";
import { type Schema, zql } from "@/zero/schema";

export type ZeroOrgContext = ZeroContext & { orgID: string };

export function denyQuery<
  TTable extends keyof Schema["tables"] & string,
  TReturn,
>(query: Query<TTable, Schema, TReturn>) {
  return query.where(({ cmpLit }) => cmpLit(false, "=", true));
}

export function denyAllMembers() {
  return denyQuery(zql.member);
}

export function hasOrgContext(
  ctx: ZeroContext | undefined
): ctx is ZeroOrgContext {
  return Boolean(ctx?.orgID);
}
