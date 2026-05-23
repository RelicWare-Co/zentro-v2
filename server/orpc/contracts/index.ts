import { dashboardContract } from "./dashboard";
import { modulesContract } from "./modules";
import { organizationContract } from "./organization";
import { restaurantsContract } from "./restaurants";

export const contract = {
  organization: organizationContract,
  modules: modulesContract,
  dashboard: dashboardContract,
  restaurants: restaurantsContract,
};
