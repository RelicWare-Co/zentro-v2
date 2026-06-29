import { restaurantModuleDefinition } from "@/features/restaurants/restaurants.module";
import type { ModuleDefinition } from "./module-definition";
import type { ModuleKey } from "./module-keys";

const MODULE_REGISTRY = {
  restaurants: restaurantModuleDefinition,
} as const satisfies Record<ModuleKey, ModuleDefinition>;

export function getModuleDefinition(moduleKey: ModuleKey) {
  return MODULE_REGISTRY[moduleKey];
}
