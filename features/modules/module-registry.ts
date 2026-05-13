import { restaurantModuleDefinition } from "@/features/restaurants/restaurants.module";
import type { ModuleDefinition } from "./module-definition";

const MODULE_REGISTRY = {
  restaurants: restaurantModuleDefinition,
} as const satisfies Record<string, ModuleDefinition>;

export type ModuleKey = keyof typeof MODULE_REGISTRY;

export const MODULE_KEYS = Object.keys(MODULE_REGISTRY) as [
  ModuleKey,
  ...ModuleKey[],
];

export function getModuleDefinition(moduleKey: ModuleKey) {
  return MODULE_REGISTRY[moduleKey];
}
