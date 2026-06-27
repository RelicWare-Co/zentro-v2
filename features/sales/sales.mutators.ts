import { z as zod } from "zod";
import {
  CancelSaleInputSchema,
  CreateSaleInputSchema,
} from "@/features/sales/sales.schema";
import { defineZentroMutator } from "@/zero/sdk";

export const createSaleArgsSchema = CreateSaleInputSchema.extend({
  saleId: zod.string().trim().min(1),
});

export const cancelSaleArgsSchema = CancelSaleInputSchema;

export const salesMutators = {
  sales: {
    create: defineZentroMutator(createSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
    cancel: defineZentroMutator(cancelSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
  },
};
