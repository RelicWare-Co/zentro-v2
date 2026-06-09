import { describe, expect, test } from "bun:test";
import { buildQuickSalePayments } from "@/features/pos/hooks/use-pos-checkout";

describe("POS checkout helpers", () => {
  test("quick-sale omits payment when total is zero", () => {
    expect(buildQuickSalePayments(0)).toEqual([]);
  });

  test("quick-sale creates a cash payment when total is positive", () => {
    expect(buildQuickSalePayments(12_000)).toEqual([
      {
        amount: 12_000,
        method: "cash",
        reference: null,
      },
    ]);
  });
});
