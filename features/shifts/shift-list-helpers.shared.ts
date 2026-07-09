import {
  getAllPaymentMethods,
  parseOrganizationSettingsMetadata,
} from "@/features/settings/settings.shared";
import type {
  ShiftListCursor,
  ShiftListItem,
  ShiftsListParams,
} from "@/features/shifts/shift-types.shared";

export function parseDateBoundary(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getTime();
}

function matchesShiftDifferenceStatus(
  shift: ShiftListItem,
  differenceStatus: NonNullable<ShiftsListParams["differenceStatus"]>
) {
  switch (differenceStatus) {
    case "over":
      return shift.totals.totalDifference > 0;
    case "short":
      return shift.totals.totalDifference < 0;
    case "balanced":
      return shift.closures.length > 0 && shift.totals.totalDifference === 0;
    default:
      return true;
  }
}

export function filterShiftsClientRefinements(
  shifts: ShiftListItem[],
  input: ShiftsListParams
) {
  let rows = shifts;

  if (input.differenceStatus) {
    const differenceStatus = input.differenceStatus;
    rows = rows.filter((shift) =>
      matchesShiftDifferenceStatus(shift, differenceStatus)
    );
  }

  if (input.hasMovements === "no") {
    rows = rows.filter((shift) => shift.movements.length === 0);
  }

  return rows;
}

export function normalizeShiftsListLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

export function buildShiftsListPage(
  shifts: ShiftListItem[],
  limit: number
): {
  data: ShiftListItem[];
  hasMore: boolean;
  nextCursor: ShiftListCursor | null;
  total: number | null;
} {
  const pageSize = normalizeShiftsListLimit(limit);
  const hasMore = shifts.length > pageSize;
  const pageRows = hasMore ? shifts.slice(0, pageSize) : shifts;
  const lastRow = pageRows.at(-1);
  const nextCursor =
    hasMore && lastRow
      ? {
          openedAt: lastRow.openedAt,
          id: lastRow.id,
        }
      : null;

  return {
    data: pageRows,
    hasMore,
    nextCursor,
    total: hasMore ? null : pageRows.length,
  };
}

export function buildShiftFilterOptions({
  members,
  organizationMetadata,
  terminalNames,
}: {
  members: Array<{
    userId: string;
    user?: { name?: string | null } | null;
  }>;
  organizationMetadata: string | null | undefined;
  terminalNames: Iterable<string>;
}) {
  const organizationSettings =
    parseOrganizationSettingsMetadata(organizationMetadata);
  const normalizedTerminalNames = [
    ...new Set(
      [...terminalNames].filter(
        (terminalName): terminalName is string =>
          typeof terminalName === "string" && terminalName.trim().length > 0
      )
    ),
  ];

  return {
    cashiers: members
      .map((memberRow) => ({
        id: memberRow.userId,
        name: memberRow.user?.name ?? "Cajero",
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name, "es-CO")),
    terminals: normalizedTerminalNames.toSorted((left, right) =>
      left.localeCompare(right, "es-CO")
    ),
    paymentMethods: getAllPaymentMethods(organizationSettings).map(
      (method) => ({
        id: method.id,
        label: method.label,
      })
    ),
  };
}
