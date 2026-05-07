import { organizationContract } from "./organization";

export const contract = {
	organization: organizationContract,
};

export type AppContract = typeof contract;
