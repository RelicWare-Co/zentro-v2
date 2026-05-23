import { creditContract } from "./credit";
import { dashboardContract } from "./dashboard";
import { modulesContract } from "./modules";
import { organizationContract } from "./organization";
import { posContract } from "./pos";
import { restaurantsContract } from "./restaurants";
import { salesContract } from "./sales";
import { settingsContract } from "./settings";
import { shiftsContract } from "./shifts";

export const contract = {
  organization: organizationContract,
  modules: modulesContract,
  settings: settingsContract,
  credit: creditContract,
  dashboard: dashboardContract,
  sales: salesContract,
  shifts: shiftsContract,
  pos: posContract,
  restaurants: restaurantsContract,
};
