import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useCursorListPagination } from "@/features/listing/hooks/use-cursor-list-pagination";
import { DEFAULT_LIST_LIMIT } from "@/features/listing/listing.constants.shared";
import { buildListRangeLabel } from "@/features/listing/listing-formatters.shared";
import { createPaymentMethodLabelMap } from "@/features/pos/utils";
import { useShiftDetailState } from "@/features/shifts/hooks/use-shift-detail-state";
import {
  useShiftDetail,
  useShiftsList,
} from "@/features/shifts/hooks/use-shifts";
import { useShiftsListParams } from "@/features/shifts/hooks/use-shifts-list-params";
import type {
  ShiftListCursor,
  ShiftListItem,
} from "@/features/shifts/shifts.shared";

interface ShiftsPageFilters {
  cashierId: string;
  differenceStatus: string;
  endDate: string;
  hasMovements: string;
  paymentMethod: string;
  searchQuery: string;
  startDate: string;
  status: string;
  terminalName: string;
}

interface ShiftsPageFilterOptions {
  cashiers: Array<{ id: string; name: string }>;
  paymentMethods: Array<{ id: string; label: string }>;
  terminals: string[];
}

interface ShiftsPageSummary {
  closureDifference: number;
  expectedCash: number;
  expectedPayments: number;
  movements: number;
  openShifts: number;
}

export interface ShiftsPageState {
  activeAdvancedFilterCount: number;
  activeFilterCount: number;
  filterOptions: ShiftsPageFilterOptions;
  filters: ShiftsPageFilters;
  hasMoreResults: boolean;
  isDetailOpen: boolean;
  isMobileFilterOpen: boolean;
  nextCursor: ShiftListCursor | null;
  pageIndex: number;
  pageSize: number;
  rangeLabel: string;
  selectedShiftId: string | null;
  shifts: ShiftListItem[];
  summary: ShiftsPageSummary;
  totalResults: number | null | undefined;
}

export interface ShiftsPageActions {
  applyDesktopFilters: () => void;
  applyMobileFilters: () => void;
  clearFilters: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  openShiftDetail: (shiftId: string) => void;
  setCashierId: (value: string) => void;
  setDetailOpen: (open: boolean) => void;
  setDifferenceStatus: (value: string) => void;
  setEndDate: (value: string) => void;
  setHasMovements: (value: string) => void;
  setMobileFilterOpen: (open: boolean) => void;
  setPageSize: (value: number) => void;
  setPaymentMethod: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setStartDate: (value: string) => void;
  setStatus: (value: string) => void;
  setTerminalName: (value: string) => void;
}

export interface ShiftsPageMeta {
  fieldIds: {
    search: string;
    status: string;
    cashier: string;
    terminal: string;
    paymentMethod: string;
    differenceStatus: string;
    hasMovements: string;
    startDate: string;
    endDate: string;
  };
  paymentMethodLabels: Record<string, string>;
  shiftDetailQuery: ReturnType<typeof useShiftDetail>;
  shiftsQuery: ReturnType<typeof useShiftsList>;
}

export interface ShiftsPageContextValue {
  actions: ShiftsPageActions;
  meta: ShiftsPageMeta;
  state: ShiftsPageState;
}

const ShiftsPageContext = createContext<ShiftsPageContextValue | null>(null);

export function useShiftsPage() {
  const context = use(ShiftsPageContext);
  if (!context) {
    throw new Error("useShiftsPage must be used within ShiftsPageProvider.");
  }
  return context;
}

export function ShiftsPageProvider({ children }: { children: ReactNode }) {
  const searchId = useId();
  const statusId = useId();
  const cashierIdField = useId();
  const terminalIdField = useId();
  const paymentMethodIdField = useId();
  const differenceStatusIdField = useId();
  const hasMovementsIdField = useId();
  const startDateIdField = useId();
  const endDateIdField = useId();

  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [differenceStatus, setDifferenceStatus] = useState("");
  const [hasMovements, setHasMovements] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSizeState] = useState(DEFAULT_LIST_LIMIT);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [shiftDetailState, dispatchShiftDetail] = useShiftDetailState();

  const shiftsFilterKey = useMemo(
    () =>
      JSON.stringify({
        cashierId,
        deferredSearchQuery,
        differenceStatus,
        endDate,
        hasMovements,
        pageSize,
        paymentMethod,
        startDate,
        status,
        terminalName,
      }),
    [
      cashierId,
      deferredSearchQuery,
      differenceStatus,
      endDate,
      hasMovements,
      pageSize,
      paymentMethod,
      startDate,
      status,
      terminalName,
    ]
  );

  const {
    goToNextPage: goToNextPageWithCursor,
    goToPreviousPage,
    listCursor,
    pageIndex,
    resetPagination,
  } = useCursorListPagination<ShiftListCursor>(shiftsFilterKey);

  const listParams = useShiftsListParams({
    cashierId,
    cursor: listCursor,
    deferredSearchQuery,
    differenceStatus,
    endDate,
    hasMovements,
    pageSize,
    paymentMethod,
    startDate,
    status,
    terminalName,
  });

  const shiftsQuery = useShiftsList(listParams);
  const shifts = shiftsQuery.data?.data ?? [];
  const filterOptions = shiftsQuery.data?.filterOptions ?? {
    cashiers: [],
    terminals: [],
    paymentMethods: [],
  };
  const totalResults = shiftsQuery.data?.total;
  const hasMoreResults = shiftsQuery.data?.hasMore ?? false;
  const nextCursor = shiftsQuery.data?.nextCursor ?? null;

  const { isOpen: isDetailOpen, selectedShiftId } = shiftDetailState;
  const shiftDetailQuery = useShiftDetail(
    isDetailOpen ? selectedShiftId : null
  );

  useEffect(() => {
    dispatchShiftDetail({
      type: "sync",
      fallbackShiftId: shifts[0]?.id ?? null,
      shiftIds: new Set(shifts.map((s) => s.id)),
    });
  }, [shifts, dispatchShiftDetail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shiftIdParam = params.get("shiftId");
    if (shiftIdParam) {
      dispatchShiftDetail({ type: "open", shiftId: shiftIdParam });
      params.delete("shiftId");
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [dispatchShiftDetail]);

  const summary = useMemo(
    () =>
      shifts.reduce(
        (accumulator, shift) => {
          accumulator.expectedCash += shift.totals.expectedCash;
          accumulator.expectedPayments += shift.totals.totalPayments;
          accumulator.closureDifference += shift.totals.totalDifference;
          accumulator.movements += shift.movements.length;
          if (shift.status === "open") {
            accumulator.openShifts += 1;
          }
          return accumulator;
        },
        {
          expectedCash: 0,
          expectedPayments: 0,
          closureDifference: 0,
          movements: 0,
          openShifts: 0,
        }
      ),
    [shifts]
  );

  const paymentMethodLabels = useMemo(
    () => createPaymentMethodLabelMap(filterOptions.paymentMethods),
    [filterOptions.paymentMethods]
  );

  const activeFilterCount = [
    searchQuery,
    status,
    cashierId,
    terminalName,
    paymentMethod,
    differenceStatus,
    hasMovements,
    startDate,
    endDate,
  ].filter(Boolean).length;

  const activeAdvancedFilterCount = [
    cashierId,
    terminalName,
    paymentMethod,
    differenceStatus,
    hasMovements,
    startDate,
    endDate,
  ].filter(Boolean).length;

  const rangeLabel = buildListRangeLabel({
    hasMoreResults,
    itemCount: shifts.length,
    pageIndex,
    pageSize,
    totalResults,
  });

  const clearFilters = useCallback(() => {
    setIsMobileFilterOpen(false);
    setSearchQuery("");
    setStatus("");
    setCashierId("");
    setTerminalName("");
    setPaymentMethod("");
    setDifferenceStatus("");
    setHasMovements("");
    setStartDate("");
    setEndDate("");
    resetPagination();
  }, [resetPagination]);

  const setPageSize = useCallback(
    (value: number) => {
      setPageSizeState(value);
      resetPagination();
    },
    [resetPagination]
  );

  const applyMobileFilters = useCallback(() => {
    setIsMobileFilterOpen(false);
    resetPagination();
  }, [resetPagination]);

  const applyDesktopFilters = useCallback(() => {
    resetPagination();
  }, [resetPagination]);

  const goToNextPage = useCallback(() => {
    if (nextCursor !== null) {
      goToNextPageWithCursor(nextCursor);
    }
  }, [goToNextPageWithCursor, nextCursor]);

  const openShiftDetail = useCallback(
    (shiftId: string) => {
      dispatchShiftDetail({ type: "open", shiftId });
    },
    [dispatchShiftDetail]
  );

  const setDetailOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        dispatchShiftDetail({ type: "close" });
      }
    },
    [dispatchShiftDetail]
  );

  const value = useMemo<ShiftsPageContextValue>(
    () => ({
      state: {
        filters: {
          searchQuery,
          status,
          cashierId,
          terminalName,
          paymentMethod,
          differenceStatus,
          hasMovements,
          startDate,
          endDate,
        },
        filterOptions,
        shifts,
        summary,
        totalResults,
        hasMoreResults,
        nextCursor,
        pageIndex,
        pageSize,
        rangeLabel,
        activeFilterCount,
        activeAdvancedFilterCount,
        isMobileFilterOpen,
        isDetailOpen,
        selectedShiftId,
      },
      actions: {
        setSearchQuery,
        setStatus,
        setCashierId,
        setTerminalName,
        setPaymentMethod,
        setDifferenceStatus,
        setHasMovements,
        setStartDate,
        setEndDate,
        setPageSize,
        setMobileFilterOpen: setIsMobileFilterOpen,
        clearFilters,
        applyMobileFilters,
        applyDesktopFilters,
        goToPreviousPage,
        goToNextPage,
        openShiftDetail,
        setDetailOpen,
      },
      meta: {
        paymentMethodLabels,
        fieldIds: {
          search: searchId,
          status: statusId,
          cashier: cashierIdField,
          terminal: terminalIdField,
          paymentMethod: paymentMethodIdField,
          differenceStatus: differenceStatusIdField,
          hasMovements: hasMovementsIdField,
          startDate: startDateIdField,
          endDate: endDateIdField,
        },
        shiftDetailQuery,
        shiftsQuery,
      },
    }),
    [
      searchQuery,
      status,
      cashierId,
      terminalName,
      paymentMethod,
      differenceStatus,
      hasMovements,
      startDate,
      endDate,
      filterOptions,
      shifts,
      summary,
      totalResults,
      hasMoreResults,
      nextCursor,
      pageIndex,
      pageSize,
      rangeLabel,
      activeFilterCount,
      activeAdvancedFilterCount,
      isMobileFilterOpen,
      isDetailOpen,
      selectedShiftId,
      setPageSize,
      clearFilters,
      applyMobileFilters,
      applyDesktopFilters,
      goToPreviousPage,
      goToNextPage,
      paymentMethodLabels,
      searchId,
      statusId,
      cashierIdField,
      terminalIdField,
      paymentMethodIdField,
      differenceStatusIdField,
      hasMovementsIdField,
      startDateIdField,
      endDateIdField,
      shiftDetailQuery,
      shiftsQuery,
      openShiftDetail,
      setDetailOpen,
    ]
  );

  return <ShiftsPageContext value={value}>{children}</ShiftsPageContext>;
}
