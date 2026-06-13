import { defineMutator } from "@rocicorp/zero";
import { SetModuleEntitlementSchema } from "@/features/modules/modules.schema";
import "@/zero/context";

export const setModuleEntitlementArgsSchema = SetModuleEntitlementSchema;

export const modulesMutators = {
  modules: {
    setEntitlement: defineMutator(setModuleEntitlementArgsSchema, async () => {
      // Server-only entitlement writes; client completes without optimistic writes.
    }),
  },
};
