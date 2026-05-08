import { z } from "zod";
import { defineModule } from "@/features/modules/module-definition";
import type { OrganizationSettings } from "@/features/settings/settings.shared";

export const restaurantModuleToggleSettingsSchema = z.object({
	enabled: z.boolean(),
});

export const restaurantModuleSettingsSchema = z.object({
	kitchen: z.object({
		displayEnabled: z.boolean(),
		printTicketsEnabled: z.boolean(),
		autoPrintOnSend: z.boolean(),
	}),
});

export type RestaurantModuleToggleSettings = z.infer<
	typeof restaurantModuleToggleSettingsSchema
>;
export type RestaurantModuleSettings = z.infer<
	typeof restaurantModuleSettingsSchema
>;

export const DEFAULT_RESTAURANT_MODULE_TOGGLE_SETTINGS: RestaurantModuleToggleSettings =
	{
		enabled: false,
	};

export const DEFAULT_RESTAURANT_MODULE_SETTINGS: RestaurantModuleSettings = {
	kitchen: {
		displayEnabled: false,
		printTicketsEnabled: true,
		autoPrintOnSend: true,
	},
};

export function getRestaurantModuleToggleSettings(
	settings: OrganizationSettings,
) {
	return settings.modules.restaurants;
}

export function isRestaurantModuleEnabled(settings: OrganizationSettings) {
	return getRestaurantModuleToggleSettings(settings).enabled;
}

export function getRestaurantModuleSettings(settings: OrganizationSettings) {
	return settings.restaurants;
}

export function getRestaurantModuleFlags(settings: OrganizationSettings) {
	const restaurantSettings = getRestaurantModuleSettings(settings);
	return {
		kitchenDisplayEnabled: restaurantSettings.kitchen.displayEnabled,
	};
}

export const restaurantModuleDefinition = defineModule({
	key: "restaurants",
	label: "Restaurantes",
	activationPolicy: "entitled_self_service",
	defaultEntitlementStatus: "granted",
	getEnabled: isRestaurantModuleEnabled,
	getFlags: getRestaurantModuleFlags,
	getNavigation: ({ accessible, flags }) => {
		if (!accessible) {
			return [];
		}

		return [
			{
				id: "restaurants",
				label: "Restaurantes",
				path: "/restaurants",
				order: 35,
				icon: "utensils-crossed",
			},
			...(flags.kitchenDisplayEnabled
				? [
						{
							id: "restaurants-kitchen",
							label: "Cocina",
							path: "/kitchen",
							order: 36,
							icon: "chef-hat",
						},
					]
				: []),
		];
	},
});
