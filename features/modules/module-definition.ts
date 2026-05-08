import type { OrganizationSettings } from "@/features/settings/settings.shared";

export type ModuleEntitlementStatus = "granted" | "blocked";
export type ModuleActivationPolicy =
	| "self_service"
	| "entitled_self_service"
	| "platform_admin_only";

export type ModuleNavigationItem = {
	id: string;
	label: string;
	path: string;
	order: number;
	icon: string;
};

export type ModuleDefinition<
	Key extends string = string,
	Flags extends Record<string, boolean> = Record<string, boolean>,
> = {
	key: Key;
	label: string;
	activationPolicy: ModuleActivationPolicy;
	defaultEntitlementStatus: ModuleEntitlementStatus;
	getEnabled(settings: OrganizationSettings): boolean;
	getFlags(settings: OrganizationSettings): Flags;
	getNavigation(input: {
		settings: OrganizationSettings;
		accessible: boolean;
		flags: Flags;
	}): ModuleNavigationItem[];
};

export function defineModule<
	Key extends string,
	Flags extends Record<string, boolean>,
>(definition: ModuleDefinition<Key, Flags>) {
	return definition;
}
