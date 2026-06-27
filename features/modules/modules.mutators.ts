import { SetModuleEntitlementSchema } from "@/features/modules/modules.schema";
import { defineZentroMutator } from "@/zero/sdk";

export const setModuleEntitlementArgsSchema = SetModuleEntitlementSchema;

export const modulesMutators = {
  modules: {
    setEntitlement: defineZentroMutator(
      setModuleEntitlementArgsSchema,
      async () => {
        // Server-only entitlement writes; client completes without optimistic writes.
      }
    ),
  },
};
