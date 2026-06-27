import { setModuleEntitlementArgsSchema } from "@/features/modules/modules.mutators";
import type { SetModuleEntitlementDbExecutor } from "@/features/modules/set-entitlement.server";
import { runSetModuleEntitlement } from "@/features/modules/set-entitlement.server";
import { defineZentroServerMutator } from "@/zero/sdk.server";

export const modulesServerMutators = {
  setEntitlement: defineZentroServerMutator(
    setModuleEntitlementArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      await runSetModuleEntitlement(
        drizzleTx as unknown as SetModuleEntitlementDbExecutor,
        args,
        auth.zeroContext
      );
    },
    { operationName: "La actualización de entitlements" }
  ),
};
