import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const InventoryMovementTypeSchema = z.enum([
  "sale",
  "restock",
  "waste",
  "adjustment",
]);

export const InventoryMovementListCursorSchema = z.object({
  createdAt: z.number().int(),
  id: z.string().trim().min(1),
});

export type InventoryMovementListCursor = z.infer<
  typeof InventoryMovementListCursorSchema
>;

export const InventoryMovementsListQueryArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  cursor: InventoryMovementListCursorSchema.optional().nullable(),
  productId: NullableStringSchema,
  type: InventoryMovementTypeSchema.optional().nullable(),
  searchQuery: NullableStringSchema,
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const ListInventoryMovementsInputSchema =
  InventoryMovementsListQueryArgsSchema;
