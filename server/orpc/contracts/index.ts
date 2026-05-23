import { dashboardContract } from "./dashboard";
import { modulesContract } from "./modules";
import { organizationContract } from "./organization";
import { restaurantsContract } from "./restaurants";
import { settingsContract } from "./settings";

export const contract = {
  organization: organizationContract,
  modules: modulesContract,
  settings: settingsContract,
  dashboard: dashboardContract,
  restaurants: restaurantsContract,
};
