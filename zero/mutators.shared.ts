import type { Transaction } from "@rocicorp/zero";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import type { ZeroContext } from "@/zero/context";
import { type Schema, zql } from "@/zero/schema";

export type ZeroMutatorTransaction = Transaction<Schema>;

export const FORBIDDEN_MESSAGE = "No tienes acceso a la organización activa";

export function assertZeroContext(ctx: ZeroContext | undefined) {
  if (!ctx) {
    throw new Error(FORBIDDEN_MESSAGE);
  }

  return ctx;
}

export function assertOrgZeroContext(
  ctx: ZeroContext | undefined
): ZeroContext & { orgID: string } {
  const zeroContext = assertZeroContext(ctx);
  if (!zeroContext.orgID) {
    throw new Error(FORBIDDEN_MESSAGE);
  }

  return zeroContext as ZeroContext & { orgID: string };
}

export function requireOrgContext(
  ctx: ZeroContext | undefined
): ZeroContext & { orgID: string } {
  if (!ctx?.orgID) {
    throw new Error("No autorizado");
  }

  return ctx as ZeroContext & { orgID: string };
}

export async function getOrganizationSettingsFromTx({
  organizationId,
  tx,
}: {
  organizationId: string;
  tx: ZeroMutatorTransaction;
}) {
  const organizationRows = await tx.run(
    zql.organization.where("id", organizationId).limit(1)
  );
  return parseOrganizationSettingsMetadata(organizationRows[0]?.metadata);
}
