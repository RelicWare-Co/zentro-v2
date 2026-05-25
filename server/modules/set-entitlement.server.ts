import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { organization } from "@/database/drizzle/schema/auth.schema";
import { organizationModuleEntitlement } from "@/database/drizzle/schema/feature.schema";
import type { ModuleAccessState } from "@/features/modules/module-access.shared";
import type { ModuleKey } from "@/features/modules/module-registry";
import {
  buildModuleAccessStates,
  buildViewerAccess,
  type ModuleEntitlementRow,
} from "@/features/settings/organization-environment.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";
import type { SetModuleEntitlementSchema } from "@/schemas/modules";
import type { ZeroContext } from "@/src/zero/context";

export type SetModuleEntitlementDbExecutor = Pick<
  Database,
  "select" | "insert" | "update"
>;

type SetModuleEntitlementInput = z.infer<typeof SetModuleEntitlementSchema>;

export async function runSetModuleEntitlement(
  tx: SetModuleEntitlementDbExecutor,
  args: SetModuleEntitlementInput,
  auth: Pick<ZeroContext, "id" | "orgID" | "role" | "systemRole">
): Promise<ModuleAccessState> {
  if (!auth.orgID) {
    throw new Error("No autorizado");
  }

  const organizationId = auth.orgID;
  const viewerAccess = buildViewerAccess({
    id: auth.id,
    orgID: organizationId,
    role: auth.role,
    systemRole: auth.systemRole,
  });

  if (!viewerAccess.isPlatformAdmin) {
    throw new Error(
      "Esta acción requiere permisos de administrador de la app."
    );
  }

  const now = new Date();
  const [existingRow] = await tx
    .select({ id: organizationModuleEntitlement.id })
    .from(organizationModuleEntitlement)
    .where(
      and(
        eq(organizationModuleEntitlement.organizationId, organizationId),
        eq(organizationModuleEntitlement.moduleKey, args.moduleKey)
      )
    )
    .limit(1);

  if (existingRow) {
    await tx
      .update(organizationModuleEntitlement)
      .set({
        status: args.status,
        updatedByUserId: auth.id,
        updatedAt: now,
      })
      .where(eq(organizationModuleEntitlement.id, existingRow.id));
  } else {
    await tx.insert(organizationModuleEntitlement).values({
      id: crypto.randomUUID(),
      organizationId,
      moduleKey: args.moduleKey,
      status: args.status,
      updatedByUserId: auth.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  const [organizationRow, entitlementRows] = await Promise.all([
    tx
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    tx
      .select({
        moduleKey: organizationModuleEntitlement.moduleKey,
        status: organizationModuleEntitlement.status,
      })
      .from(organizationModuleEntitlement)
      .where(eq(organizationModuleEntitlement.organizationId, organizationId)),
  ]);

  if (!organizationRow) {
    throw new Error("No se encontró la organización activa.");
  }

  const settings = parseOrganizationSettingsMetadata(organizationRow.metadata);
  const modules = buildModuleAccessStates({
    settings,
    entitlementRows: entitlementRows as ModuleEntitlementRow[],
    access: viewerAccess,
  });

  return modules[args.moduleKey as ModuleKey];
}
