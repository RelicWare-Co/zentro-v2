import { z } from "zod";

const NullableStringSchema = z.string().trim().optional().nullable();

export const RestaurantTableDetailInputSchema = z.object({
  tableId: z.string().trim().min(1),
});

export const AddRestaurantOrderItemInputSchema = z.object({
  tableId: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  notes: NullableStringSchema,
  modifierProductIds: z.array(z.string().trim().min(1)).optional(),
  modifiers: z
    .array(
      z.object({
        modifierProductId: z.string().trim().min(1),
        quantity: z.coerce.number().int().positive(),
      })
    )
    .optional(),
});

export const UpdateRestaurantOrderMetaInputSchema = z
  .object({
    orderId: z.string().trim().min(1),
    guestCount: z.coerce.number().int().min(0).optional(),
    notes: NullableStringSchema,
  })
  .refine(
    (input) => input.guestCount !== undefined || input.notes !== undefined,
    {
      message: "Debes enviar al menos un cambio para la cuenta.",
    }
  );

export const UpdateRestaurantOrderItemInputSchema = z.object({
  orderItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive(),
  notes: NullableStringSchema,
});

export const DeleteRestaurantOrderItemInputSchema = z.object({
  orderItemId: z.string().trim().min(1),
});

export const SendRestaurantOrderToKitchenInputSchema = z.object({
  orderId: z.string().trim().min(1),
});

export const CancelRestaurantOrderInputSchema = z.object({
  orderId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
});

export const UpdateRestaurantOrderItemStatusInputSchema = z.object({
  ticketLineId: z.string().trim().min(1),
  status: z.enum(["ready", "served", "cancelled", "acknowledged"]),
});

export const CloseRestaurantOrderInputSchema = z.object({
  orderId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
  customerId: NullableStringSchema,
  discountAmount: z.coerce.number().int().min(0).optional(),
  saleId: z.string().trim().min(1).optional(),
  payments: z
    .array(
      z.object({
        method: z.string().trim().min(1),
        amount: z.coerce.number().int().positive(),
        reference: NullableStringSchema,
      })
    )
    .min(1),
});

export const CreateRestaurantAreaInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const UpdateRestaurantAreaInputSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).max(60).optional(),
  })
  .refine((input) => input.name !== undefined, {
    message: "Debes enviar al menos un cambio para la zona.",
  });

export const DeleteRestaurantAreaInputSchema = z.object({
  id: z.string().trim().min(1),
});

export const CreateRestaurantTableInputSchema = z.object({
  areaId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(40),
  seats: z.coerce.number().int().min(0).max(50).optional(),
});

export const UpdateRestaurantTableInputSchema = z
  .object({
    id: z.string().trim().min(1),
    areaId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(40).optional(),
    seats: z.coerce.number().int().min(0).max(50).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.areaId !== undefined ||
      input.name !== undefined ||
      input.seats !== undefined ||
      input.isActive !== undefined,
    {
      message: "Debes enviar al menos un cambio para la mesa.",
    }
  );

export const DeleteRestaurantTableInputSchema = z.object({
  id: z.string().trim().min(1),
});

// Schemas reutilizados del POS
const RestaurantPaymentMethodSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiresReference: z.boolean(),
});

const RestaurantCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
});

const RestaurantActiveShiftSchema = z.object({
  id: z.string(),
  terminalId: z.string().nullable().optional(),
  terminalName: z.string().nullable().optional(),
  status: z.string(),
  startingCash: z.number(),
  openedAt: z.number().nullable().optional(),
  closedAt: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const RestaurantKitchenSettingsSchema = z.object({
  displayEnabled: z.boolean(),
  printTicketsEnabled: z.boolean(),
  autoPrintOnSend: z.boolean(),
});

const RestaurantSettingsSchema = z.object({
  paymentMethods: RestaurantPaymentMethodSchema.array(),
  defaultTerminalName: z.string(),
  restaurant: z.object({
    kitchen: RestaurantKitchenSettingsSchema,
  }),
});

const RestaurantTableOpenOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  itemCount: z.number(),
  totalAmount: z.number(),
  taxAmount: z.number(),
  draftItemsCount: z.number(),
  readyItemsCount: z.number(),
  servedItemsCount: z.number(),
});

const RestaurantTableSummarySchema = z.object({
  id: z.string(),
  areaId: z.string(),
  name: z.string(),
  seats: z.number(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  openOrder: RestaurantTableOpenOrderSchema.nullable(),
});

const RestaurantAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  tables: RestaurantTableSummarySchema.array(),
});

export const RestaurantBootstrapSchema = z.object({
  activeShift: RestaurantActiveShiftSchema.nullable(),
  categories: RestaurantCategorySchema.array(),
  settings: RestaurantSettingsSchema,
  areas: RestaurantAreaSchema.array(),
});

const RestaurantOrderItemModifierSchema = z.object({
  id: z.string(),
  modifierProductId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  name: z.string(),
});

const RestaurantOrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  productName: z.string(),
  kitchenTicketId: z.string().nullable().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  taxRate: z.number(),
  discountAmount: z.number(),
  notes: z.string().nullable().optional(),
  pendingCancellation: z.boolean().optional(),
  sentModifiersSnapshot: z.string().optional(),
  sentNotes: z.string().nullable().optional(),
  sentProductName: z.string().nullable().optional(),
  sentQuantity: z.number().optional(),
  status: z.string(),
  modifiers: RestaurantOrderItemModifierSchema.array(),
  baseSubtotal: z.number(),
  modifiersTotal: z.number(),
  totalAmount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  sentAt: z.number().nullable().optional(),
  readyAt: z.number().nullable().optional(),
  servedAt: z.number().nullable().optional(),
  cancelledAt: z.number().nullable().optional(),
});

const KitchenTicketLineSchema = z.object({
  id: z.string(),
  operation: z.enum(["prepare", "cancel", "modify"]),
  productName: z.string(),
  quantity: z.number(),
  previousQuantity: z.number().nullable().optional(),
  status: z.enum(["sent", "ready", "served", "cancelled", "acknowledged"]),
  notes: z.string().nullable().optional(),
  previousNotes: z.string().nullable().optional(),
  modifiers: RestaurantOrderItemModifierSchema.array(),
  previousModifiers: RestaurantOrderItemModifierSchema.array(),
});

const RestaurantKitchenTicketSchema = z.object({
  id: z.string(),
  kind: z.enum(["initial", "correction"]),
  sequenceNumber: z.number(),
  status: z.string(),
  createdAt: z.number(),
  printedAt: z.number().nullable().optional(),
  lines: KitchenTicketLineSchema.array(),
});

const RestaurantOrderTotalsSchema = z.object({
  itemCount: z.number(),
  totalAmount: z.number(),
  taxAmount: z.number(),
  draftItemsCount: z.number(),
  readyItemsCount: z.number(),
  servedItemsCount: z.number(),
});

const RestaurantOpenOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.number(),
  guestCount: z.number(),
  notes: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  items: RestaurantOrderItemSchema.array(),
  tickets: RestaurantKitchenTicketSchema.array(),
  hasPendingKitchenChanges: z.boolean(),
  totals: RestaurantOrderTotalsSchema,
});

export const RestaurantTableDetailSchema = z.object({
  table: z.object({
    id: z.string(),
    areaId: z.string(),
    name: z.string(),
    seats: z.number(),
    isActive: z.boolean(),
    areaName: z.string(),
  }),
  openOrder: RestaurantOpenOrderSchema.nullable(),
});

export const RestaurantConfigurationSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    sortOrder: z.number(),
    tables: z.array(
      z.object({
        id: z.string(),
        areaId: z.string(),
        name: z.string(),
        seats: z.number(),
        sortOrder: z.number(),
        isActive: z.boolean(),
        openOrder: z.literal(null),
      })
    ),
  })
);

const SendToKitchenTicketSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.number(),
  kind: z.enum(["initial", "correction"]),
  sequenceNumber: z.number(),
  createdAt: z.number(),
  table: z.object({
    id: z.string(),
    name: z.string(),
    areaName: z.string(),
  }),
  lines: z.array(
    z.object({
      orderItemId: z.string(),
      operation: z.enum(["prepare", "cancel", "modify"]),
      productName: z.string(),
      quantity: z.number(),
      previousQuantity: z.number().nullable(),
      notes: z.string().nullable(),
      previousNotes: z.string().nullable(),
      modifiers: RestaurantOrderItemModifierSchema.array(),
      previousModifiers: RestaurantOrderItemModifierSchema.array(),
    })
  ),
});

export const SendToKitchenResultSchema = z.object({
  ticket: SendToKitchenTicketSchema,
  printing: z.object({
    enabled: z.boolean(),
    autoPrintOnSend: z.boolean(),
  }),
});

const KitchenBoardTicketSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.number(),
  kind: z.enum(["initial", "correction"]),
  sequenceNumber: z.number(),
  status: z.string(),
  createdAt: z.number(),
  table: z.object({
    id: z.string(),
    name: z.string(),
    areaName: z.string(),
  }),
  lines: KitchenTicketLineSchema.array(),
});

export const KitchenBoardSchema = z.object({
  tickets: KitchenBoardTicketSchema.array(),
});

export const SuccessResultSchema = z.object({
  success: z.boolean(),
});
