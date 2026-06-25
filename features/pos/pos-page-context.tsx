import { notifications } from "@mantine/notifications";
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
import {
  buildQuickSalePayments,
  buildSalePaymentsFromInputs,
  usePosCheckout,
} from "@/features/pos/hooks/use-pos-checkout";
import { usePosCustomers } from "@/features/pos/hooks/use-pos-queries";
import { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import {
  type PosTableOrderItemStatus,
  usePosTableOrder,
} from "@/features/pos/hooks/use-pos-table-order";
import type { PosActiveModal } from "@/features/pos/pos-page-modals.shared";
import { isPosModalOpen } from "@/features/pos/pos-page-modals.shared";
import { printSaleReceipt } from "@/features/pos/printing/print-sale-receipt.client";
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

export interface PaymentMethodOption {
  id: string;
  label: string;
  requiresReference: boolean;
}

/**
 * Sesión de mesa activa: la cuenta abierta de la mesa se refleja como el
 * carrito del POS y las acciones se enrutan al módulo de restaurantes.
 */
export interface PosTableSessionState {
  areaName: string;
  draftItemsCount: number;
  isClosingOrder: boolean;
  isLoading: boolean;
  isSendingToKitchen: boolean;
  itemStatusById: Record<string, PosTableOrderItemStatus>;
  orderId: string | null;
  orderNumber: number | null;
  tableId: string;
  tableName: string;
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
  addToCart: ReturnType<typeof usePosCart>["addToCart"];
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
  const [tableDiscountInput, setTableDiscountInput] = useState("0");

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

  const resetDeliveryInfo = useCallback(() => {
    setDeliveryInfo("");
  }, []);

  const clearCurrentOrder = useCallback(() => {
    clearCart();
    resetDeliveryInfo();
  }, [clearCart, resetDeliveryInfo]);

  const tableOrder = usePosTableOrder(activeOrganizationId, tableDiscountInput);
  const isTableMode = Boolean(tableOrder.activeTableId);
  const effectiveCart = isTableMode ? tableOrder.cart : cart;
  const effectiveTotals = isTableMode ? tableOrder.totals : totals;
  const effectiveDiscountInput = isTableMode
    ? tableDiscountInput
    : discountInput;
  const effectiveTotalItems = isTableMode
    ? tableOrder.cart.reduce((sum, item) => sum + item.quantity, 0)
    : totalItems;
  const effectiveAllowCreditSales = allowCreditSales && !isTableMode;

  const addItemToOrder = useCallback(
    (product: Product, modifiers: CartItemModifier[]) => {
      if (tableOrder.activeTableId) {
        tableOrder.addProduct(product, modifiers).catch(() => undefined);
        return;
      }
      addToCart(product, modifiers);
    },
    [tableOrder.activeTableId, tableOrder.addProduct, addToCart]
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

  const printReceiptForSale = useCallback(
    async (payload: {
      result: {
        saleId: string;
        status: string;
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paidAmount: number;
        balanceDue: number;
      };
      snapshot: {
        cart: CartItem[];
        deliveryInfo: string | null;
        payments: Array<{
          method: string;
          amount: number;
          reference: string | null;
        }>;
        totals: CartTotals;
      };
    }) => {
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

  const checkout = usePosCheckout(
    activeShift?.id,
    effectiveCart,
    effectiveTotals,
    selectedCustomerId,
    deliveryInfo,
    effectiveDiscountInput,
    clearCurrentOrder,
    resetDiscount,
    resetDeliveryInfo,
    paymentMethodOptions,
    effectiveAllowCreditSales,
    closeActiveModal,
    printReceiptForSale
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

  const finalizeTableOrderWithPayments = useCallback(
    async (
      salePayments: Array<{
        method: string;
        amount: number;
        reference: string | null;
      }>
    ) => {
      const shiftId = activeShift?.id;
      if (
        !shiftId ||
        tableOrder.isClosingOrder ||
        tableOrder.cart.length === 0 ||
        salePayments.length === 0
      ) {
        return;
      }
      const tableName = tableOrder.table?.name ?? "La mesa";
      const receiptSnapshot = {
        cart: tableOrder.cart.map((item) => ({
          ...item,
          modifiers: item.modifiers.map((modifier) => ({ ...modifier })),
        })),
        deliveryInfo: null,
        payments: salePayments.map((payment) => ({ ...payment })),
        totals: { ...tableOrder.totals },
      };

      try {
        const result = await tableOrder.closeTableOrder({
          shiftId,
          customerId: selectedCustomerId || null,
          discountAmount: receiptSnapshot.totals.saleDiscountAmount,
          payments: salePayments,
        });

        const paidAmount = salePayments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );
        notifications.show({
          message: `${tableName} cobrada y liberada`,
          color: "green",
        });
        closeActiveModal();
        checkout.resetPayments();
        setTableDiscountInput("0");
        tableOrder.exitTable();

        Promise.resolve(
          printReceiptForSale({
            result: {
              saleId: result.saleId,
              status: "completed",
              subtotal: receiptSnapshot.totals.subTotal,
              taxAmount: receiptSnapshot.totals.tax,
              discountAmount: receiptSnapshot.totals.discountAmount,
              totalAmount: receiptSnapshot.totals.totalAmount,
              paidAmount,
              balanceDue: Math.max(
                receiptSnapshot.totals.totalAmount - paidAmount,
                0
              ),
            },
            snapshot: receiptSnapshot,
          })
        ).catch((error) => {
          notifications.show({
            title: "La mesa se cobró, pero no se pudo imprimir el ticket",
            message:
              error instanceof Error
                ? error.message
                : "Revisa la impresora e intenta reimprimir.",
            color: "red",
          });
        });
      } catch (error) {
        notifications.show({
          title: "No se pudo cobrar la mesa",
          message:
            error instanceof Error ? error.message : "Inténtalo de nuevo.",
          color: "red",
        });
      }
    },
    [
      activeShift?.id,
      tableOrder,
      selectedCustomerId,
      closeActiveModal,
      checkout,
      printReceiptForSale,
    ]
  );

  const finalizeSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    if (tableOrder.activeTableId) {
      if (!checkout.canFinalizeSale) {
        return;
      }
      finalizeTableOrderWithPayments(
        buildSalePaymentsFromInputs(checkout.payments)
      ).catch(() => undefined);
      return;
    }
    checkout.handleFinalizeSale();
  }, [
    requireActiveShift,
    tableOrder.activeTableId,
    checkout,
    finalizeTableOrderWithPayments,
  ]);

  const handleQuickSale = useCallback(() => {
    if (!requireActiveShift()) {
      return;
    }
    if (tableOrder.activeTableId) {
      finalizeTableOrderWithPayments(
        buildQuickSalePayments(tableOrder.totals.totalAmount)
      ).catch(() => undefined);
      return;
    }
    checkout.handleQuickSale();
  }, [
    requireActiveShift,
    tableOrder.activeTableId,
    tableOrder.totals.totalAmount,
    checkout,
    finalizeTableOrderWithPayments,
  ]);

  const updateQuantityAction = useCallback(
    (cartItemId: string, delta: number) => {
      if (tableOrder.activeTableId) {
        tableOrder.updateItemQuantity(cartItemId, delta).catch(() => undefined);
        return;
      }
      updateQuantity(cartItemId, delta);
    },
    [tableOrder.activeTableId, tableOrder.updateItemQuantity, updateQuantity]
  );

  const removeFromCartAction = useCallback(
    (cartItemId: string) => {
      if (tableOrder.activeTableId) {
        tableOrder.removeItem(cartItemId).catch(() => undefined);
        return;
      }
      removeFromCart(cartItemId);
    },
    [tableOrder.activeTableId, tableOrder.removeItem, removeFromCart]
  );

  const clearCartAction = useCallback(() => {
    if (tableOrder.activeTableId) {
      return;
    }
    clearCurrentOrder();
  }, [tableOrder.activeTableId, clearCurrentOrder]);

  const updateItemDiscountAction = useCallback(
    (cartItemId: string, value: string) => {
      if (tableOrder.activeTableId) {
        return;
      }
      updateItemDiscount(cartItemId, value);
    },
    [tableOrder.activeTableId, updateItemDiscount]
  );

  const setDiscountInputAction = useCallback(
    (value: string) => {
      if (tableOrder.activeTableId) {
        setTableDiscountInput(value);
        return;
      }
      setDiscountInput(value);
    },
    [tableOrder.activeTableId, setDiscountInput]
  );

  const getProductQuantityAction = useCallback(
    (productId: string) => {
      if (tableOrder.activeTableId) {
        let quantity = 0;
        for (const item of tableOrder.cart) {
          if (item.product.id === productId) {
            quantity += item.quantity;
          }
        }
        return quantity;
      }
      return getProductQuantity(productId);
    },
    [tableOrder.activeTableId, tableOrder.cart, getProductQuantity]
  );

  const sendTableOrderToKitchen = useCallback(() => {
    tableOrder.sendToKitchen().catch(() => undefined);
  }, [tableOrder.sendToKitchen]);

  // Reset payment inputs when switching between counter and table mode so
  // amounts typed for one order never leak into the other.
  const enterTableMode = useCallback(
    (tableId: string) => {
      checkout.resetPayments();
      setTableDiscountInput("0");
      tableOrder.enterTable(tableId);
    },
    [checkout.resetPayments, tableOrder.enterTable]
  );

  const exitTableMode = useCallback(() => {
    checkout.resetPayments();
    setTableDiscountInput("0");
    tableOrder.exitTable();
  }, [checkout.resetPayments, tableOrder.exitTable]);

  const tableSession = useMemo<PosTableSessionState | null>(() => {
    if (!tableOrder.activeTableId) {
      return null;
    }
    return {
      tableId: tableOrder.activeTableId,
      tableName: tableOrder.table?.name ?? "Mesa",
      areaName: tableOrder.table?.areaName ?? "",
      orderId: tableOrder.openOrder?.id ?? null,
      orderNumber: tableOrder.openOrder?.orderNumber ?? null,
      itemStatusById: tableOrder.itemStatusById,
      draftItemsCount: tableOrder.draftItemsCount,
      isLoading: tableOrder.isLoading,
      isSendingToKitchen: tableOrder.isSendingToKitchen,
      isClosingOrder: tableOrder.isClosingOrder,
    };
  }, [tableOrder]);

  const openShiftFromRequired = useCallback(() => {
    setActiveModal({ type: "open-shift" });
  }, []);

  const value = useMemo<PosPageContextValue>(
    () => ({
      state: {
        activeCategoryId,
        activeModal,
        activeShift,
        canFinalizeSale: checkout.canFinalizeSale && !tableOrder.isClosingOrder,
        canReturnCashChange: checkout.canReturnCashChange,
        cart: effectiveCart,
        cashChangeDue: checkout.cashChangeDue,
        categories: categories ?? [],
        checkoutError: checkout.error ?? tableOrder.closeOrderError,
        customers,
        deliveryInfo,
        discountInput: effectiveDiscountInput,
        hasNextPage: !!hasNextPage,
        hasPaymentDifference: checkout.hasPaymentDifference,
        isActiveShift,
        isActiveShiftLoading,
        isBootstrapLoading,
        isCreditSale: checkout.isCreditSale,
        isFetchingNextPage,
        isMobileCartOpen,
        isProcessingCheckout:
          checkout.isProcessing || tableOrder.isClosingOrder,
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
        totalItems: effectiveTotalItems,
        totalPaid: checkout.totalPaid,
        totals: effectiveTotals,
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
        allowCreditSales: effectiveAllowCreditSales,
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
      categories,
      customers,
      deliveryInfo,
      effectiveDiscountInput,
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
      tableOrder,
      tableSession,
      effectiveCart,
      effectiveTotals,
      effectiveTotalItems,
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
      effectiveAllowCreditSales,
      defaultTerminalName,
      toggleFavoriteMutation,
      paymentMethodOptions,
      resolveBarcodeProduct,
      variant,
    ]
  );

  return <PosPageContext value={value}>{children}</PosPageContext>;
}
