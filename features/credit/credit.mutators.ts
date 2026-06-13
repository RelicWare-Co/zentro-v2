import { defineMutator } from "@rocicorp/zero";
import { z as zod } from "zod";
import "@/zero/context";

export const registerCreditPaymentArgsSchema = zod.object({
  shiftId: zod.string().trim().min(1),
  creditAccountId: zod.string().trim().min(1),
  saleId: zod.string().trim().optional().nullable(),
  amount: zod.number().int().positive(),
  method: zod.string().trim().min(1),
  reference: zod.string().trim().optional().nullable(),
  notes: zod.string().trim().optional().nullable(),
  createdAt: zod.number().int().min(0).optional(),
  paymentId: zod.string().trim().min(1),
  transactionId: zod.string().trim().min(1),
});

export const creditMutators = {
  credit: {
    registerPayment: defineMutator(
      registerCreditPaymentArgsSchema,
      async () => {
        // Server-only transaction; client completes without optimistic writes.
      }
    ),
  },
};
