import { dashboardContract } from "./dashboard";
import { organizationContract } from "./organization";
import { restaurantsContract } from "./restaurants";

export const contract = {
  organization: organizationContract,
  dashboard: dashboardContract,
  restaurants: restaurantsContract,
};
