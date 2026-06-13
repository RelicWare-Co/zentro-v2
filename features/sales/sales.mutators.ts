import { defineMutator } from "@rocicorp/zero";
import { z as zod } from "zod";
import {
  CancelSaleInputSchema,
  CreateSaleInputSchema,
} from "@/features/sales/sales.schema";
import "@/zero/context";

export const createSaleArgsSchema = CreateSaleInputSchema.extend({
  saleId: zod.string().trim().min(1),
});

export const cancelSaleArgsSchema = CancelSaleInputSchema;

export const salesMutators = {
  sales: {
    create: defineMutator(createSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
    cancel: defineMutator(cancelSaleArgsSchema, async () => {
      // Server-only transaction; client completes without optimistic writes.
    }),
  },
};
