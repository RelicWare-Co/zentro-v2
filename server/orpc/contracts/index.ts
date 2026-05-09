import { organizationContract } from "./organization";
import { modulesContract } from "./modules";
import { settingsContract } from "./settings";
import { productsContract } from "./products";
import { customersContract } from "./customers";
import { creditContract } from "./credit";
import { dashboardContract } from "./dashboard";
import { salesContract } from "./sales";
import { shiftsContract } from "./shifts";
import { posContract } from "./pos";
import { restaurantsContract } from "./restaurants";

export const contract = {
	organization: organizationContract,
	modules: modulesContract,
	settings: settingsContract,
	products: productsContract,
	customers: customersContract,
	credit: creditContract,
	dashboard: dashboardContract,
	sales: salesContract,
	shifts: shiftsContract,
	pos: posContract,
	restaurants: restaurantsContract,
};

export type AppContract = typeof contract;
