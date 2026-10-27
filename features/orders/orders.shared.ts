/**
 * Cross-version guard for the shared `pedido` table.
 *
 * This app (zentro) can create orders with a delivery fee and item modifiers.
 * The v2 charge flow builds sale items from the base product price only, so
 * charging one of those orders here would record a payment larger than the
 * sale total. v2's own delivery orders have `delivery_fee = 0`, so they remain
 * chargeable.
 */
export function getPedidoChargeBlocker(input: {
  deliveryFee: number;
  modifiersCount: number;
}): "delivery" | "modifiers" | null {
  if (Number(input.deliveryFee) > 0) {
    return "delivery";
  }
  if (Number(input.modifiersCount) > 0) {
    return "modifiers";
  }
  return null;
}
