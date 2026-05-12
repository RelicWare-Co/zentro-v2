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

export type {
	
	ModuleEntitlementStatus,
	
};
export { MODULE_KEYS, type ModuleKey };

export type ModuleAccessState = {
	key: ModuleKey;
	label: string;
	entitlementStatus: ModuleEntitlementStatus;
	activationPolicy: ModuleActivationPolicy;
	enabled: boolean;
	accessible: boolean;
	canManageToggle: boolean;
	requiresPlatformAdmin: boolean;
	flags: Record<string, boolean>;
	navigation: ModuleNavigationItem[];
};

const MODULE_CATALOG = Object.fromEntries(
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
	}),
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
