import { z as zod } from "zod";
import { defineZentroMutator } from "@/zero/sdk";

export const addRestaurantOrderItemArgsSchema = zod.object({
  tableId: zod.string().trim().min(1),
  productId: zod.string().trim().min(1),
  quantity: zod.number().int().positive(),
  notes: zod.string().trim().optional().nullable(),
  modifierProductIds: zod.array(zod.string().trim().min(1)).optional(),
  modifiers: zod
    .array(
      zod.object({
        modifierProductId: zod.string().trim().min(1),
        quantity: zod.number().int().positive(),
      })
    )
    .optional(),
  itemId: zod.string().trim().min(1),
});
export const updateRestaurantOrderMetaArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  guestCount: zod.number().int().min(0).optional(),
  notes: zod.string().trim().optional().nullable(),
});
export const updateRestaurantDraftItemArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
  quantity: zod.number().int().positive(),
  notes: zod.string().trim().optional().nullable(),
});
export const deleteRestaurantDraftItemArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
});
export const sendRestaurantOrderToKitchenArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  ticketId: zod.string().trim().min(1),
});
export const cancelRestaurantOrderArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  reason: zod.string().trim().min(1).max(500),
});
export const updateRestaurantOrderItemStatusArgsSchema = zod.object({
  orderItemId: zod.string().trim().min(1),
  status: zod.enum(["ready", "served"]),
});
export const closeRestaurantOrderArgsSchema = zod.object({
  orderId: zod.string().trim().min(1),
  shiftId: zod.string().trim().min(1),
  customerId: zod.string().trim().optional().nullable(),
  discountAmount: zod.number().int().min(0).optional(),
  saleId: zod.string().trim().min(1).optional(),
  payments: zod
    .array(
      zod.object({
        method: zod.string().trim().min(1),
        amount: zod.number().int().positive(),
        reference: zod.string().trim().optional().nullable(),
      })
    )
    .min(1),
});
export const createRestaurantAreaArgsSchema = zod.object({
  name: zod.string().trim().min(1).max(60),
});
export const updateRestaurantAreaArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  name: zod.string().trim().min(1).max(60).optional(),
});
export const deleteRestaurantAreaArgsSchema = zod.object({
  id: zod.string().trim().min(1),
});
export const createRestaurantTableArgsSchema = zod.object({
  areaId: zod.string().trim().min(1),
  name: zod.string().trim().min(1).max(40),
  seats: zod.number().int().min(0).max(50).optional(),
});
export const updateRestaurantTableArgsSchema = zod.object({
  id: zod.string().trim().min(1),
  areaId: zod.string().trim().min(1).optional(),
  name: zod.string().trim().min(1).max(40).optional(),
  seats: zod.number().int().min(0).max(50).optional(),
  isActive: zod.boolean().optional(),
});
export const deleteRestaurantTableArgsSchema = zod.object({
  id: zod.string().trim().min(1),
});

export const restaurantsMutators = {
  restaurants: {
    addOrderItem: defineZentroMutator(
      addRestaurantOrderItemArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateOrderMeta: defineZentroMutator(
      updateRestaurantOrderMetaArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateDraftItem: defineZentroMutator(
      updateRestaurantDraftItemArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    deleteDraftItem: defineZentroMutator(
      deleteRestaurantDraftItemArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    sendToKitchen: defineZentroMutator(
      sendRestaurantOrderToKitchenArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    cancelOrder: defineZentroMutator(
      cancelRestaurantOrderArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateItemStatus: defineZentroMutator(
      updateRestaurantOrderItemStatusArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    closeOrder: defineZentroMutator(
      closeRestaurantOrderArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    createArea: defineZentroMutator(
      createRestaurantAreaArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateArea: defineZentroMutator(
      updateRestaurantAreaArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    deleteArea: defineZentroMutator(
      deleteRestaurantAreaArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    createTable: defineZentroMutator(
      createRestaurantTableArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    updateTable: defineZentroMutator(
      updateRestaurantTableArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
    deleteTable: defineZentroMutator(
      deleteRestaurantTableArgsSchema,
      async () => {
        // Server-only restaurant writes; client completes without optimistic writes.
      }
    ),
  },
};
