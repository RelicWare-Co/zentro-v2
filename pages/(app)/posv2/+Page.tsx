import { useMemo, useState } from "react";
import { CashMovementModal } from "@/features/pos/components/modals/cash-movement-modal";
import { CheckoutModal } from "@/features/pos/components/modals/checkout-modal";
import { CloseShiftModal } from "@/features/pos/components/modals/close-shift-modal";
import { CreateCustomerModal } from "@/features/pos/components/modals/create-customer-modal";
import { ModifierModal } from "@/features/pos/components/modals/modifier-modal";
import { OpenShiftModal } from "@/features/pos/components/modals/open-shift-modal";
import { ShiftRequiredDialog } from "@/features/pos/components/modals/shift-required-dialog";
import { useCreateCustomerModal } from "@/features/pos/hooks/use-create-customer-modal";
import { useModifierModal } from "@/features/pos/hooks/use-modifier-modal";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCheckout } from "@/features/pos/hooks/use-pos-checkout";
import {
  useCreditAccounts,
  usePosBootstrap,
  usePosCustomers,
  usePosProducts,
  useToggleProductFavoriteMutation,
} from "@/features/pos/hooks/use-pos-queries";
import { usePosShift } from "@/features/pos/hooks/use-pos-shift";
import { buildSaleReceiptDocument } from "@/features/pos/printing/receipt-documents";
import type { Product } from "@/features/pos/types";
import {
  calculateItemTotal,
  createPaymentMethodLabelMap,
} from "@/features/pos/utils";
import { CartPanelV2 } from "@/features/posv2/components/cart-panel-v2";
import { PosV2Header } from "@/features/posv2/components/pos-v2-header";
import { ProductCatalog } from "@/features/posv2/components/product-catalog";
import { useActiveShift } from "@/features/shifts/hooks/use-shifts";
import { useActiveOrganization } from "@/lib/auth-client";

export default function PosV2Page() {
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isShiftRequiredOpen, setIsShiftRequiredOpen] = useState(false);

  const { data: activeOrganization } = useActiveOrganization();
  const activeOrganizationId = activeOrganization?.id ?? null;

  // Data queries
  const { data: bootstrap, isLoading: isBootstrapLoading } = usePosBootstrap();
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
  const { data: creditAccountsData } = useCreditAccounts();

  // Extract data
  const activeShift = activeShiftData?.shift ?? null;
  const categories = bootstrap?.categories ?? [];
  const modifierProducts = bootstrap?.modifierProducts ?? [];
  const settings = bootstrap?.settings;
  const paymentMethodOptions = useMemo(
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

  const products = productsData?.pages.flatMap((page) => page.data) ?? [];
  const customers = customersData?.data ?? [];
  const creditAccounts = creditAccountsData?.data ?? [];

  // Cart hook
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

  // Modifier modal
  const {
    isModifierModalOpen,
    setIsModifierModalOpen: _setIsModifierModalOpen,
    selectedProductForModifiers,
    modifierQuantities,
    updateModifierQuantity,
    handleProductSelection,
    handleConfirmModifiers,
    handleQuickAddWithoutModifiers,
    handleCloseModal: handleCloseModifierModal,
  } = useModifierModal(addToCart, modifierProducts);

  // Shift hooks
  const shift = usePosShift(activeShift, paymentMethodOptions);

  // Checkout hook
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
    async (payload) => {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      const document = buildSaleReceiptDocument({
        documentId: payload.result.saleId,
        issuedAt: Date.now(),
        status: payload.result.status,
        customerName: customer?.name ?? "Cliente general",
        customerMeta: customer?.phone ?? null,
        cashierName: null,
        terminalName: defaultTerminalName,
        items: payload.snapshot.cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalAmount: calculateItemTotal(item),
          discountAmount: item.discountAmount,
          modifiers: item.modifiers.map((m) => ({
            name: m.name,
            quantity: m.quantity,
            unitPrice: m.price,
          })),
        })),
        payments: payload.snapshot.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
          reference: p.reference,
        })),
        subtotal: payload.result.subtotal,
        taxAmount: payload.result.taxAmount,
        discountAmount: payload.result.discountAmount,
        totalAmount: payload.result.totalAmount,
        paidAmount: payload.result.paidAmount,
        balanceDue: payload.result.balanceDue,
        paymentMethodLabels: settings
          ? createPaymentMethodLabelMap(settings.paymentMethods)
          : undefined,
      });
      const { printThermalReceipt } = await import(
        "@/features/pos/printing/print-thermal-receipt.client"
      );
      await printThermalReceipt(document, activeOrganizationId);
    }
  );

  // Create customer modal
  const createCustomerModal = useCreateCustomerModal((customerId) => {
    setSelectedCustomerId(customerId);
  });

  // Toggle favorite
  const toggleFavoriteMutation = useToggleProductFavoriteMutation();

  // Credit account for selected customer
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

  // Handlers
  const handleProductSelect = (product: Product) => {
    if (!activeShift) {
      setIsShiftRequiredOpen(true);
      return;
    }
    handleProductSelection(product);
  };

  const _handleBarcodeScan = (value: string): boolean => {
    if (!activeShift) {
      setIsShiftRequiredOpen(true);
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
  };

  const handleCheckout = () => {
    if (!activeShift) {
      setIsShiftRequiredOpen(true);
      return;
    }
    checkout.setIsCheckoutModalOpen(true);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0a] text-white">
      <PosV2Header
        activeShift={activeShift}
        defaultTerminalName={defaultTerminalName}
        onCashMovement={() => shift.setIsCashMovementModalOpen(true)}
        onCloseShift={() => shift.setIsCloseShiftModalOpen(true)}
        onOpenDrawer={async () => {
          const { openPosCashDrawer } = await import(
            "@/features/pos/printing/print-thermal-receipt.client"
          );
          await openPosCashDrawer(activeOrganizationId);
        }}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ProductCatalog
          activeCategoryId={activeCategoryId}
          categories={categories}
          getProductQuantity={getProductQuantity}
          hasMore={!!hasNextPage}
          isActiveShift={!!activeShift}
          isLoading={
            isBootstrapLoading || isActiveShiftLoading || isProductsLoading
          }
          isLoadingMore={isFetchingNextPage}
          isTogglingFavorite={toggleFavoriteMutation.isPending}
          onCategoryChange={setActiveCategoryId}
          onClearSearch={() => setSearchQuery("")}
          onLoadMore={fetchNextPage}
          onProductSelect={handleProductSelect}
          onSearchChange={setSearchQuery}
          onToggleFavorite={(productId) => {
            toggleFavoriteMutation.mutate({ productId });
          }}
          onViewModeChange={setViewMode}
          products={products}
          searchQuery={searchQuery}
          viewMode={viewMode}
        />

        <CartPanelV2
          cart={cart}
          isActiveShift={!!activeShift}
          onCheckout={handleCheckout}
          onClearCart={clearCart}
          onRemoveItem={removeFromCart}
          onUpdateItemDiscount={updateItemDiscount}
          onUpdateQuantity={updateQuantity}
          totalItems={totalItems}
          totals={totals}
        />
      </div>

      {/* Modals */}
      <OpenShiftModal
        canOpenShift={shift.canOpenShift}
        error={shift.openShiftError}
        isOpen={shift.isShiftOpenModalOpen}
        isOpening={shift.isOpeningShift}
        onClose={() => shift.setIsShiftOpenModalOpen(false)}
        onConfirm={shift.handleOpenShift}
        openShiftNotes={shift.openShiftNotes}
        setOpenShiftNotes={shift.setOpenShiftNotes}
        setStartingCash={shift.setStartingCash}
        startingCash={shift.startingCash}
      />

      <CashMovementModal
        canRegister={shift.canRegisterCashMovement}
        error={shift.cashMovementError}
        hasActiveShift={!!activeShift}
        isOpen={shift.isCashMovementModalOpen}
        isRegistering={shift.isRegisteringMovement}
        movementAmount={shift.movementAmount}
        movementDescription={shift.movementDescription}
        movementPaymentMethod={shift.movementPaymentMethod}
        movementType={shift.movementType as "expense" | "payout" | "inflow"}
        onClose={() => shift.setIsCashMovementModalOpen(false)}
        onConfirm={shift.handleCashMovement}
        paymentMethodOptions={paymentMethodOptions}
        setMovementAmount={shift.setMovementAmount}
        setMovementDescription={shift.setMovementDescription}
        setMovementPaymentMethod={shift.setMovementPaymentMethod}
        setMovementType={shift.setMovementType}
      />

      <CloseShiftModal
        activeShift={activeShift}
        closeShiftNotes={shift.closeShiftNotes}
        closureAmounts={shift.closureAmounts}
        error={shift.closeShiftError}
        hasInvalidAmounts={shift.hasInvalidCloseAmounts}
        isClosing={shift.isClosingShift}
        isLoading={shift.isShiftSummaryFetching}
        isOpen={shift.isCloseShiftModalOpen}
        onClose={() => shift.setIsCloseShiftModalOpen(false)}
        onConfirm={shift.handleCloseShift}
        setCloseShiftNotes={shift.setCloseShiftNotes}
        setClosureAmounts={shift.setClosureAmounts}
        shiftCloseSummary={shift.shiftCloseSummary}
      />

      <CheckoutModal
        allowCreditSales={allowCreditSales}
        canFinalize={checkout.canFinalizeSale}
        canReturnCashChange={checkout.canReturnCashChange}
        cashChangeDue={checkout.cashChangeDue}
        customers={customers}
        discountInput={discountInput}
        error={checkout.error}
        hasPaymentDifference={checkout.hasPaymentDifference}
        isCreditSale={checkout.isCreditSale}
        isOpen={checkout.isCheckoutModalOpen}
        isProcessing={checkout.isProcessing}
        onAddPaymentMethod={checkout.addPaymentMethod}
        onClose={() => checkout.setIsCheckoutModalOpen(false)}
        onConfirm={checkout.handleFinalizeSale}
        onCustomerChange={setSelectedCustomerId}
        onRemovePaymentMethod={checkout.removePaymentMethod}
        onUpdatePayment={checkout.updatePayment}
        paymentDifference={checkout.paymentDifference}
        paymentMethodOptions={paymentMethodOptions}
        payments={checkout.payments}
        projectedCreditBalance={projectedCreditBalance}
        remainingCreditAmount={checkout.remainingCreditAmount}
        selectedCustomerCreditAccount={selectedCustomerCreditAccount}
        selectedCustomerId={selectedCustomerId}
        setDiscountInput={setDiscountInput}
        setIsCreditSale={checkout.setIsCreditSale}
        shouldCreateCreditBalance={checkout.shouldCreateCreditBalance}
        totalAmount={totals.totalAmount}
      />

      <CreateCustomerModal
        canCreate={createCustomerModal.canCreateCustomer}
        documentNumber={createCustomerModal.newCustomerDocumentNumber}
        documentType={createCustomerModal.newCustomerDocumentType}
        error={createCustomerModal.error}
        isCreating={createCustomerModal.isCreating}
        isOpen={createCustomerModal.isCreateCustomerModalOpen}
        name={createCustomerModal.newCustomerName}
        onClose={() => createCustomerModal.setIsCreateCustomerModalOpen(false)}
        onConfirm={createCustomerModal.handleCreateCustomer}
        phone={createCustomerModal.newCustomerPhone}
        setDocumentNumber={createCustomerModal.setNewCustomerDocumentNumber}
        setDocumentType={createCustomerModal.setNewCustomerDocumentType}
        setName={createCustomerModal.setNewCustomerName}
        setPhone={createCustomerModal.setNewCustomerPhone}
      />

      <ModifierModal
        isOpen={isModifierModalOpen}
        modifierProducts={modifierProducts}
        modifierQuantities={modifierQuantities}
        onClose={handleCloseModifierModal}
        onConfirm={handleConfirmModifiers}
        onQuickAdd={handleQuickAddWithoutModifiers}
        onUpdateModifierQuantity={updateModifierQuantity}
        selectedProduct={selectedProductForModifiers}
      />

      <ShiftRequiredDialog
        isOpen={isShiftRequiredOpen}
        onClose={() => setIsShiftRequiredOpen(false)}
        onOpenShift={() => {
          setIsShiftRequiredOpen(false);
          shift.setIsShiftOpenModalOpen(true);
        }}
      />
    </div>
  );
}
