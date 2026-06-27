import type { CancelSaleDbExecutor } from "@/features/sales/cancel-sale.server";
import { runCancelSale } from "@/features/sales/cancel-sale.server";
import type { CreateSaleDbExecutor } from "@/features/sales/create-sale.server";
import { runCreateSale } from "@/features/sales/create-sale.server";
import {
  cancelSaleArgsSchema,
  createSaleArgsSchema,
} from "@/features/sales/sales.mutators";
import { defineZentroMutator, requireOrgContext } from "@/zero/sdk";

export const salesServerMutators = {
  create: defineZentroMutator(
    createSaleArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "La creación de ventas solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCreateSale(drizzleTx as unknown as CreateSaleDbExecutor, args, {
        organizationId: requireOrgContext(ctx).orgID,
        userId: ctx.id,
      });
    }
  ),
  cancel: defineZentroMutator(
    cancelSaleArgsSchema,
    async ({ tx, args, ctx }) => {
      if (!ctx) {
        throw new Error("No autorizado");
      }

      if (!("dbTransaction" in tx)) {
        throw new Error(
          "La anulación de ventas solo puede ejecutarse en el servidor"
        );
      }

      const drizzleTx = tx.dbTransaction.wrappedTransaction;
      await runCancelSale(drizzleTx as unknown as CancelSaleDbExecutor, args, {
        organizationId: requireOrgContext(ctx).orgID,
        userId: ctx.id,
      });
    }
  ),
};
