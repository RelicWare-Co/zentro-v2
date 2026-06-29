import { defineModule } from "@/features/modules/module-definition";
import type { OrganizationSettings } from "@/features/settings/settings.shared";
import {
  getRestaurantModuleSettings,
  getRestaurantModuleToggleSettings,
} from "./restaurants-settings.shared";
import { tableSaleModeFactory } from "./table-sale-mode";

function isRestaurantModuleEnabled(settings: OrganizationSettings) {
  return getRestaurantModuleToggleSettings(settings).enabled;
}

function getRestaurantModuleFlags(settings: OrganizationSettings) {
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

    return flags.kitchenDisplayEnabled
      ? [
          {
            id: "restaurants-kitchen",
            label: "Cocina",
            path: "/kitchen",
            order: 36,
            icon: "chef-hat",
          },
        ]
      : [];
  },
  getPosSaleModes: () => [tableSaleModeFactory],
});
