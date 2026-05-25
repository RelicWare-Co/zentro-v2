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
import { useCreateCustomerModal } from "@/features/pos/hooks/use-create-customer-modal";
import { useModifierModal } from "@/features/pos/hooks/use-modifier-modal";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import {
  usePosCategories,
  usePosModifierProducts,
  usePosProducts,
  usePosSettings,
  useToggleProductFavoriteMutation,
} from "@/features/pos/hooks/use-pos-catalog";
import { usePosCheckout } from "@/features/pos/hooks/use-pos-checkout";
import { usePosCustomers } from "@/features/pos/hooks/use-pos-queries";
import { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import type { PosActiveModal } from "@/features/pos/pos-page-modals.shared";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { printSaleReceipt } from "@/features/pos/printing/print-sale-receipt.client";
import type {
  ActiveShift,
  CartItem,
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

export interface PaymentMethodOption {
  id: string;
  label: string;
  requiresReference: boolean;
}

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
  totalItems: number;
  totalPaid: number;
  totals: CartTotals;
  viewMode: "grid" | "list";
}

export interface PosPageActions {
  addPaymentMethod: () => void;
  addToCart: ReturnType<typeof usePosCart>["addToCart"];
  clearCart: () => void;
  closeActiveModal: () => void;
  confirmCashMovement: () => void;
  confirmCloseShift: () => void;
  confirmCreateCustomer: () => void;
  confirmModifiers: () => void;
  confirmOpenShift: () => void;
  fetchNextProductsPage: () => void;
  finalizeSale: () => void;
  getProductQuantity: (productId: string) => number;
  handleBarcodeScanV1: (value: string) => boolean;
  handleBarcodeScanV2: (event: KeyboardBarcodeScannerEvent) => boolean;
  handleProductSelect: (product: Product) => void;
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
  setActiveCategoryId: (id: string) => void;
  setDiscountInput: (value: string) => void;
  setIsCreditSale: (value: boolean) => void;
  setIsMobileCartOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCustomerId: (id: string) => void;
  setViewMode: (mode: "grid" | "list") => void;
  toggleProductFavorite: (productId: string) => void;
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<PosActiveModal | null>(null);

  const closeActiveModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openActiveModal = useCallback((modal: PosActiveModal) => {
    setActiveModal(modal);
  }, []);

  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;

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

  const {
    cart,
    discountInput,
    setDiscountInput,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    resetDiscount,
    updateItemDiscount,
    getProductQuantity,
    totals,
    totalItems,
  } = usePosCart();

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
  } = useModifierModal(addToCart, modifierProducts ?? [], modifierModalControl);

  const shift = usePosShift(
    activeShift,
    paymentMethodOptions,
    isPosModalOpen(activeModal, "close-shift"),
    closeActiveModal
  );

  const checkout = usePosCheckout(
    activeShift?.id,
    cart,
    totals,
    selectedCustomerId,
    discountInput,
    clearCart,
    resetDiscount,
    paymentMethodOptions,
    allowCreditSales,
    closeActiveModal,
    async (payload) => {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      await printSaleReceipt({
        activeOrganizationId,
        customer,
        defaultTerminalName,
        paymentMethods: paymentMethodsForReceipt,
        result: payload.result,
        snapshot: payload.snapshot,
      });
    }
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
    checkout.handleFinalizeSale();
  }, [requireActiveShift, checkout]);

  const openShiftFromRequired = useCallback(() => {
    setActiveModal({ type: "open-shift" });
  }, []);

  const value = useMemo<PosPageContextValue>(
    () => ({
      state: {
        activeCategoryId,
        activeModal,
        activeShift,
        canFinalizeSale: checkout.canFinalizeSale,
        canReturnCashChange: checkout.canReturnCashChange,
        cart,
        cashChangeDue: checkout.cashChangeDue,
        categories: categories ?? [],
        checkoutError: checkout.error,
        customers,
        discountInput,
        hasNextPage: !!hasNextPage,
        hasPaymentDifference: checkout.hasPaymentDifference,
        isActiveShift,
        isActiveShiftLoading,
        isBootstrapLoading,
        isCreditSale: checkout.isCreditSale,
        isFetchingNextPage,
        isMobileCartOpen,
        isProcessingCheckout: checkout.isProcessing,
        isProductsLoading,
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
        totalItems,
        totalPaid: checkout.totalPaid,
        totals,
        viewMode,
      },
      actions: {
        addToCart,
        addPaymentMethod: checkout.addPaymentMethod,
        clearCart,
        closeActiveModal,
        confirmCashMovement: shift.handleCashMovement,
        confirmCloseShift: shift.handleCloseShift,
        confirmCreateCustomer: createCustomerModal.handleCreateCustomer,
        confirmModifiers: handleConfirmModifiers,
        confirmOpenShift: shift.handleOpenShift,
        fetchNextProductsPage: fetchNextPage,
        finalizeSale,
        getProductQuantity,
        handleBarcodeScanV1,
        handleBarcodeScanV2,
        handleProductSelect,
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
        removeFromCart,
        removePaymentMethod: checkout.removePaymentMethod,
        setActiveCategoryId,
        setDiscountInput,
        setIsCreditSale: checkout.setIsCreditSale,
        setIsMobileCartOpen,
        setSearchQuery,
        setSelectedCustomerId,
        setViewMode,
        toggleProductFavorite: (productId) => {
          toggleFavoriteMutation.mutate({ productId });
        },
        updateItemDiscount,
        updateModifierQuantity,
        updatePayment: checkout.updatePayment,
        updateQuantity,
      },
      meta: {
        activeOrganizationId,
        allowCreditSales,
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
      checkout,
      cart,
      categories,
      customers,
      discountInput,
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
      totalItems,
      totals,
      viewMode,
      addToCart,
      clearCart,
      closeActiveModal,
      handleConfirmModifiers,
      handleQuickAddWithoutModifiers,
      fetchNextPage,
      finalizeSale,
      getProductQuantity,
      handleBarcodeScanV1,
      handleBarcodeScanV2,
      handleProductSelect,
      openActiveModal,
      openCheckout,
      openShiftFromRequired,
      removeFromCart,
      setDiscountInput,
      updateItemDiscount,
      updateModifierQuantity,
      updateQuantity,
      activeOrganizationId,
      allowCreditSales,
      defaultTerminalName,
      toggleFavoriteMutation,
      paymentMethodOptions,
      resolveBarcodeProduct,
      variant,
    ]
  );

  return <PosPageContext value={value}>{children}</PosPageContext>;
}
