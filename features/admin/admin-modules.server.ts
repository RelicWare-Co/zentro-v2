import type { z } from "zod";
import type { AdminModuleStateSchema } from "@/features/admin/admin.schema";
import {
  buildModuleAccessStates,
  type ModuleEntitlementRow,
  type OrganizationViewerAccess,
} from "@/features/settings/organization-environment.shared";
import { parseOrganizationSettingsMetadata } from "@/features/settings/settings.shared";

export type AdminModuleState = z.infer<typeof AdminModuleStateSchema>;

// The admin panel always views modules as platform admin, regardless of the
// viewer's membership in the inspected organization.
const PLATFORM_ADMIN_ACCESS: OrganizationViewerAccess = {
  organizationRole: null,
  isOrganizationManager: false,
  isPlatformAdmin: true,
};

export function buildAdminModuleStates(
  metadata: string | null | undefined,
  entitlementRows: ModuleEntitlementRow[]
): AdminModuleState[] {
  const settings = parseOrganizationSettingsMetadata(metadata);
  const modules = buildModuleAccessStates({
    settings,
    entitlementRows,
    access: PLATFORM_ADMIN_ACCESS,
  });

  return Object.values(modules).map((module) => ({
    key: module.key,
    label: module.label,
    entitlementStatus: module.entitlementStatus,
    activationPolicy: module.activationPolicy,
    enabled: module.enabled,
    accessible: module.accessible,
  }));
}
