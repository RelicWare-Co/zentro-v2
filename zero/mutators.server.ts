import { creditServerMutators } from "@/features/credit/credit.mutators.server";
import { modulesServerMutators } from "@/features/modules/modules.mutators.server";
import { organizationServerMutators } from "@/features/organization/organization.mutators.server";
import { restaurantsServerMutators } from "@/features/restaurants/restaurants.mutators.server";
import { salesServerMutators } from "@/features/sales/sales.mutators.server";
import { shiftsServerMutators } from "@/features/shifts/shifts.mutators.server";
import { defineZentroMutators } from "@/zero/sdk";
import { mutators as sharedMutators } from "./mutators";

export const serverMutators = defineZentroMutators(sharedMutators, {
  credit: creditServerMutators,
  sales: salesServerMutators,
  organization: organizationServerMutators,
  modules: modulesServerMutators,
  restaurants: restaurantsServerMutators,
  shifts: shiftsServerMutators,
});

export type ServerMutators = typeof serverMutators;
