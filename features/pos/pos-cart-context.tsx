import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import { useModifierModal } from "@/features/pos/hooks/use-modifier-modal";
import { usePosCatalog } from "@/features/pos/pos-catalog-context";
import { usePosModal } from "@/features/pos/pos-modal-context";
import { POS_MODAL_IDS } from "@/features/pos/pos-page-modals.shared";
import { usePosSaleMode } from "@/features/pos/pos-sale-mode-context";
import { usePosShiftContext } from "@/features/pos/pos-shift-context";
import type { PosTableSessionState } from "@/features/pos/sale-modes/types";
import type {
  CartItem,
  CartItemModifier,
  CartTotals,
  Product,
} from "@/features/pos/types";
import { buildPosV2BarcodeScanPayload } from "@/features/posv2/posv2-barcode.shared";

export interface PosCartContextValue {
  cancelTableOrder: (reason: string) => Promise<void>;
  cart: CartItem[];
  clearCart: () => void;
  confirmModifiers: () => void;
  discountInput: string;
  enterTableMode: (tableId: string) => void;
  exitTableMode: () => void;
  getProductQuantity: (productId: string) => number;
  handleBarcodeScanV1: (value: string) => boolean;
  handleBarcodeScanV2: (event: KeyboardBarcodeScannerEvent) => boolean;
  handleProductSelect: (product: Product) => void;
  modifierQuantities: Record<string, number>;
  quickAddWithoutModifiers: () => void;
  removeFromCart: (cartItemId: string) => void;
  selectedProductForModifiers: Product | null;
  sendTableOrderToKitchen: () => void;
  setDiscountInput: (value: string) => void;
  tableSession: PosTableSessionState | null;
  totalItems: number;
  totals: CartTotals;
  updateItemDiscount: (cartItemId: string, value: string) => void;
  updateModifierQuantity: (modifierId: string, delta: number) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
}

const PosCartContext = createContext<PosCartContextValue | null>(null);

export function usePosCartContext() {
  const context = use(PosCartContext);
  if (!context) {
    throw new Error("usePosCartContext must be used within PosCartProvider.");
  }
  return context;
}

export function PosCartProvider({ children }: { children: ReactNode }) {
  const { activeMode, saleModeAdapters } = usePosSaleMode();
  const { requireActiveShift } = usePosShiftContext();
  const { modifierProducts, products, resolveBarcodeProduct, setSearchQuery } =
    usePosCatalog();
  const { closeActiveModal, openActiveModal } = usePosModal();

  const addItemToOrder = useCallback(
    (product: Product, modifiers: CartItemModifier[]) => {
      activeMode.addToCart(product, modifiers);
    },
    [activeMode]
  );

  const modifierModalControl = useMemo(
    () => ({
      openModifierModal: () => openActiveModal(POS_MODAL_IDS.MODIFIER),
      closeModifierModal: closeActiveModal,
    }),
    [openActiveModal, closeActiveModal]
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

  const handleProductSelect = useCallback(
    (product: Product) => {
      if (!requireActiveShift()) {
        return;
      }
      handleProductSelection(product);
    },
    [requireActiveShift, handleProductSelection]
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
    [
      requireActiveShift,
      resolveBarcodeProduct,
      handleProductSelection,
      setSearchQuery,
    ]
  );

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

  const cancelTableOrder = useCallback(
    async (reason: string) => {
      if (!activeMode.cancelOrder) {
        throw new Error("No hay una orden de mesa activa para cancelar.");
      }
      await activeMode.cancelOrder(reason);
    },
    [activeMode]
  );

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

  const value: PosCartContextValue = {
    cart: activeMode.cart,
    cancelTableOrder,
    clearCart: clearCartAction,
    confirmModifiers: handleConfirmModifiers,
    discountInput: activeMode.discountInput,
    enterTableMode,
    exitTableMode,
    getProductQuantity: getProductQuantityAction,
    handleBarcodeScanV1,
    handleBarcodeScanV2,
    handleProductSelect,
    modifierQuantities,
    quickAddWithoutModifiers: handleQuickAddWithoutModifiers,
    removeFromCart: removeFromCartAction,
    selectedProductForModifiers,
    sendTableOrderToKitchen,
    setDiscountInput: setDiscountInputAction,
    tableSession,
    totalItems: activeMode.totalItems,
    totals: activeMode.totals,
    updateItemDiscount: updateItemDiscountAction,
    updateModifierQuantity,
    updateQuantity: updateQuantityAction,
  };

  return <PosCartContext value={value}>{children}</PosCartContext>;
}
