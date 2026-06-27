import { and, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "@/database/drizzle/db";
import { member, organization } from "@/database/drizzle/schema/auth.schema";
import { organizationModuleEntitlement } from "@/database/drizzle/schema/feature.schema";
import { MODULE_KEYS } from "@/features/modules/module-registry";
import { getRestaurantModuleToggleSettings } from "@/features/restaurants/restaurants.module";
import {
  buildModuleAccessStates,
  buildViewerAccess,
  type ModuleEntitlementRow,
} from "@/features/settings/organization-environment.shared";
import type { UpdateSettingsSchema } from "@/features/settings/settings.schema";
import {
  normalizeOrganizationSettings,
  parseOrganizationSettingsMetadata,
  serializeOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type { ZeroContext } from "@/zero/sdk";

export type UpdateSettingsDbExecutor = Pick<Database, "select" | "update">;

type UpdateOrganizationSettingsInput = z.infer<typeof UpdateSettingsSchema>;

export async function runUpdateOrganizationSettings(
  tx: UpdateSettingsDbExecutor,
  args: UpdateOrganizationSettingsInput,
  auth: Pick<ZeroContext, "id" | "orgID" | "role" | "systemRole">
) {
  if (!auth.orgID) {
    throw new Error("No autorizado");
  }

  const organizationId = auth.orgID;
  const [organizationRow, memberRow, entitlementRows] = await Promise.all([
    tx
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    tx
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, auth.id)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    tx
      .select({
        moduleKey: organizationModuleEntitlement.moduleKey,
        status: organizationModuleEntitlement.status,
      })
      .from(organizationModuleEntitlement)
      .where(
        and(
          eq(organizationModuleEntitlement.organizationId, organizationId),
          inArray(organizationModuleEntitlement.moduleKey, MODULE_KEYS)
        )
      ),
  ]);

  if (!organizationRow) {
    throw new Error("No se encontró la organización activa.");
  }

  if (!memberRow) {
    throw new Error("No perteneces a la organización activa.");
  }

  const viewerAccess = buildViewerAccess({
    id: auth.id,
    orgID: auth.orgID,
    role: auth.role,
    systemRole: auth.systemRole,
  });

  if (!viewerAccess.isOrganizationManager) {
    throw new Error(
      "Necesitas rol admin u owner para cambiar la configuración."
    );
  }

  const currentSettings = parseOrganizationSettingsMetadata(
    organizationRow.metadata
  );
  const normalizedSettings = normalizeOrganizationSettings(args.settings);
  const modules = buildModuleAccessStates({
    settings: currentSettings,
    entitlementRows: entitlementRows as ModuleEntitlementRow[],
    access: viewerAccess,
  });
  const isRestaurantToggleChanging =
    getRestaurantModuleToggleSettings(normalizedSettings).enabled !==
    getRestaurantModuleToggleSettings(currentSettings).enabled;

  if (isRestaurantToggleChanging && !modules.restaurants.canManageToggle) {
    throw new Error(
      "No puedes cambiar la activación del módulo de restaurantes."
    );
  }

  await tx
    .update(organization)
    .set({
      metadata: serializeOrganizationSettingsMetadata(normalizedSettings),
    })
    .where(eq(organization.id, organizationId));

  return {
    success: true as const,
    settings: normalizedSettings,
  };
}
