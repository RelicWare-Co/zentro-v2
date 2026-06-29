import { z } from "zod";
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
  settings: OrganizationSettings
) {
  return settings.modules.restaurants;
}

export function getRestaurantModuleSettings(settings: OrganizationSettings) {
  return settings.restaurants;
}
