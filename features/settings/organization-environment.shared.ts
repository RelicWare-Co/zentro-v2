import type { z } from "zod";
import {
  isModuleEntitled,
  type ModuleAccessState,
} from "@/features/modules/module-access.shared";
import type { ModuleEntitlementStatus } from "@/features/modules/module-definition";
import {
  getModuleDefinition,
  MODULE_KEYS,
  type ModuleKey,
} from "@/features/modules/module-registry";
import type { SettingsDataSchema } from "@/schemas/settings";
import {
  isOrganizationManagerRole,
  isPlatformAdminRole,
} from "@/server/organization/access-control.shared";
import type { ZeroContext } from "@/src/zero/context";
import {
  type OrganizationSettings,
  parseOrganizationSettingsMetadata,
} from "./settings.shared";

export type SettingsPageData = z.infer<typeof SettingsDataSchema>;

export interface OrganizationSnapshotRow {
  createdAt: number;
  customers?: Array<{ id: string }> | null;
  id: string;
  invitations?: Array<{ id: string }> | null;
  logo?: string | null;
  members?: Array<{ id: string }> | null;
  metadata?: string | null;
  name: string;
  products?: Array<{ id: string }> | null;
  slug: string;
}

export interface ModuleEntitlementRow {
  moduleKey: string;
  status: string | null;
}

export interface OrganizationViewerAccess {
  isOrganizationManager: boolean;
  isPlatformAdmin: boolean;
  organizationRole: string | null;
}

function toTimestamp(value: Date | number | string | null | undefined) {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? Date.now() : dateValue.getTime();
}

export function buildViewerAccess(ctx: ZeroContext): OrganizationViewerAccess {
  const organizationRole = ctx.role ?? null;
  return {
    organizationRole,
    isOrganizationManager: isOrganizationManagerRole(organizationRole),
    isPlatformAdmin: isPlatformAdminRole(
      ctx.systemRole === "admin" ? "admin" : null
    ),
  };
}

export function buildModuleAccessStates(params: {
  access: OrganizationViewerAccess;
  entitlementRows: ModuleEntitlementRow[];
  settings: OrganizationSettings;
}): Record<ModuleKey, ModuleAccessState> {
  const entitlementStatusByKey = new Map<ModuleKey, ModuleEntitlementStatus>(
    params.entitlementRows.map((row) => [
      row.moduleKey as ModuleKey,
      row.status as ModuleEntitlementStatus,
    ])
  );

  return Object.fromEntries(
    MODULE_KEYS.map((moduleKey) => {
      const definition = getModuleDefinition(moduleKey);
      const entitlementStatus =
        entitlementStatusByKey.get(moduleKey) ??
        definition.defaultEntitlementStatus;
      const entitlementGranted = isModuleEntitled(entitlementStatus);
      const enabled = definition.getEnabled(params.settings);
      const flags = definition.getFlags(params.settings);
      const requiresPlatformAdmin =
        definition.activationPolicy === "platform_admin_only";
      const canManageToggle =
        params.access.isOrganizationManager &&
        definition.activationPolicy !== "platform_admin_only" &&
        entitlementGranted;
      const accessible = entitlementGranted && enabled;

      return [
        moduleKey,
        {
          key: moduleKey,
          label: definition.label,
          entitlementStatus,
          activationPolicy: definition.activationPolicy,
          enabled,
          accessible,
          canManageToggle,
          requiresPlatformAdmin,
          flags,
          navigation: definition.getNavigation({
            settings: params.settings,
            accessible,
            flags,
          }),
        } satisfies ModuleAccessState,
      ];
    })
  ) as unknown as Record<ModuleKey, ModuleAccessState>;
}

export function buildOrganizationStats(
  organizationRow: OrganizationSnapshotRow
) {
  return {
    membersCount: organizationRow.members?.length ?? 0,
    invitationsCount: organizationRow.invitations?.length ?? 0,
    productsCount: organizationRow.products?.length ?? 0,
    customersCount: organizationRow.customers?.length ?? 0,
  };
}

export function buildSettingsPageData(params: {
  ctx: ZeroContext;
  entitlementRows: ModuleEntitlementRow[];
  organizationRow: OrganizationSnapshotRow;
}): SettingsPageData | null {
  const settings = parseOrganizationSettingsMetadata(
    params.organizationRow.metadata
  );
  const access = buildViewerAccess(params.ctx);
  const modules = buildModuleAccessStates({
    settings,
    entitlementRows: params.entitlementRows,
    access,
  });

  return {
    organization: {
      id: params.organizationRow.id,
      name: params.organizationRow.name,
      slug: params.organizationRow.slug,
      logo: params.organizationRow.logo ?? null,
      createdAt: toTimestamp(params.organizationRow.createdAt),
    },
    stats: buildOrganizationStats(params.organizationRow),
    viewer: {
      canManageSettings: access.isOrganizationManager,
      isPlatformAdmin: access.isPlatformAdmin,
    },
    modules,
    settings,
  };
}

export function buildModuleCapabilities(params: {
  ctx: ZeroContext;
  entitlementRows: ModuleEntitlementRow[];
  settings: OrganizationSettings;
}) {
  const access = buildViewerAccess(params.ctx);
  const modules = buildModuleAccessStates({
    settings: params.settings,
    entitlementRows: params.entitlementRows,
    access,
  });

  return {
    viewer: access,
    modules,
  };
}
