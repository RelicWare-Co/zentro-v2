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
  useTransition,
} from "react";
import { useCursorListPagination } from "@/features/listing/hooks/use-cursor-list-pagination";
import { DEFAULT_LIST_LIMIT } from "@/features/listing/listing.constants.shared";
import { buildListRangeLabel } from "@/features/listing/listing-formatters.shared";
import { useSaleDetailState } from "@/features/sales/hooks/use-sale-detail-state";
import {
  useCancelSaleMutation,
  useSaleDetail,
  useSalesList,
} from "@/features/sales/hooks/use-sales";
import { useSalesListParams } from "@/features/sales/hooks/use-sales-list-params";
import { useSalesViewSummary } from "@/features/sales/hooks/use-sales-view-summary";
import type {
  SaleListCursor,
  SaleListItem,
} from "@/features/sales/sales.shared";
import {
  getCurrentSalesDateFilterValue,
  salesDayFormatter,
} from "@/features/sales/sales-formatters.shared";
import {
  DEFAULT_SALES_VIEW,
  type SalesView,
} from "@/features/sales/sales-page.constants.shared";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";

interface SalesPageFilters {
  amountMax: string;
  amountMin: string;
  balanceStatus: string;
  cashierId: string;
  endDate: string;
  paymentMethod: string;
  searchQuery: string;
  startDate: string;
  status: string;
  terminalName: string;
}

interface SalesPageFilterOptions {
  cashiers: Array<{ id: string; name: string | null }>;
  paymentMethods: Array<{ id: string; label: string }>;
  terminals: string[];
}

interface SalesPageViewSummary {
  description: string;
  emptyTitle: string;
  kicker: string;
  listDescription: string;
  listTitle: string;
  pendingDescription: string;
  pendingTitle: string;
  resultsDescription: string;
  resultsTitle: string;
  revenueDescription: string;
  revenueTitle: string;
  title: string;
}

export interface SalesPageState {
  activeAdvancedFilterCount: number;
  activeFilterCount: number;
  activeView: SalesView;
  filterOptions: SalesPageFilterOptions;
  filters: SalesPageFilters;
  hasMoreResults: boolean;
  isCancelDialogOpen: boolean;
  isCancelling: boolean;
  isDetailOpen: boolean;
  isMobileFilterOpen: boolean;
  isRefreshing: boolean;
  nextCursor: import("@/features/sales/sales.shared").SaleListCursor | null;
  pageIndex: number;
  pageSize: number;
  rangeLabel: string;
  sales: SaleListItem[];
  selectedSaleId: string | null;
  selectedSaleSummary: SaleListItem | null;
  totalPending: number;
  totalResults: number | null | undefined;
  totalRevenue: number;
  viewSummary: SalesPageViewSummary;
}

export interface SalesPageActions {
  clearFilters: () => void;
  confirmCancelSale: () => Promise<void>;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  openSaleDetail: (saleId: string) => void;
  requestCancelSale: () => void;
  setActiveView: (view: SalesView) => void;
  setAmountMax: (value: string) => void;
  setAmountMin: (value: string) => void;
  setBalanceStatus: (value: string) => void;
  setCancelDialogOpen: (open: boolean) => void;
  setCashierId: (value: string) => void;
  setDetailOpen: (open: boolean) => void;
  setEndDate: (value: string) => void;
  setMobileFilterOpen: (open: boolean) => void;
  setPageSize: (value: number) => void;
  setPaymentMethod: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setStartDate: (value: string) => void;
  setStatus: (value: string) => void;
  setTerminalName: (value: string) => void;
}

export interface SalesPageMeta {
  activeShiftId?: string;
  fieldIds: {
    search: string;
    status: string;
    paymentMethod: string;
    cashier: string;
    terminal: string;
    balanceStatus: string;
    amountMin: string;
    amountMax: string;
    startDate: string;
    endDate: string;
  };
  isTodayView: boolean;
  paymentMethodLabels: Record<string, string>;
  saleDetailQuery: ReturnType<typeof useSaleDetail>;
  todayDate: string;
  todayLabel: string;
}

export interface SalesPageContextValue {
  actions: SalesPageActions;
  meta: SalesPageMeta;
  state: SalesPageState;
}

const SalesPageContext = createContext<SalesPageContextValue | null>(null);

export function useSalesPage() {
  const context = use(SalesPageContext);
  if (!context) {
    throw new Error("useSalesPage must be used within SalesPageProvider.");
  }
  return context;
}

export function SalesPageProvider({ children }: { children: ReactNode }) {
  const searchId = useId();
  const statusId = useId();
  const paymentMethodId = useId();
  const cashierIdField = useId();
  const terminalId = useId();
  const balanceStatusId = useId();
  const amountMinId = useId();
  const amountMaxId = useId();
  const startDateId = useId();
  const endDateId = useId();

  const [activeView, setActiveViewState] =
    useState<SalesView>(DEFAULT_SALES_VIEW);
  const isTodayView = activeView === "today";
  const todayDate = getCurrentSalesDateFilterValue();

  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [terminalName, setTerminalName] = useState("");
  const [balanceStatus, setBalanceStatus] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageSize, setPageSizeState] = useState(DEFAULT_LIST_LIMIT);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const salesFilterKey = useMemo(
    () =>
      JSON.stringify({
        activeView,
        amountMax,
        amountMin,
        balanceStatus,
        cashierId,
        deferredSearchQuery,
        endDate,
        pageSize,
        paymentMethod,
        startDate,
        status,
        terminalName,
        todayDate,
      }),
    [
      activeView,
      amountMax,
      amountMin,
      balanceStatus,
      cashierId,
      deferredSearchQuery,
      endDate,
      pageSize,
      paymentMethod,
      startDate,
      status,
      terminalName,
      todayDate,
    ]
  );

  const {
    goToNextPage: goToNextPageWithCursor,
    goToPreviousPage,
    listCursor,
    pageIndex,
    resetPagination,
  } = useCursorListPagination<SaleListCursor>(salesFilterKey);

  const listParams = useSalesListParams({
    activeView,
    amountMax,
    amountMin,
    balanceStatus,
    cashierId,
    cursor: listCursor,
    deferredSearchQuery,
    endDate,
    pageSize,
    paymentMethod,
    startDate,
    status,
    terminalName,
    todayDate,
  });

  const [isViewPending, startViewTransition] = useTransition();
  const [saleDetailState, dispatchSaleDetail] = useSaleDetailState();
  const { isOpen: isDetailOpen, selectedSaleId } = saleDetailState;
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const salesQuery = useSalesList(listParams);
  const sales = salesQuery.data?.data ?? [];
  const filterOptions = salesQuery.data?.filterOptions ?? {
    cashiers: [],
    terminals: [],
    paymentMethods: [],
  };
  const totalResults = salesQuery.data?.total;
  const hasMoreResults = salesQuery.data?.hasMore ?? false;
  const nextCursor = salesQuery.data?.nextCursor ?? null;

  const saleDetailQuery = useSaleDetail(isDetailOpen ? selectedSaleId : null);
  const activeShiftQuery = useActiveShift();
  const activeShiftId = activeShiftQuery.data?.shift?.id;
  const cancelSaleMutation = useCancelSaleMutation();

  useEffect(() => {
    dispatchSaleDetail({
      type: "sync",
      fallbackSaleId: sales[0]?.id ?? null,
      saleIds: new Set(sales.map((sale) => sale.id)),
    });
  }, [sales, dispatchSaleDetail]);

  const selectedSaleSummary = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId]
  );

  const totalRevenue = sales.reduce(
    (total, sale) =>
      sale.status === "cancelled" ? total : total + sale.totalAmount,
    0
  );
  const totalPending = sales.reduce(
    (total, sale) =>
      sale.status === "cancelled" ? total : total + sale.balanceDue,
    0
  );

  const rangeLabel = buildListRangeLabel({
    hasMoreResults,
    itemCount: sales.length,
    pageIndex,
    pageSize,
    totalResults,
  });

  const activeFilterCount = [
    searchQuery,
    status,
    paymentMethod,
    cashierId,
    terminalName,
    balanceStatus,
    amountMin,
    amountMax,
    ...(isTodayView ? [] : [startDate, endDate]),
  ].filter(Boolean).length;

  const activeAdvancedFilterCount = [
    paymentMethod,
    cashierId,
    terminalName,
    balanceStatus,
    amountMin,
    amountMax,
    ...(isTodayView ? [] : [startDate, endDate]),
  ].filter(Boolean).length;

  const isRefreshing = isViewPending || salesQuery.isFetching;
  const todayLabel = salesDayFormatter.format(
    new Date(`${todayDate}T00:00:00`)
  );
  const viewSummary = useSalesViewSummary(
    isTodayView,
    todayLabel,
    activeFilterCount
  );

  const paymentMethodLabels = useMemo(
    () =>
      Object.fromEntries(
        filterOptions.paymentMethods.map((method) => [method.id, method.label])
      ),
    [filterOptions.paymentMethods]
  );

  const clearFilters = useCallback(() => {
    setIsMobileFilterOpen(false);
    setSearchQuery("");
    setStatus("");
    setPaymentMethod("");
    setCashierId("");
    setTerminalName("");
    setBalanceStatus("");
    setAmountMin("");
    setAmountMax("");
    setStartDate("");
    setEndDate("");
    resetPagination();
  }, [resetPagination]);

  const setActiveView = useCallback(
    (nextView: SalesView) => {
      if (nextView === activeView) {
        return;
      }
      startViewTransition(() => {
        setActiveViewState(nextView);
        resetPagination();
      });
    },
    [activeView, resetPagination]
  );

  const setPageSize = useCallback(
    (value: number) => {
      setPageSizeState(value);
      resetPagination();
    },
    [resetPagination]
  );

  const openSaleDetail = useCallback(
    (saleId: string) => {
      dispatchSaleDetail({ type: "open", saleId });
    },
    [dispatchSaleDetail]
  );

  const setDetailOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        dispatchSaleDetail({ type: "close" });
      }
    },
    [dispatchSaleDetail]
  );

  const requestCancelSale = useCallback(() => {
    setIsCancelDialogOpen(true);
  }, []);

  const confirmCancelSale = useCallback(async () => {
    if (!selectedSaleId) {
      return;
    }
    await cancelSaleMutation.mutateAsync({ saleId: selectedSaleId });
    setIsCancelDialogOpen(false);
    dispatchSaleDetail({ type: "close" });
  }, [cancelSaleMutation, dispatchSaleDetail, selectedSaleId]);

  const goToNextPage = useCallback(() => {
    if (nextCursor !== null) {
      goToNextPageWithCursor(nextCursor);
    }
  }, [goToNextPageWithCursor, nextCursor]);

  const value = useMemo<SalesPageContextValue>(
    () => ({
      state: {
        activeView,
        filters: {
          searchQuery,
          status,
          paymentMethod,
          cashierId,
          terminalName,
          balanceStatus,
          amountMin,
          amountMax,
          startDate,
          endDate,
        },
        filterOptions,
        sales,
        totalResults,
        hasMoreResults,
        nextCursor,
        pageIndex,
        pageSize,
        rangeLabel,
        totalRevenue,
        totalPending,
        activeFilterCount,
        activeAdvancedFilterCount,
        isDetailOpen,
        selectedSaleId,
        selectedSaleSummary,
        isMobileFilterOpen,
        isCancelDialogOpen,
        isCancelling: cancelSaleMutation.isPending,
        isRefreshing,
        viewSummary,
      },
      actions: {
        setActiveView,
        setSearchQuery,
        setStatus,
        setPaymentMethod,
        setCashierId,
        setTerminalName,
        setBalanceStatus,
        setAmountMin,
        setAmountMax,
        setStartDate,
        setEndDate,
        setPageSize,
        setMobileFilterOpen: setIsMobileFilterOpen,
        setCancelDialogOpen: setIsCancelDialogOpen,
        clearFilters,
        openSaleDetail,
        setDetailOpen,
        requestCancelSale,
        confirmCancelSale,
        goToPreviousPage,
        goToNextPage,
      },
      meta: {
        isTodayView,
        todayDate,
        todayLabel,
        paymentMethodLabels,
        fieldIds: {
          search: searchId,
          status: statusId,
          paymentMethod: paymentMethodId,
          cashier: cashierIdField,
          terminal: terminalId,
          balanceStatus: balanceStatusId,
          amountMin: amountMinId,
          amountMax: amountMaxId,
          startDate: startDateId,
          endDate: endDateId,
        },
        activeShiftId,
        saleDetailQuery,
      },
    }),
    [
      activeView,
      searchQuery,
      status,
      paymentMethod,
      cashierId,
      terminalName,
      balanceStatus,
      amountMin,
      amountMax,
      startDate,
      endDate,
      filterOptions,
      sales,
      totalResults,
      hasMoreResults,
      nextCursor,
      pageIndex,
      pageSize,
      rangeLabel,
      totalRevenue,
      totalPending,
      activeFilterCount,
      activeAdvancedFilterCount,
      isDetailOpen,
      selectedSaleId,
      selectedSaleSummary,
      isMobileFilterOpen,
      isCancelDialogOpen,
      cancelSaleMutation.isPending,
      isRefreshing,
      viewSummary,
      setActiveView,
      setPageSize,
      clearFilters,
      openSaleDetail,
      setDetailOpen,
      requestCancelSale,
      confirmCancelSale,
      goToPreviousPage,
      goToNextPage,
      isTodayView,
      todayDate,
      todayLabel,
      paymentMethodLabels,
      searchId,
      statusId,
      paymentMethodId,
      cashierIdField,
      terminalId,
      balanceStatusId,
      amountMinId,
      amountMaxId,
      startDateId,
      endDateId,
      activeShiftId,
      saleDetailQuery,
    ]
  );

  return <SalesPageContext value={value}>{children}</SalesPageContext>;
}
