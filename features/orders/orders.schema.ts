import { z } from "zod";

export const PEDIDO_FULFILLMENT_VALUES = ["takeaway", "delivery"] as const;
export type PedidoFulfillment = (typeof PEDIDO_FULFILLMENT_VALUES)[number];

export const PEDIDO_STATUS_VALUES = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type PedidoStatus = (typeof PEDIDO_STATUS_VALUES)[number];

export const PEDIDO_SOURCE_VALUES = [
  "pos",
  "web",
  "whatsapp",
  "phone",
] as const;
export type PedidoSource = (typeof PEDIDO_SOURCE_VALUES)[number];

const CreateOrderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  notes: z.string().trim().max(280).optional(),
});

export const CreateOrderInputSchema = z.object({
  organizationSlug: z.string().trim().min(1),
  fulfillment: z.enum(PEDIDO_FULFILLMENT_VALUES),
  contactName: z.string().trim().min(1, "El nombre es obligatorio"),
  contactPhone: z.string().trim().min(1, "El teléfono es obligatorio"),
  deliveryAddress: z.string().trim().optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(CreateOrderItemSchema)
    .min(1, "El pedido debe incluir al menos un ítem"),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const CreateOrderResultSchema = z.object({
  orderId: z.string(),
  orderNumber: z.number(),
  status: z.string(),
  totalAmount: z.number(),
});

export type CreateOrderResult = z.infer<typeof CreateOrderResultSchema>;

export const PUBLIC_CATALOG_ITEM_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
});

export const PUBLIC_CATALOG_SCHEMA = z.object({
  organizationName: z.string(),
  organizationSlug: z.string(),
  products: z.array(PUBLIC_CATALOG_ITEM_SCHEMA),
});

export type PublicCatalog = z.infer<typeof PUBLIC_CATALOG_SCHEMA>;
export type PublicCatalogItem = z.infer<typeof PUBLIC_CATALOG_ITEM_SCHEMA>;
