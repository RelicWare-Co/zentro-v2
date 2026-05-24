import { RestaurantModuleSettingsCard } from "@/features/restaurants/components/restaurant-module-settings-card";
import { useRestaurantConfiguration } from "@/features/restaurants/hooks/use-restaurants";
import { useSettingsPage } from "@/features/settings/settings-page-context";

export function RestaurantConfigurationCard() {
  const { actions, state } = useSettingsPage();
  const { canManageSettings, draftSettings, data } = state;
  const { data: configuration } = useRestaurantConfiguration();

  if (!data) {
    return null;
  }

  return (
    <RestaurantModuleSettingsCard
      canManageSettings={canManageSettings}
      configuration={configuration ?? []}
      moduleAccess={data.modules.restaurants}
      onSettingsChange={actions.setDraftSettings}
      settings={draftSettings}
    />
  );
}
