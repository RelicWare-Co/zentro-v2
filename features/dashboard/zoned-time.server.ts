import { type SQL, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm/column";

/**
 * Day/month boundaries for dashboard metrics must follow the business's wall
 * clock, not the server's (production containers run in UTC). These helpers
 * compute calendar boundaries in an explicit IANA time zone using Intl, so no
 * extra dependency is needed.
 */

// Letters, digits, "_", "+", "-" and "/" cover every IANA zone name. The
// strict shape also makes the value safe to inline as a SQL string literal.
const SAFE_TIME_ZONE_REGEX = /^[A-Za-z][A-Za-z0-9_+\-/]*$/;

// The dashboard formats everything as es-CO/COP; when the client does not
// report a usable zone we fall back to Colombia instead of the server clock.
export const DEFAULT_DASHBOARD_TIME_ZONE = "America/Bogota";

export interface ZonedDateParts {
  day: number;
  /** 1-12 */
  month: number;
  year: number;
}

export function isSafeTimeZone(value: string): boolean {
  if (!SAFE_TIME_ZONE_REGEX.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date key for a sale timestamp in the org's IANA time zone. */
export function buildZonedSaleDateKey(
  createdAtColumn: AnyColumn,
  timeZone: string
): SQL<string> {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid time zone: ${timeZone}`);
  }

  return sql<string>`to_char(${createdAtColumn} at time zone ${timeZone}, 'YYYY-MM-DD')`;
}

export function resolveDashboardTimeZone(
  requested: string | null | undefined
): string {
  if (requested && isSafeTimeZone(requested)) {
    return requested;
  }
  return DEFAULT_DASHBOARD_TIME_ZONE;
}

function extractNumericParts(
  formatter: Intl.DateTimeFormat,
  date: Date
): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return parts;
}

export function getZonedDateParts(
  date: Date,
  timeZone: string
): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = extractNumericParts(formatter, date);

  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
  };
}

/** Day/month offsets may overflow; Date.UTC normalizes the calendar math. */
export function shiftZonedDateParts(
  parts: ZonedDateParts,
  offset: { days?: number; months?: number }
): ZonedDateParts {
  const normalized = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1 + (offset.months ?? 0),
      parts.day + (offset.days ?? 0)
    )
  );

  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
  };
}

export function formatZonedDateKey(parts: ZonedDateParts): string {
  const month = `${parts.month}`.padStart(2, "0");
  const day = `${parts.day}`.padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = extractNumericParts(formatter, date);
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    // hour12:false can yield "24" for midnight in some runtimes
    (parts.hour ?? 0) % 24,
    parts.minute ?? 0,
    parts.second ?? 0
  );

  return asUtc - date.getTime();
}

/** UTC instant where the given calendar day starts in the time zone. */
export function zonedMidnightUtc(
  parts: ZonedDateParts,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day);
  let timestamp = utcGuess;
  // Two passes converge when the offset changes across a DST transition.
  for (let pass = 0; pass < 2; pass++) {
    timestamp = utcGuess - getTimeZoneOffsetMs(timeZone, new Date(timestamp));
  }

  return new Date(timestamp);
}
