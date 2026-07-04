import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import { createContext, type ReactNode, use, useMemo } from "react";
import type { useCreateCustomerModal } from "@/features/pos/hooks/use-create-customer-modal";
import type { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import { usePosCartContext } from "@/features/pos/pos-cart-context";
import { usePosCatalog } from "@/features/pos/pos-catalog-context";
import { usePosCheckoutContext } from "@/features/pos/pos-checkout-context";
import { usePosCustomer } from "@/features/pos/pos-customer-context";
import { usePosModal } from "@/features/pos/pos-modal-context";
import { usePosSaleMode } from "@/features/pos/pos-sale-mode-context";
import { usePosShiftContext } from "@/features/pos/pos-shift-context";
import {
  type PosPageVariant,
  usePosVariant,
} from "@/features/pos/pos-variant-context";
import type {
  PosPaymentMethodOption,
  PosTableSessionState,
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

export type { PosPageVariant } from "@/features/pos/pos-variant-context";
export type { PosTableSessionState } from "@/features/pos/sale-modes/types";

export type PaymentMethodOption = PosPaymentMethodOption;

export interface PosPageState {
  activeCategoryId: string;
  activeModal: string | null;
  activeShift: ActiveShift | null;
  canFinalizeSale: boolean;
  canReturnCashChange: boolean;
  cart: CartItem[];
  cashChangeDue: number;
  categories: Category[];
  checkoutError: Error | null;
  customers: PosCustomer[];
  discountInput: string;
  hasDiscountError: boolean;
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
  saleSuccessToken: number | null;
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
  addToCart: (product: Product, modifiers: CartItemModifier[]) => void;
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
  openActiveModal: (modal: string) => void;
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

export function PosPageCompatProvider({ children }: { children: ReactNode }) {
  const variant = usePosVariant();

  const {
    activeModal,
    closeActiveModal,
    isMobileCartOpen,
    isQuickSaleMode,
    openActiveModal,
    openCashMovementModal,
    openCheckoutDetails,
    openCloseShiftModal,
    openCreateCustomerModal,
    openShiftFromRequired,
    openShiftModal,
    setIsMobileCartOpen,
    toggleQuickSaleMode,
  } = usePosModal();

  const {
    activeCategoryId,
    activeOrganizationId,
    categories,
    defaultTerminalName,
    fetchNextProductsPage,
    hasNextPage,
    isBootstrapLoading,
    isFetchingNextPage,
    isProductsLoading,
    isTogglingFavorite,
    modifierProducts,
    paymentMethodOptions,
    products,
    resolveBarcodeProduct,
    searchQuery,
    setActiveCategoryId,
    setSearchQuery,
    setViewMode,
    toggleProductFavorite,
    viewMode,
  } = usePosCatalog();

  const { activeShift, isActiveShift, isActiveShiftLoading, shift } =
    usePosShiftContext();

  const {
    confirmCreateCustomer,
    createCustomerModal,
    customers,
    selectedCustomerCreditAccount,
    selectedCustomerId,
    setSelectedCustomerId,
  } = usePosCustomer();

  const { activeMode, saleSuccessToken } = usePosSaleMode();

  const {
    cart,
    clearCart,
    confirmModifiers,
    enterTableMode,
    exitTableMode,
    getProductQuantity,
    handleBarcodeScanV1,
    handleBarcodeScanV2,
    handleProductSelect,
    modifierQuantities,
    quickAddWithoutModifiers,
    removeFromCart,
    selectedProductForModifiers,
    sendTableOrderToKitchen,
    setDiscountInput,
    tableSession,
    totalItems,
    totals,
    updateItemDiscount,
    updateModifierQuantity,
    updateQuantity,
  } = usePosCartContext();

  const {
    addPaymentMethod,
    canFinalizeSale,
    canReturnCashChange,
    cashChangeDue,
    checkoutError,
    finalizeSale,
    handleQuickSale,
    hasDiscountError,
    hasPaymentDifference,
    isCreditSale,
    isProcessingCheckout,
    openCheckout,
    paymentDifference,
    payments,
    projectedCreditBalance,
    remainingCreditAmount,
    removePaymentMethod,
    setIsCreditSale,
    shouldCreateCreditBalance,
    totalPaid,
    updatePayment,
  } = usePosCheckoutContext();

  const value = useMemo<PosPageContextValue>(
    () => ({
      state: {
        activeCategoryId,
        activeModal,
        activeShift,
        canFinalizeSale,
        canReturnCashChange,
        cart,
        cashChangeDue,
        categories,
        checkoutError,
        customers,
        discountInput: activeMode.discountInput,
        hasNextPage: !!hasNextPage,
        hasDiscountError,
        hasPaymentDifference,
        isActiveShift,
        isActiveShiftLoading,
        isBootstrapLoading,
        isCreditSale,
        isFetchingNextPage,
        isMobileCartOpen,
        isProcessingCheckout,
        isProductsLoading,
        isQuickSaleMode,
        modifierProducts: modifierProducts ?? [],
        modifierQuantities,
        paymentDifference,
        payments,
        products,
        projectedCreditBalance,
        remainingCreditAmount,
        saleSuccessToken,
        searchQuery,
        selectedCustomerCreditAccount,
        selectedCustomerId,
        selectedProductForModifiers,
        shouldCreateCreditBalance,
        tableSession,
        totalItems,
        totalPaid,
        totals,
        viewMode,
      },
      actions: {
        addToCart: activeMode.addToCart,
        addPaymentMethod,
        clearCart,
        closeActiveModal,
        confirmCashMovement: shift.handleCashMovement,
        confirmCloseShift: shift.handleCloseShift,
        confirmCreateCustomer,
        confirmModifiers,
        confirmOpenShift: shift.handleOpenShift,
        enterTableMode,
        exitTableMode,
        fetchNextProductsPage,
        finalizeSale,
        getProductQuantity,
        handleBarcodeScanV1,
        handleBarcodeScanV2,
        handleProductSelect,
        handleQuickSale,
        openActiveModal,
        openCashMovementModal,
        openCheckout,
        openCheckoutDetails,
        openCloseShiftModal,
        openCreateCustomerModal,
        openShiftFromRequired,
        openShiftModal,
        quickAddWithoutModifiers,
        removeFromCart,
        removePaymentMethod,
        sendTableOrderToKitchen,
        setActiveCategoryId,
        setDiscountInput,
        setIsCreditSale,
        setIsMobileCartOpen,
        setSearchQuery,
        setSelectedCustomerId,
        setViewMode,
        toggleProductFavorite,
        toggleQuickSaleMode,
        updateItemDiscount,
        updateModifierQuantity,
        updatePayment,
        updateQuantity,
      },
      meta: {
        activeOrganizationId,
        allowCreditSales: activeMode.allowCreditSales,
        createCustomerModal,
        defaultTerminalName,
        isTogglingFavorite,
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
      addPaymentMethod,
      canFinalizeSale,
      canReturnCashChange,
      cashChangeDue,
      checkoutError,
      categories,
      customers,
      hasNextPage,
      hasDiscountError,
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
      saleSuccessToken,
      searchQuery,
      selectedCustomerCreditAccount,
      selectedCustomerId,
      selectedProductForModifiers,
      tableSession,
      totalItems,
      totals,
      viewMode,
      cart,
      clearCart,
      closeActiveModal,
      confirmCreateCustomer,
      confirmModifiers,
      enterTableMode,
      exitTableMode,
      fetchNextProductsPage,
      finalizeSale,
      getProductQuantity,
      handleBarcodeScanV1,
      handleBarcodeScanV2,
      handleProductSelect,
      handleQuickSale,
      isQuickSaleMode,
      openActiveModal,
      openCashMovementModal,
      openCheckout,
      openCheckoutDetails,
      openCloseShiftModal,
      openCreateCustomerModal,
      openShiftFromRequired,
      openShiftModal,
      quickAddWithoutModifiers,
      removeFromCart,
      sendTableOrderToKitchen,
      setDiscountInput,
      toggleQuickSaleMode,
      updateItemDiscount,
      updateModifierQuantity,
      updateQuantity,
      activeOrganizationId,
      defaultTerminalName,
      isTogglingFavorite,
      paymentMethodOptions,
      resolveBarcodeProduct,
      setActiveCategoryId,
      setIsMobileCartOpen,
      setSearchQuery,
      setSelectedCustomerId,
      setViewMode,
      toggleProductFavorite,
      hasPaymentDifference,
      isCreditSale,
      isProcessingCheckout,
      paymentDifference,
      payments,
      remainingCreditAmount,
      removePaymentMethod,
      setIsCreditSale,
      shouldCreateCreditBalance,
      totalPaid,
      updatePayment,
      variant,
    ]
  );

  return <PosPageContext value={value}>{children}</PosPageContext>;
}
