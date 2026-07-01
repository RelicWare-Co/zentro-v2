import { defineModule } from "@/features/modules/module-definition";
import { RestaurantTablesPosExtension } from "@/features/restaurants/components/restaurant-tables-pos-extension";
import { RESTAURANT_POS_EXTENSION_IDS } from "@/features/restaurants/restaurants-pos-extension.shared";
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
  getPosExtensions: ({ accessible }) =>
    accessible
      ? [
          {
            Component: RestaurantTablesPosExtension,
            id: RESTAURANT_POS_EXTENSION_IDS.TABLES,
            slot: "catalog-overlay",
          },
        ]
      : [],
});
