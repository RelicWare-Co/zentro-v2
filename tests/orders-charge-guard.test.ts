import { describe, expect, test } from "bun:test";
import { getPedidoChargeBlocker } from "@/features/orders/orders.shared";

describe("getPedidoChargeBlocker", () => {
  test("allows a v2 order without fee or modifiers", () => {
    expect(
      getPedidoChargeBlocker({ deliveryFee: 0, modifiersCount: 0 })
    ).toBeNull();
  });

  test("blocks an order with a delivery fee", () => {
    expect(
      getPedidoChargeBlocker({ deliveryFee: 5000, modifiersCount: 0 })
    ).toBe("delivery");
  });

  test("blocks an order with item modifiers", () => {
    expect(getPedidoChargeBlocker({ deliveryFee: 0, modifiersCount: 2 })).toBe(
      "modifiers"
    );
  });

  test("delivery wins when both are present", () => {
    expect(
      getPedidoChargeBlocker({ deliveryFee: 5000, modifiersCount: 2 })
    ).toBe("delivery");
  });
});
