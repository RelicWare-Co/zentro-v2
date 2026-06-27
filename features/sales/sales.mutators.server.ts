import type { CancelSaleDbExecutor } from "@/features/sales/cancel-sale.server";
import { runCancelSale } from "@/features/sales/cancel-sale.server";
import type { CreateSaleDbExecutor } from "@/features/sales/create-sale.server";
import { runCreateSale } from "@/features/sales/create-sale.server";
import {
  cancelSaleArgsSchema,
  createSaleArgsSchema,
} from "@/features/sales/sales.mutators";
import { defineZentroServerMutator } from "@/zero/sdk.server";

export const salesServerMutators = {
  create: defineZentroServerMutator(
    createSaleArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      await runCreateSale(drizzleTx as unknown as CreateSaleDbExecutor, args, {
        organizationId: auth.organizationId,
        userId: auth.userId,
      });
    },
    { operationName: "La creación de ventas" }
  ),
  cancel: defineZentroServerMutator(
    cancelSaleArgsSchema,
    async ({ drizzleTx, args, auth }) => {
      await runCancelSale(drizzleTx as unknown as CancelSaleDbExecutor, args, {
        organizationId: auth.organizationId,
        userId: auth.userId,
      });
    },
    { operationName: "La anulación de ventas" }
  ),
};
