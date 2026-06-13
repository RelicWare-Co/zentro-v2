import type { Transaction } from "@rocicorp/zero";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import type { ZeroContext } from "@/zero/context";
import { type Schema, zql } from "@/zero/schema";

export type ZeroMutatorTransaction = Transaction<Schema>;

export const FORBIDDEN_MESSAGE = "No tienes acceso a la organización activa";

export function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

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

export function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

export function toInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`El campo "${fieldName}" debe ser un número válido`);
  }
  return Math.round(value);
}

export function resolveTimestamp(input?: number) {
  if (input === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new Error("La fecha indicada no es válida");
  }

  return Math.round(input);
}

export function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
  }
  return normalized;
}

export function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }
  return normalized;
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
