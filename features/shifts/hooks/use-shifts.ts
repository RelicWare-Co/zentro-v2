import { useZero, useQuery as useZeroQuery } from "@rocicorp/zero/react";
import { useMutation } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useRef } from "react";
import type { z } from "zod";
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
  filterShifts,
  paginateShifts,
} from "@/features/shifts/shifts.shared";
import type {
  CloseShiftInputSchema,
  OpenShiftInputSchema,
  RegisterCashMovementInputSchema,
} from "@/schemas/pos";
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

type ZeroMutationDetails =
  | { readonly type: "success" }
  | {
      readonly error: { readonly message: string };
      readonly type: "error";
    };

interface ZeroMutationResult {
  readonly client: Promise<ZeroMutationDetails>;
  readonly server: Promise<ZeroMutationDetails>;
}

function toError(details: Extract<ZeroMutationDetails, { type: "error" }>) {
  return new Error(details.error.message || "La mutación de Zero falló");
}

async function waitForZeroMutation(result: ZeroMutationResult) {
  const clientResult = await result.client;
  if (clientResult.type === "error") {
    throw toError(clientResult);
  }

  const serverResult = await result.server;
  if (serverResult.type === "error") {
    throw toError(serverResult);
  }
}

function getQueryError(status: { type: string; error?: { message?: string } }) {
  return status.type === "error"
    ? new Error(status.error?.message ?? "No se pudo cargar la consulta Zero")
    : null;
}

function normalizeShiftRows(rows: readonly ShiftWithRelations[]) {
  return rows.map((shift) => buildShiftListItem(shift));
}

export function useActiveShift() {
  const [rows, status] = useZeroQuery(queries.shifts.active());
  const error = getQueryError(status);
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
  const [shiftRows, shiftStatus] = useZeroQuery(queries.shifts.byOrg());
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.shifts.organization()
  );
  const error = getQueryError(shiftStatus) ?? getQueryError(organizationStatus);
  const normalizedShifts = useMemo(
    () => normalizeShiftRows(shiftRows as ShiftWithRelations[]),
    [shiftRows]
  );
  const filteredShifts = useMemo(
    () => filterShifts(normalizedShifts, deferredParams),
    [deferredParams, normalizedShifts]
  );
  const paginated = useMemo(
    () => paginateShifts(filteredShifts, deferredParams),
    [deferredParams, filteredShifts]
  );
  const filterOptions = useMemo(
    () =>
      buildShiftFilterOptions(
        normalizedShifts,
        typeof organizationRows[0]?.metadata === "string"
          ? organizationRows[0]?.metadata
          : null
      ),
    [normalizedShifts, organizationRows]
  );

  const hasLoadedRef = useRef(false);
  const staleDataRef = useRef<{
    data: ShiftListItem[];
    total: number;
    hasMore: boolean;
    nextCursor: number | null;
    filterOptions: ReturnType<typeof buildShiftFilterOptions>;
  }>({
    data: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    filterOptions: {
      cashiers: [],
      terminals: [],
      paymentMethods: [],
    },
  });

  const isQueryLoading =
    (shiftStatus.type === "unknown" || organizationStatus.type === "unknown") &&
    normalizedShifts.length === 0;

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
    refetch: () => {
      if (shiftStatus.type === "error") {
        shiftStatus.retry();
      }
      if (organizationStatus.type === "error") {
        organizationStatus.retry();
      }
      return Promise.resolve();
    },
  };
}

function asShiftWithRelations(row: unknown) {
  return row as ShiftWithRelations;
}

export function useShiftDetail(shiftId: string | null) {
  const [rows, status] = useZeroQuery(
    queries.shifts.byId({ shiftId: shiftId ?? "" })
  );
  const error = getQueryError(status);
  const shiftRow = rows[0];
  const shift = shiftRow
    ? buildShiftListItem(asShiftWithRelations(shiftRow))
    : null;

  return {
    data: shift,
    error,
    isError: Boolean(error),
    isLoading: Boolean(shiftId) && status.type === "unknown" && !rows,
    refetch: () => {
      if (status.type === "error") {
        status.retry();
      }
      return Promise.resolve();
    },
  };
}

export function useShiftCloseSummary(
  shiftId: string | undefined,
  enabled: boolean
) {
  const [rows, status] = useZeroQuery(
    queries.shifts.byId({ shiftId: shiftId ?? "" })
  );
  const [organizationRows, organizationStatus] = useZeroQuery(
    queries.shifts.organization()
  );
  const error = getQueryError(status) ?? getQueryError(organizationStatus);
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
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: OpenShiftInput) => {
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
    },
  });
}

export function useRegisterCashMovementMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: RegisterCashMovementInput) => {
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
    },
  });
}

export function useCloseShiftMutation() {
  const zero = useZero();

  return useMutation({
    mutationFn: async (input: CloseShiftInput) => {
      await waitForZeroMutation(zero.mutate(mutators.shifts.close(input)));
      return {
        shiftId: input.shiftId,
        closedAt: input.closedAt ?? Date.now(),
      };
    },
  });
}
