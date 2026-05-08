import { organizationContract } from "./organization";
import { modulesContract } from "./modules";
import { settingsContract } from "./settings";
import { productsContract } from "./products";
import { customersContract } from "./customers";
import { creditContract } from "./credit";
import { dashboardContract } from "./dashboard";

export const contract = {
	organization: organizationContract,
	modules: modulesContract,
	settings: settingsContract,
	products: productsContract,
	customers: customersContract,
	credit: creditContract,
	dashboard: dashboardContract,
};

export type AppContract = typeof contract;
