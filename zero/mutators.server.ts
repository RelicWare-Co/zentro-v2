import { creditServerMutators } from "@/features/credit/credit.mutators.server";
import { modulesServerMutators } from "@/features/modules/modules.mutators.server";
import { ordersServerMutators } from "@/features/orders/orders.mutators.server";
import { organizationServerMutators } from "@/features/organization/organization.mutators.server";
import {
  productIngredientsServerMutators,
  productsServerMutators,
} from "@/features/products/products.mutators.server";
import { restaurantsServerMutators } from "@/features/restaurants/restaurants.mutators.server";
import { salesServerMutators } from "@/features/sales/sales.mutators.server";
import { shiftsServerMutators } from "@/features/shifts/shifts.mutators.server";
import { defineZentroMutators } from "@/zero/sdk";
import { mutators as sharedMutators } from "./mutators";

export const serverMutators = defineZentroMutators(sharedMutators, {
  credit: creditServerMutators,
  sales: salesServerMutators,
  orders: ordersServerMutators,
  organization: organizationServerMutators,
  modules: modulesServerMutators,
  restaurants: restaurantsServerMutators,
  shifts: shiftsServerMutators,
  products: productsServerMutators,
  productIngredients: productIngredientsServerMutators,
});

export type ServerMutators = typeof serverMutators;
