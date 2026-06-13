import { useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
import type {
  CloseShiftInputSchema,
  OpenShiftInputSchema,
  RegisterCashMovementInputSchema,
} from "@/features/pos/pos.schema";
import type {
  ShiftCloseSummary,
  ShiftListItem,
  ShiftsListParams,
  ShiftWithRelations,
} from "@/features/shifts/shifts.shared";
import {
  buildShiftCloseSummary,
  buildShiftFilterOptions,
  buildShiftListItem,
  buildShiftsListPage,
  filterShiftsClientRefinements,
  normalizeShiftsListLimit,
} from "@/features/shifts/shifts.shared";
import {
  getZeroQueryError,
  useZeroMutation,
  waitForZeroMutation,
} from "@/lib/use-zero-mutation";
import { mutators } from "@/src/zero/mutators";
import { queries } from "@/src/zero/queries";

export type {
  ShiftListItem,
  ShiftsListParams,
} from "@/features/shifts/shifts.shared";

export type OpenShiftInput = z.infer<typeof OpenShiftInputSchema>;
export type CloseShiftInput = z.infer<typeof CloseShiftInputSchema>;
export type RegisterCashMovementInput = z.infer<
  typeof RegisterCashMovementInputSchema
>;

function buildShiftsListQueryArgs(params: ShiftsListParams) {
  return {
    limit: normalizeShiftsListLimit(params.limit),
    cursor: params.cursor ?? null,
    searchQuery: params.searchQuery ?? null,
    status: params.status ?? null,
    cashierId: params.cashierId ?? null,
    terminalName: params.terminalName ?? null,
    paymentMethod: params.paymentMethod ?? null,
    hasMovements: params.hasMovements === "yes" ? params.hasMovements : null,
    startDate: params.startDate ?? null,
    endDate: params.endDate ?? null,
  };
}

export function useActiveShift() {
  const [rows, status] = useZeroQuery(queries.shifts.active());
  const error = getZeroQueryError(status);
  const activeShift = rows[0] ?? null;

  return {
    data: {
      shift: activeShift
        ? {
            id: activeShift.id,
            terminalId: activeShift.terminalId ?? null,
            terminalName: activeShift.terminalName ?? null,
            status: activeShift.status ?? "open",
            startingCash: activeShift.startingCash ?? 0,
            openedAt: activeShift.openedAt,
            closedAt: activeShift.closedAt ?? null,
            notes: activeShift.notes ?? null,
          }
        : null,
    },
    error,
    isError: Boolean(error),
    isLoading: status.type === "unknown" && rows.length === 0,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useShiftsList(params: ShiftsListParams = {}) {
  const deferredParams = useDeferredValue(params);
  const listQueryArgs = useMemo(
    () => buildShiftsListQueryArgs(deferredParams),
    [deferredParams]
  );
  const [shiftRows, shiftStatus] = useZeroQuery(
    queries.shifts.list(listQueryArgs)
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );
  const [memberRows, memberStatus] = useZeroQuery(
    queries.sales.filterOptions()
  );
  const [terminalRows, terminalStatus] = useZeroQuery(
    queries.sales.terminalOptions()
  );
  const error =
    getZeroQueryError(shiftStatus) ??
    getZeroQueryError(organizationStatus) ??
    getZeroQueryError(memberStatus) ??
    getZeroQueryError(terminalStatus);

  const refinedShifts = useMemo(() => {
    const listItems = (shiftRows as ShiftWithRelations[]).map((shiftRow) =>
      buildShiftListItem(shiftRow)
    );
    return filterShiftsClientRefinements(listItems, deferredParams);
  }, [deferredParams, shiftRows]);

  const paginated = useMemo(
    () => buildShiftsListPage(refinedShifts, listQueryArgs.limit),
    [listQueryArgs.limit, refinedShifts]
  );

  const filterOptions = useMemo(
    () =>
      buildShiftFilterOptions({
        members: memberRows.map((memberRow) => ({
          userId: memberRow.userId,
          user: (
            memberRow as {
              user?: { name?: string | null } | null;
            }
          ).user,
        })),
        organizationMetadata:
          typeof organizationRows[0]?.metadata === "string"
            ? organizationRows[0]?.metadata
            : null,
        terminalNames: terminalRows
          .map((shiftRow) => shiftRow.terminalName)
          .filter((terminalName): terminalName is string =>
            Boolean(terminalName)
          ),
      }),
    [memberRows, organizationRows, terminalRows]
  );

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<{
    data: ShiftListItem[];
    total: number | null;
    hasMore: boolean;
    nextCursor: (typeof paginated)["nextCursor"];
    filterOptions: ReturnType<typeof buildShiftFilterOptions>;
  }>({
    data: [],
    total: null,
    hasMore: false,
    nextCursor: null,
    filterOptions: {
      cashiers: [],
      terminals: [],
      paymentMethods: [],
    },
  });

  const isQueryLoading =
    (shiftStatus.type === "unknown" ||
      organizationStatus.type === "unknown" ||
      memberStatus.type === "unknown" ||
      terminalStatus.type === "unknown") &&
    shiftRows.length === 0;

  const nextData = {
    ...paginated,
    filterOptions,
  };

  if (!isQueryLoading) {
    staleDataRef.current = nextData;
    hasLoadedRef.current = true;
  }

  const displayData = isQueryLoading ? staleDataRef.current : nextData;

  return {
    data: displayData,
    error,
    isError: Boolean(error),
    isLoading: isQueryLoading && !hasLoadedRef.current,
    isPlaceholderData:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    isFetching:
      deferredParams !== params || (isQueryLoading && hasLoadedRef.current),
    refetch: () => {
      if (shiftStatus.type === "error") {
        shiftStatus.retry();
      }
      if (organizationStatus.type === "error") {
        organizationStatus.retry();
      }
      if (memberStatus.type === "error") {
        memberStatus.retry();
      }
      if (terminalStatus.type === "error") {
        terminalStatus.retry();
      }
      return Promise.resolve();
    },
  };
}

function asShiftWithRelations(row: unknown) {
  return row as ShiftWithRelations;
}

export function useShiftCloseSummary(
  shiftId: string | undefined,
  enabled: boolean
) {
  const [rows, status] = useZeroQuery(
    queries.shifts.byId({ shiftId: shiftId ?? null })
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.organization.current()
  );
  const error =
    getZeroQueryError(status) ?? getZeroQueryError(organizationStatus);
  const summary = useMemo<ShiftCloseSummary | undefined>(() => {
    const shiftRow = rows[0];
    if (!(enabled && shiftId && shiftRow)) {
      return;
    }
    return buildShiftCloseSummary(
      asShiftWithRelations(shiftRow),
      typeof organizationRows[0]?.metadata === "string"
        ? organizationRows[0]?.metadata
        : null
    );
  }, [enabled, organizationRows, rows, shiftId]);

  return {
    data: summary,
    error,
    isError: Boolean(error),
    isFetching:
      enabled &&
      Boolean(shiftId) &&
      (status.type === "unknown" || organizationStatus.type === "unknown"),
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      if (organizationStatus.type === "error") {
        organizationStatus.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useOpenShiftMutation() {
  return useZeroMutation(async (input: OpenShiftInput, zero) => {
    const id = crypto.randomUUID();
    await waitForZeroMutation(
      zero.mutate(
        mutators.shifts.open({
          ...input,
          id,
        })
      )
    );
    return {
      id,
      status: "open" as const,
      startingCash: input.startingCash,
      openedAt: input.openedAt ?? Date.now(),
    };
  });
}

export function useRegisterCashMovementMutation() {
  return useZeroMutation(async (input: RegisterCashMovementInput, zero) => {
    const id = crypto.randomUUID();
    await waitForZeroMutation(
      zero.mutate(
        mutators.shifts.cashMovement({
          ...input,
          id,
        })
      )
    );
    return {
      id,
      shiftId: input.shiftId,
      type: input.type,
      paymentMethod: input.paymentMethod,
      amount: input.amount,
      description: input.description,
      createdAt: input.createdAt ?? Date.now(),
    };
  });
}

export function useCloseShiftMutation() {
  return useZeroMutation(async (input: CloseShiftInput, zero) => {
    await waitForZeroMutation(zero.mutate(mutators.shifts.close(input)));
    return {
      shiftId: input.shiftId,
      closedAt: input.closedAt ?? Date.now(),
    };
  });
}
