import { defineMutator } from "@rocicorp/zero";
import { setModuleEntitlementArgsSchema } from "@/features/modules/modules.mutators";
import type { SetModuleEntitlementDbExecutor } from "@/features/modules/set-entitlement.server";
import { runSetModuleEntitlement } from "@/features/modules/set-entitlement.server";

export const modulesServerMutators = {
  setEntitlement: defineMutator(
    setModuleEntitlementArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "La actualización de entitlements solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runSetModuleEntitlement(
        drizzleTx as unknown as SetModuleEntitlementDbExecutor,
        args,
        ctx
      );
    }
  ),
};
