import { describe, expect, test } from "bun:test";
import { buildSaleFilterOptions } from "@/features/sales/sales.shared";
import { buildShiftFilterOptions } from "@/features/shifts/shift-list-helpers.shared";

const DUPLICATE_MEMBERS = [
  {
    userId: "duplicate-user-id",
    user: { name: "Usuario duplicado" },
  },
  {
    userId: "duplicate-user-id",
    user: { name: "Usuario duplicado" },
  },
];

describe("member-backed filter options", () => {
  test("shift cashier options contain each user only once", () => {
    const result = buildShiftFilterOptions({
      members: DUPLICATE_MEMBERS,
      organizationMetadata: null,
      terminalNames: [],
    });

    expect(result.cashiers).toEqual([
      { id: "duplicate-user-id", name: "Usuario duplicado" },
    ]);
  });

  test("sale cashier options contain each user only once", () => {
    const result = buildSaleFilterOptions({
      members: DUPLICATE_MEMBERS,
      organizationMetadata: null,
      terminalNames: [],
    });

    expect(result.cashiers).toEqual([
      { id: "duplicate-user-id", name: "Usuario duplicado" },
    ]);
  });
});
