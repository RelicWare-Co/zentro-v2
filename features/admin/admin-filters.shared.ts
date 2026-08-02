import type { z } from "zod";
import type { AdminPeriodModeSchema } from "@/features/admin/admin.schema";
import {
  getZonedDateParts,
  isSafeTimeZone,
  shiftZonedDateParts,
  zonedMidnightUtc,
} from "@/features/dashboard/zoned-time.server";

export const ADMIN_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_MAX_PAGE_SIZE = 100;
export const ADMIN_DEFAULT_TIME_ZONE = "America/Bogota";
const ADMIN_DATE_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export type AdminPeriodMode = z.infer<typeof AdminPeriodModeSchema>;

export interface AdminDateRange {
  endExclusive: Date | null;
  start: Date | null;
}

export function parseAdminBoolean(value: string | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return;
}

export function parseAdminInteger(value: string | null | undefined) {
  if (value === undefined || value === null || value.trim() === "") {
    return;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseAdminPage(value: string | null | undefined) {
  const parsed = parseAdminInteger(value);
  return parsed && parsed > 0 ? parsed : 1;
}

export function parseAdminPageSize(value: string | null | undefined) {
  const parsed = parseAdminInteger(value);
  if (!parsed || parsed < 1) {
    return ADMIN_DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, ADMIN_MAX_PAGE_SIZE);
}

export function parseAdminText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : undefined;
}

export function resolveAdminDateRange(
  mode: AdminPeriodMode,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  timeZone: string,
  now = new Date()
): AdminDateRange {
  if (!isSafeTimeZone(timeZone)) {
    throw new Error(`Invalid admin time zone: ${timeZone}`);
  }

  if (mode === "all") {
    return { start: null, endExclusive: null };
  }

  const today = getZonedDateParts(now, timeZone);
  const tomorrowStart = zonedMidnightUtc(
    shiftZonedDateParts(today, { days: 1 }),
    timeZone
  );

  if (mode === "30d") {
    return {
      start: zonedMidnightUtc(
        shiftZonedDateParts(today, { days: -29 }),
        timeZone
      ),
      endExclusive: tomorrowStart,
    };
  }

  if (!(startDate || endDate)) {
    throw new Error("El periodo personalizado requiere fechas.");
  }

  const start = startDate
    ? zonedMidnightUtc(parseDateKey(startDate), timeZone)
    : null;
  const endExclusive = endDate
    ? zonedMidnightUtc(
        shiftZonedDateParts(parseDateKey(endDate), { days: 1 }),
        timeZone
      )
    : tomorrowStart;

  if (start && start >= endExclusive) {
    throw new Error("La fecha inicial no puede ser posterior a la final.");
  }

  return { start, endExclusive };
}

function parseDateKey(value: string) {
  const match = ADMIN_DATE_KEY_REGEX.exec(value);
  if (!match) {
    throw new Error("Las fechas deben tener el formato AAAA-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error("La fecha no es válida.");
  }
  return { year, month, day };
}

export function getAdminPageOffset(page: number, pageSize: number) {
  return Math.max(0, (page - 1) * pageSize);
}
