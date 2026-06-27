// Payment method operations — server-only, reusable across domains.
//
// Loads organization settings and validates enabled payment methods.

import { eq } from "drizzle-orm";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import {
  getEnabledPaymentMethods,
  type OrganizationSettings,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";

type DrizzleTx = Pick<Database, "select" | "insert" | "update">;

export async function loadOrganizationSettings(
  tx: DrizzleTx,
  organizationId: string
): Promise<OrganizationSettings> {
  const [organizationRow] = await tx
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  if (!organizationRow) {
    throw new Error(`Organización no encontrada: ${organizationId}`);
  }
  return parseOrganizationSettingsMetadata(organizationRow.metadata);
}

export async function getEnabledPaymentMethodIds(
  tx: DrizzleTx,
  organizationId: string
): Promise<Set<string>> {
  const settings = await loadOrganizationSettings(tx, organizationId);
  return new Set(
    getEnabledPaymentMethods(settings).map((paymentMethod) => paymentMethod.id)
  );
}

export async function validateEnabledPaymentMethod(
  tx: DrizzleTx,
  organizationId: string,
  method: string
): Promise<void> {
  const enabledPaymentMethodIds = await getEnabledPaymentMethodIds(
    tx,
    organizationId
  );
  if (!enabledPaymentMethodIds.has(method)) {
    throw new Error(`Método de pago no habilitado: ${method}`);
  }
}
