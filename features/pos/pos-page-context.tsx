import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useCreditAccountsSearch } from "@/features/credit/hooks/use-credit";
import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { usePosSaleModeAdapters } from "@/features/modules/hooks/use-pos-sale-mode-adapters";
import { useCreateCustomerModal } from "@/features/pos/hooks/use-create-customer-modal";
import { useModifierModal } from "@/features/pos/hooks/use-modifier-modal";
import {
  usePosCategories,
  usePosModifierProducts,
  usePosProducts,
  usePosSettings,
  useToggleProductFavoriteMutation,
} from "@/features/pos/hooks/use-pos-catalog";
import { buildSalePaymentsFromInputs } from "@/features/pos/hooks/use-pos-checkout";
import { usePosCustomers } from "@/features/pos/hooks/use-pos-queries";
import { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import type { PosActiveModal } from "@/features/pos/pos-page-modals.shared";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { printSaleReceipt } from "@/features/pos/printing/print-sale-receipt.client";
import type {
  PosPaymentMethodOption,
  PosTableSessionState,
  SaleFinalizeOptions,
  SaleModeAdapter,
  SaleReceiptPayload,
} from "@/features/pos/sale-modes/types";
import type {
  ActiveShift,
  CartItem,
  CartItemModifier,
  CartTotals,
  Category,
  PaymentMethod,
  PosCustomer,
  Product,
} from "@/features/pos/types";
import {
  buildPosV2BarcodeScanPayload,
  findProductByBarcodeScan,
} from "@/features/posv2/posv2-barcode.shared";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";
import { useActiveOrganization } from "@/lib/auth-client";

export type PosPageVariant = "v1" | "v2";
export type { PosTableSessionState } from "@/features/pos/sale-modes/types";

export type PaymentMethodOption = PosPaymentMethodOption;

export interface PosPageState {
  activeCategoryId: string;
  activeModal: PosActiveModal | null;
  activeShift: ActiveShift | null;
  canFinalizeSale: boolean;
  canReturnCashChange: boolean;
  cart: CartItem[];
  cashChangeDue: number;
  categories: Category[];
  checkoutError: Error | null;
  customers: PosCustomer[];
  deliveryInfo: string;
  discountInput: string;
  hasNextPage: boolean;
  hasPaymentDifference: boolean;
  isActiveShift: boolean;
  isActiveShiftLoading: boolean;
  isBootstrapLoading: boolean;
  isCreditSale: boolean;
  isFetchingNextPage: boolean;
  isMobileCartOpen: boolean;
  isProcessingCheckout: boolean;
  isProductsLoading: boolean;
  isQuickSaleMode: boolean;
  modifierProducts: Product[];
  modifierQuantities: Record<string, number>;
  paymentDifference: number;
  payments: PaymentMethod[];
  products: Product[];
  projectedCreditBalance: number;
  remainingCreditAmount: number;
  searchQuery: string;
  selectedCustomerCreditAccount: { balance: number } | null;
  selectedCustomerId: string;
  selectedProductForModifiers: Product | null;
  shouldCreateCreditBalance: boolean;
  tableSession: PosTableSessionState | null;
  totalItems: number;
  totalPaid: number;
  totals: CartTotals;
  viewMode: "grid" | "list";
}

export interface PosPageActions {
  addPaymentMethod: () => void;
  addToCart: SaleModeAdapter["addToCart"];
  clearCart: () => void;
  closeActiveModal: () => void;
  confirmCashMovement: () => void;
  confirmCloseShift: () => void;
  confirmCreateCustomer: () => void;
  confirmModifiers: () => void;
  confirmOpenShift: () => void;
  enterTableMode: (tableId: string) => void;
  exitTableMode: () => void;
  fetchNextProductsPage: () => void;
  finalizeSale: () => void;
  getProductQuantity: (productId: string) => number;
  handleBarcodeScanV1: (value: string) => boolean;
  handleBarcodeScanV2: (event: KeyboardBarcodeScannerEvent) => boolean;
  handleProductSelect: (product: Product) => void;
  handleQuickSale: () => void;
  openActiveModal: (modal: PosActiveModal) => void;
  openCashMovementModal: () => void;
  openCheckout: () => void;
  openCheckoutDetails: () => void;
  openCloseShiftModal: () => void;
  openCreateCustomerModal: () => void;
  openShiftFromRequired: () => void;
  openShiftModal: () => void;
  quickAddWithoutModifiers: () => void;
  removeFromCart: (cartItemId: string) => void;
  removePaymentMethod: (index: number) => void;
  sendTableOrderToKitchen: () => void;
  setActiveCategoryId: (id: string) => void;
  setDeliveryInfo: (value: string) => void;
  setDiscountInput: (value: string) => void;
  setIsCreditSale: (value: boolean) => void;
  setIsMobileCartOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCustomerId: (id: string) => void;
  setViewMode: (mode: "grid" | "list") => void;
  toggleProductFavorite: (productId: string) => void;
  toggleQuickSaleMode: () => void;
  updateItemDiscount: (cartItemId: string, value: string) => void;
  updateModifierQuantity: (modifierId: string, delta: number) => void;
  updatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
}

export interface PosPageMeta {
  activeOrganizationId: string | null;
  allowCreditSales: boolean;
  createCustomerModal: ReturnType<typeof useCreateCustomerModal>;
  defaultTerminalName: string;
  isTogglingFavorite: boolean;
  paymentMethodOptions: PaymentMethodOption[];
  resolveBarcodeProduct: (lookupValues: string[]) => Product | undefined;
  shift: ReturnType<typeof usePosShift>;
  variant: PosPageVariant;
}

export interface PosPageContextValue {
  actions: PosPageActions;
  meta: PosPageMeta;
  state: PosPageState;
}

const PosPageContext = createContext<PosPageContextValue | null>(null);

export function usePosPage() {
  const context = use(PosPageContext);
  if (!context) {
    throw new Error("usePosPage must be used within PosPageProvider.");
  }
  return context;
}

export function PosPageProvider({
  children,
  variant,
}: {
  children: ReactNode;
  variant: PosPageVariant;
}) {
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<PosActiveModal | null>(null);
  const [isQuickSaleMode, setIsQuickSaleMode] = useState(false);

  const closeActiveModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openActiveModal = useCallback((modal: PosActiveModal) => {
    setActiveModal(modal);
  }, []);

  const toggleQuickSaleMode = useCallback(() => {
    setIsQuickSaleMode((prev) => !prev);
  }, []);

  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;
  const activeOrganizationName = activeOrganization?.name ?? null;

  const { data: settings, isLoading: isSettingsLoading } = usePosSettings();
  const { data: categories, isLoading: isCategoriesLoading } =
    usePosCategories();
  const { data: modifierProducts, isLoading: isModifiersLoading } =
    usePosModifierProducts();
  const isBootstrapLoading =
    isSettingsLoading || isCategoriesLoading || isModifiersLoading;

  const { data: activeShiftData, isLoading: isActiveShiftLoading } =
    useActiveShift();
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isProductsLoading,
  } = usePosProducts(activeCategoryId, searchQuery);
  const { data: customersData } = usePosCustomers();
  const { data: creditAccountsData } = useCreditAccountsSearch("");

  const activeShift = activeShiftData?.shift ?? null;
  const isActiveShift = Boolean(activeShift);
  const paymentMethodOptions = useMemo<PaymentMethodOption[]>(
    () =>
      settings?.paymentMethods.map((method) => ({
        id: method.id,
        label: method.label,
        requiresReference: method.requiresReference,
      })) ?? [],
    [settings?.paymentMethods]
  );
  const allowCreditSales = settings?.allowCreditSales ?? false;
  const defaultTerminalName = settings?.defaultTerminalName ?? "Caja Principal";
  const paymentMethodsForReceipt = settings?.paymentMethods ?? [];

  const products = productsData?.pages.flatMap((page) => page.data) ?? [];
  const customers = customersData?.data ?? [];
  const creditAccounts = creditAccountsData?.data ?? [];

  const resetDeliveryInfo = useCallback(() => {
    setDeliveryInfo("");
  }, []);

  const printReceiptForSale = useCallback(
    async (payload: SaleReceiptPayload) => {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      await printSaleReceipt({
        activeOrganizationId,
        activeOrganizationName,
        customer,
        defaultTerminalName,
        paymentMethods: paymentMethodsForReceipt,
        result: payload.result,
        snapshot: payload.snapshot,
      });
    },
    [
      customers,
      selectedCustomerId,
      activeOrganizationId,
      activeOrganizationName,
      defaultTerminalName,
      paymentMethodsForReceipt,
    ]
  );

  const moduleCapabilities = useModuleCapabilities();
  const saleModeAdapters = usePosSaleModeAdapters({
    activeOrganizationId,
    activeShiftId: activeShift?.id,
    allowCreditSales,
    closeActiveModal,
    deliveryInfo,
    moduleAccess: moduleCapabilities.data?.modules,
    paymentMethodOptions,
    printReceiptForSale,
    resetDeliveryInfo,
    selectedCustomerId,
  });
  const activeMode =
    saleModeAdapters.find(
      (mode) => mode.modeId !== "counter" && mode.isActive
    ) ?? saleModeAdapters[0];
  const checkout = activeMode.checkout;

  const buildFinalizeOptions = useCallback(
    (shiftId: string): SaleFinalizeOptions => ({
      shiftId,
      customerId: selectedCustomerId || null,
      closeModal: closeActiveModal,
      printReceipt: printReceiptForSale,
      resetDeliveryInfo,
    }),
    [
      selectedCustomerId,
      closeActiveModal,
      printReceiptForSale,
      resetDeliveryInfo,
    ]
  );

  const addItemToOrder = useCallback(
    (product: Product, modifiers: CartItemModifier[]) => {
      activeMode.addToCart(product, modifiers);
    },
    [activeMode]
  );

  const modifierModalControl = useMemo(
    () => ({
      openModifierModal: () => setActiveModal({ type: "modifier" }),
      closeModifierModal: closeActiveModal,
    }),
    [closeActiveModal]
  );

  const {
    selectedProductForModifiers,
    modifierQuantities,
    updateModifierQuantity,
    handleProductSelection,
    handleConfirmModifiers,
    handleQuickAddWithoutModifiers,
  } = useModifierModal(
    addItemToOrder,
    modifierProducts ?? [],
    modifierModalControl
  );

  const shift = usePosShift(
    activeShift,
    paymentMethodOptions,
    isPosModalOpen(activeModal, "close-shift"),
    closeActiveModal
  );

  const createCustomerModal = useCreateCustomerModal((customerId) => {
    setSelectedCustomerId(customerId);
  }, closeActiveModal);

  const toggleFavoriteMutation = useToggleProductFavoriteMutation();

  const selectedCustomerCreditAccount = useMemo(() => {
    if (!selectedCustomerId) {
      return null;
    }
    return (
      creditAccounts.find(
        (account) => account.customerId === selectedCustomerId
      ) ?? null
    );
  }, [creditAccounts, selectedCustomerId]);

  const projectedCreditBalance = useMemo(() => {
    if (!selectedCustomerCreditAccount) {
      return checkout.remainingCreditAmount;
    }
    return (
      selectedCustomerCreditAccount.balance + checkout.remainingCreditAmount
    );
  }, [selectedCustomerCreditAccount, checkout.remainingCreditAmount]);

  const requireActiveShift = useCallback(() => {
    if (activeShift) {
      return true;
    }
    setActiveModal({ type: "shift-required" });
    return false;
  }, [activeShift]);

  const handleProductSelect = useCallback(
    (product: Product) => {
      if (!requireActiveShift()) {
        return;
      }
      handleProductSelection(product);
    },
    [requireActiveShift, handleProductSelection]
  );

  const resolveBarcodeProduct = useCallback(
    (lookupValues: string[]) =>
      findProductByBarcodeScan(products, lookupValues),
    [products]
  );

  const handleBarcodeScanV1 = useCallback(
    (value: string): boolean => {
      if (!requireActiveShift()) {
        return false;
      }
      const matchedProduct = products.find(
        (p) =>
          p.barcode?.trim() === value ||
          p.sku?.trim().toLowerCase() === value.toLowerCase()
      );
      if (matchedProduct) {
        handleProductSelection(matchedProduct);
        return true;
      }
      return false;
    },
    [requireActiveShift, products, handleProductSelection]
  );

  const handleBarcodeScanV2 = useCallback(
    (event: KeyboardBarcodeScannerEvent): boolean => {
      const payload = buildPosV2BarcodeScanPayload(event);
      if (payload.lookupValues.length === 0) {
        return false;
      }

      if (!requireActiveShift()) {
        return false;
      }

      const matchedProduct = resolveBarcodeProduct(payload.lookupValues);
      if (matchedProduct) {
        setSearchQuery("");
        handleProductSelection(matchedProduct);
        return true;
      }

      setSearchQuery(payload.value);
      return false;
    },
    [requireActiveShift, resolveBarcodeProduct, handleProductSelection]
  );

  const openCheckout = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    setActiveModal({ type: "checkout" });
  }, [requireActiveShift]);

  const finalizeSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    const shiftId = activeShift?.id;
    if (!(shiftId && checkout.canFinalizeSale)) {
      return;
    }
    activeMode
      .finalizeSale(
        buildSalePaymentsFromInputs(checkout.payments),
        buildFinalizeOptions(shiftId)
      )
      .catch(() => undefined);
  }, [
    requireActiveShift,
    activeShift?.id,
    checkout,
    activeMode,
    buildFinalizeOptions,
  ]);

  const handleQuickSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    const shiftId = activeShift?.id;
    if (!shiftId) {
      return;
    }
    activeMode.quickSale(buildFinalizeOptions(shiftId)).catch(() => undefined);
  }, [requireActiveShift, activeShift?.id, activeMode, buildFinalizeOptions]);

  const updateQuantityAction = useCallback(
    (cartItemId: string, delta: number) => {
      activeMode.updateQuantity(cartItemId, delta);
    },
    [activeMode]
  );

  const removeFromCartAction = useCallback(
    (cartItemId: string) => {
      activeMode.removeFromCart(cartItemId);
    },
    [activeMode]
  );

  const clearCartAction = useCallback(() => {
    activeMode.clearCart();
  }, [activeMode]);

  const updateItemDiscountAction = useCallback(
    (cartItemId: string, value: string) => {
      activeMode.updateItemDiscount(cartItemId, value);
    },
    [activeMode]
  );

  const setDiscountInputAction = useCallback(
    (value: string) => {
      activeMode.setDiscountInput(value);
    },
    [activeMode]
  );

  const getProductQuantityAction = useCallback(
    (productId: string) => activeMode.getProductQuantity(productId),
    [activeMode]
  );

  const sendTableOrderToKitchen = useCallback(() => {
    activeMode.sendToKitchen?.().catch(() => undefined);
  }, [activeMode]);

  const tableMode = useMemo(
    () => saleModeAdapters.find((mode) => mode.modeId === "table"),
    [saleModeAdapters]
  );

  const enterTableMode = useCallback(
    (tableId: string) => {
      if (!tableMode) {
        return;
      }
      activeMode.exit();
      tableMode.enter(tableId);
    },
    [activeMode, tableMode]
  );

  const exitTableMode = useCallback(() => {
    if (activeMode.modeId === "table") {
      activeMode.exit();
    }
  }, [activeMode]);

  const tableSession = activeMode.sessionState;

  const openShiftFromRequired = useCallback(() => {
    setActiveModal({ type: "open-shift" });
  }, []);

  const value = useMemo<PosPageContextValue>(
    () => ({
      state: {
        activeCategoryId,
        activeModal,
        activeShift,
        canFinalizeSale: checkout.canFinalizeSale && !activeMode.isProcessing,
        canReturnCashChange: checkout.canReturnCashChange,
        cart: activeMode.cart,
        cashChangeDue: checkout.cashChangeDue,
        categories: categories ?? [],
        checkoutError: checkout.error ?? activeMode.error,
        customers,
        deliveryInfo,
        discountInput: activeMode.discountInput,
        hasNextPage: !!hasNextPage,
        hasPaymentDifference: checkout.hasPaymentDifference,
        isActiveShift,
        isActiveShiftLoading,
        isBootstrapLoading,
        isCreditSale: checkout.isCreditSale,
        isFetchingNextPage,
        isMobileCartOpen,
        isProcessingCheckout: activeMode.isProcessing,
        isProductsLoading,
        isQuickSaleMode,
        modifierProducts: modifierProducts ?? [],
        modifierQuantities,
        paymentDifference: checkout.paymentDifference,
        payments: checkout.payments,
        products,
        projectedCreditBalance,
        remainingCreditAmount: checkout.remainingCreditAmount,
        searchQuery,
        selectedCustomerCreditAccount,
        selectedCustomerId,
        selectedProductForModifiers,
        shouldCreateCreditBalance: checkout.shouldCreateCreditBalance,
        tableSession,
        totalItems: activeMode.totalItems,
        totalPaid: checkout.totalPaid,
        totals: activeMode.totals,
        viewMode,
      },
      actions: {
        addToCart: addItemToOrder,
        addPaymentMethod: checkout.addPaymentMethod,
        clearCart: clearCartAction,
        closeActiveModal,
        confirmCashMovement: shift.handleCashMovement,
        confirmCloseShift: shift.handleCloseShift,
        confirmCreateCustomer: createCustomerModal.handleCreateCustomer,
        confirmModifiers: handleConfirmModifiers,
        confirmOpenShift: shift.handleOpenShift,
        enterTableMode,
        exitTableMode,
        fetchNextProductsPage: fetchNextPage,
        finalizeSale,
        getProductQuantity: getProductQuantityAction,
        handleBarcodeScanV1,
        handleBarcodeScanV2,
        handleProductSelect,
        handleQuickSale,
        openActiveModal,
        openCashMovementModal: () => setActiveModal({ type: "cash-movement" }),
        openCheckout,
        openCheckoutDetails: () => setActiveModal({ type: "checkout-details" }),
        openCloseShiftModal: () => setActiveModal({ type: "close-shift" }),
        openCreateCustomerModal: () =>
          setActiveModal({ type: "create-customer" }),
        openShiftFromRequired,
        openShiftModal: () => setActiveModal({ type: "open-shift" }),
        quickAddWithoutModifiers: handleQuickAddWithoutModifiers,
        removeFromCart: removeFromCartAction,
        removePaymentMethod: checkout.removePaymentMethod,
        sendTableOrderToKitchen,
        setActiveCategoryId,
        setDeliveryInfo,
        setDiscountInput: setDiscountInputAction,
        setIsCreditSale: checkout.setIsCreditSale,
        setIsMobileCartOpen,
        setSearchQuery,
        setSelectedCustomerId,
        setViewMode,
        toggleProductFavorite: (productId) => {
          toggleFavoriteMutation.mutate({ productId });
        },
        toggleQuickSaleMode,
        updateItemDiscount: updateItemDiscountAction,
        updateModifierQuantity,
        updatePayment: checkout.updatePayment,
        updateQuantity: updateQuantityAction,
      },
      meta: {
        activeOrganizationId,
        allowCreditSales: activeMode.allowCreditSales,
        createCustomerModal,
        defaultTerminalName,
        isTogglingFavorite: toggleFavoriteMutation.isPending,
        paymentMethodOptions,
        resolveBarcodeProduct,
        shift,
        variant,
      },
    }),
    [
      activeCategoryId,
      activeModal,
      activeShift,
      activeMode,
      checkout,
      categories,
      customers,
      deliveryInfo,
      hasNextPage,
      isActiveShift,
      isActiveShiftLoading,
      isBootstrapLoading,
      shift,
      createCustomerModal,
      isFetchingNextPage,
      isMobileCartOpen,
      isProductsLoading,
      modifierProducts,
      modifierQuantities,
      products,
      projectedCreditBalance,
      searchQuery,
      selectedCustomerCreditAccount,
      selectedCustomerId,
      selectedProductForModifiers,
      tableSession,
      viewMode,
      addItemToOrder,
      clearCartAction,
      closeActiveModal,
      enterTableMode,
      exitTableMode,
      handleConfirmModifiers,
      handleQuickAddWithoutModifiers,
      fetchNextPage,
      finalizeSale,
      getProductQuantityAction,
      handleBarcodeScanV1,
      handleBarcodeScanV2,
      handleProductSelect,
      handleQuickSale,
      isQuickSaleMode,
      openActiveModal,
      openCheckout,
      openShiftFromRequired,
      removeFromCartAction,
      sendTableOrderToKitchen,
      setDiscountInputAction,
      toggleQuickSaleMode,
      updateItemDiscountAction,
      updateModifierQuantity,
      updateQuantityAction,
      activeOrganizationId,
      defaultTerminalName,
      toggleFavoriteMutation,
      paymentMethodOptions,
      resolveBarcodeProduct,
      variant,
    ]
  );

  return <PosPageContext value={value}>{children}</PosPageContext>;
}
