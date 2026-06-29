import type {
  ModuleActivationPolicy,
  ModuleEntitlementStatus,
  ModuleNavigationItem,
} from "./module-definition";
import type { ModuleKey } from "./module-keys";

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

export function isModuleEntitled(status: ModuleEntitlementStatus) {
  return status === "granted";
}
