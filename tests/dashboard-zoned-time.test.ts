import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { sale } from "@/database/drizzle/schema/sales.schema";
import {
  buildZonedSaleDateKey,
  DEFAULT_DASHBOARD_TIME_ZONE,
  formatZonedDateKey,
  getZonedDateParts,
  isSafeTimeZone,
  resolveDashboardTimeZone,
  shiftZonedDateParts,
  zonedMidnightUtc,
  zonedSaleDateKeyAlias,
} from "@/features/dashboard/zoned-time.server";

describe("isSafeTimeZone", () => {
  test("accepts IANA zone names", () => {
    expect(isSafeTimeZone("America/Bogota")).toBe(true);
    expect(isSafeTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isSafeTimeZone("UTC")).toBe(true);
  });

  test("rejects unknown zones and SQL-unsafe input", () => {
    expect(isSafeTimeZone("Not/AZone")).toBe(false);
    expect(isSafeTimeZone("America/Bogota'; drop table sale;--")).toBe(false);
    expect(isSafeTimeZone("+05:00")).toBe(false);
    expect(isSafeTimeZone("")).toBe(false);
  });
});

describe("resolveDashboardTimeZone", () => {
  test("keeps a valid requested zone", () => {
    expect(resolveDashboardTimeZone("America/Mexico_City")).toBe(
      "America/Mexico_City"
    );
  });

  test("falls back to the default for missing or invalid zones", () => {
    expect(resolveDashboardTimeZone(undefined)).toBe(
      DEFAULT_DASHBOARD_TIME_ZONE
    );
    expect(resolveDashboardTimeZone("bogus zone")).toBe(
      DEFAULT_DASHBOARD_TIME_ZONE
    );
  });
});

describe("getZonedDateParts", () => {
  test("maps a UTC instant to the local calendar day", () => {
    // 03:00 UTC is still the previous day in Bogota (UTC-5)
    const instant = new Date("2026-06-12T03:00:00.000Z");
    expect(getZonedDateParts(instant, "America/Bogota")).toEqual({
      year: 2026,
      month: 6,
      day: 11,
    });
    expect(getZonedDateParts(instant, "UTC")).toEqual({
      year: 2026,
      month: 6,
      day: 12,
    });
  });
});

describe("zonedMidnightUtc", () => {
  test("returns 05:00 UTC for Bogota midnight", () => {
    const start = zonedMidnightUtc(
      { year: 2026, month: 6, day: 12 },
      "America/Bogota"
    );
    expect(start.toISOString()).toBe("2026-06-12T05:00:00.000Z");
  });

  test("returns 00:00 UTC for UTC midnight", () => {
    const start = zonedMidnightUtc({ year: 2026, month: 6, day: 12 }, "UTC");
    expect(start.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });

  test("handles DST transitions", () => {
    // 2026-03-08: the US springs forward at 02:00; midnight is still EST
    const beforeShift = zonedMidnightUtc(
      { year: 2026, month: 3, day: 8 },
      "America/New_York"
    );
    expect(beforeShift.toISOString()).toBe("2026-03-08T05:00:00.000Z");

    const afterShift = zonedMidnightUtc(
      { year: 2026, month: 3, day: 9 },
      "America/New_York"
    );
    expect(afterShift.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});

describe("shiftZonedDateParts", () => {
  test("normalizes day overflow across month and year edges", () => {
    expect(
      shiftZonedDateParts({ year: 2026, month: 1, day: 1 }, { days: -1 })
    ).toEqual({ year: 2025, month: 12, day: 31 });
    expect(
      shiftZonedDateParts({ year: 2026, month: 2, day: 28 }, { days: 1 })
    ).toEqual({ year: 2026, month: 3, day: 1 });
  });

  test("normalizes month overflow", () => {
    expect(
      shiftZonedDateParts({ year: 2026, month: 12, day: 1 }, { months: 1 })
    ).toEqual({ year: 2027, month: 1, day: 1 });
    expect(
      shiftZonedDateParts({ year: 2026, month: 1, day: 1 }, { months: -1 })
    ).toEqual({ year: 2025, month: 12, day: 1 });
  });
});

describe("formatZonedDateKey", () => {
  test("pads month and day", () => {
    expect(formatZonedDateKey({ year: 2026, month: 6, day: 3 })).toBe(
      "2026-06-03"
    );
  });
});

describe("buildZonedSaleDateKey", () => {
  test("uses a bound time zone parameter and a stable grouped alias", () => {
    const saleDateKey = buildZonedSaleDateKey(sale.createdAt, "America/Bogota");
    const query = new PgDialect().sqlToQuery(
      sql`select ${saleDateKey} as ${zonedSaleDateKeyAlias} from ${sale} group by ${zonedSaleDateKeyAlias} order by ${zonedSaleDateKeyAlias} asc`
    );

    expect(query.sql).toContain("at time zone $1");
    expect(query.sql).toContain('group by "dateKey"');
    expect(query.sql).toContain('order by "dateKey" asc');
    expect(query.params).toEqual(["America/Bogota"]);
  });
});
