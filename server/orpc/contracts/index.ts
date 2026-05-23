import { creditContract } from "./credit";
import { dashboardContract } from "./dashboard";
import { modulesContract } from "./modules";
import { organizationContract } from "./organization";
import { posContract } from "./pos";
import { restaurantsContract } from "./restaurants";
import { salesContract } from "./sales";
import { settingsContract } from "./settings";

export const contract = {
  organization: organizationContract,
  modules: modulesContract,
  settings: settingsContract,
  credit: creditContract,
  dashboard: dashboardContract,
  sales: salesContract,
  pos: posContract,
  restaurants: restaurantsContract,
};
