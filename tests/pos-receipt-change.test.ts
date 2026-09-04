import { describe, expect, test } from "bun:test";
import {
  resolveAppliedSalePaidAmount,
  resolveReceiptChangeDue,
} from "@/features/pos/pos.shared";

describe("resolveReceiptChangeDue", () => {
  test("returns 0 when payments exactly cover the total", () => {
    expect(resolveReceiptChangeDue(50_000, [{ amount: 50_000 }])).toBe(0);
  });

  test("returns the cash surplus when tendered exceeds the total", () => {
    expect(resolveReceiptChangeDue(50_000, [{ amount: 60_000 }])).toBe(10_000);
  });

  test("returns 0 for a partial (credit) payment", () => {
    expect(resolveReceiptChangeDue(50_000, [{ amount: 20_000 }])).toBe(0);
  });

  test("sums multiple payments before comparing with the total", () => {
    expect(
      resolveReceiptChangeDue(50_000, [{ amount: 30_000 }, { amount: 25_000 }])
    ).toBe(5000);
  });

  test("returns 0 with no payments", () => {
    expect(resolveReceiptChangeDue(50_000, [])).toBe(0);
  });
});

describe("resolveAppliedSalePaidAmount", () => {
  test("caps applied amount at the total", () => {
    expect(resolveAppliedSalePaidAmount(50_000, [{ amount: 60_000 }])).toBe(
      50_000
    );
    expect(resolveAppliedSalePaidAmount(50_000, [{ amount: 20_000 }])).toBe(
      20_000
    );
  });
});
