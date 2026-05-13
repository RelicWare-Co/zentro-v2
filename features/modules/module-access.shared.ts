import type {
  ModuleActivationPolicy,
  ModuleEntitlementStatus,
  ModuleNavigationItem,
} from "./module-definition";
import {
  getModuleDefinition,
  MODULE_KEYS,
  type ModuleKey,
} from "./module-registry";

export type { ModuleEntitlementStatus };
export { MODULE_KEYS, type ModuleKey };

export interface ModuleAccessState {
  accessible: boolean;
  activationPolicy: ModuleActivationPolicy;
  canManageToggle: boolean;
  enabled: boolean;
  entitlementStatus: ModuleEntitlementStatus;
  flags: Record<string, boolean>;
  key: ModuleKey;
  label: string;
  navigation: ModuleNavigationItem[];
  requiresPlatformAdmin: boolean;
}

const _MODULE_CATALOG = Object.fromEntries(
  MODULE_KEYS.map((moduleKey) => {
    const definition = getModuleDefinition(moduleKey);
    return [
      moduleKey,
      {
        label: definition.label,
        activationPolicy: definition.activationPolicy,
        defaultEntitlementStatus: definition.defaultEntitlementStatus,
      },
    ];
  })
) as Record<
  ModuleKey,
  {
    label: string;
    activationPolicy: ModuleActivationPolicy;
    defaultEntitlementStatus: ModuleEntitlementStatus;
  }
>;

export function isModuleEntitled(status: ModuleEntitlementStatus) {
  return status === "granted";
}
