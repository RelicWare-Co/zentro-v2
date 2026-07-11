import type {
  CartItem,
  CartItemModifier,
  CartTotals,
  PaymentMethod,
  Product,
} from "@/features/pos/types";

export type PosTableOrderItemStatus = "draft" | "sent" | "ready" | "served";

/**
 * Sesión de mesa activa: la cuenta abierta de la mesa se refleja como el
 * carrito del POS y las acciones se enrutan al módulo de restaurantes.
 */
export interface PosTableSessionState {
  areaName: string;
  draftItemsCount: number;
  isCancellingOrder: boolean;
  isClosingOrder: boolean;
  isLoading: boolean;
  isSendingToKitchen: boolean;
  itemStatusById: Record<string, PosTableOrderItemStatus>;
  orderId: string | null;
  orderNumber: number | null;
  tableId: string;
  tableName: string;
}

export interface SalePayment {
  amount: number;
  method: string;
  reference: string | null;
}

export interface SaleReceiptResult {
  balanceDue: number;
  discountAmount: number;
  paidAmount: number;
  saleId: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface SaleReceiptSnapshot {
  cart: CartItem[];
  payments: SalePayment[];
  totals: CartTotals;
}

export interface SaleReceiptPayload {
  result: SaleReceiptResult;
  snapshot: SaleReceiptSnapshot;
}

export interface SaleFinalizeOptions {
  closeModal: () => void;
  customerId: string | null;
  printReceipt: (payload: SaleReceiptPayload) => Promise<void> | void;
  shiftId: string;
}

export interface PosPaymentMethodOption {
  id: string;
  label: string;
  requiresReference: boolean;
}

export interface SaleModeCheckoutState {
  addPaymentMethod: () => void;
  canFinalizeSale: boolean;
  canReturnCashChange: boolean;
  cashChangeDue: number;
  error: Error | null;
  hasDiscountError: boolean;
  hasPaymentDifference: boolean;
  isCreditSale: boolean;
  isProcessing: boolean;
  paymentDifference: number;
  payments: PaymentMethod[];
  remainingCreditAmount: number;
  removePaymentMethod: (index: number) => void;
  resetPayments: () => void;
  setIsCreditSale: (value: boolean) => void;
  shouldCreateCreditBalance: boolean;
  totalPaid: number;
  updatePayment: (
    index: number,
    field: "method" | "amount" | "reference",
    value: string
  ) => void;
}

export interface SaleModeAdapter {
  addToCart(product: Product, modifiers: CartItemModifier[]): void;
  readonly allowCreditSales: boolean;
  cancelOrder?: (reason: string) => Promise<void>;
  readonly cart: CartItem[];
  readonly checkout: SaleModeCheckoutState;
  clearCart(): void;
  readonly discountInput: string;
  enter(payload?: unknown): void;
  readonly error: Error | null;
  exit(): void;
  finalizeSale(
    payments: SalePayment[],
    options: SaleFinalizeOptions
  ): Promise<void>;
  getProductQuantity(productId: string): number;
  readonly isActive: boolean;
  readonly isProcessing: boolean;
  readonly modeId: string;
  quickSale(options: SaleFinalizeOptions): Promise<void>;
  removeFromCart(cartItemId: string): void;
  sendToKitchen?: () => Promise<void>;
  readonly sessionState: PosTableSessionState | null;
  setDiscountInput(value: string): void;
  readonly totalItems: number;
  readonly totals: CartTotals;
  updateItemDiscount(cartItemId: string, value: string): void;
  updateQuantity(cartItemId: string, delta: number): void;
}

export interface SaleModeFactoryParams {
  activeOrganizationId: string | null;
  activeShiftId: string | undefined;
  allowCreditSales: boolean;
  closeActiveModal: () => void;
  paymentMethodOptions: PosPaymentMethodOption[];
  printReceiptForSale: (payload: SaleReceiptPayload) => Promise<void>;
  selectedCustomerId: string;
}

export interface PosSaleModeFactory {
  modeId: string;
  useAdapter(
    params: SaleModeFactoryParams & { accessible: boolean }
  ): SaleModeAdapter;
}
