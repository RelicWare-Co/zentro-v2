import { ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { PosHeader } from "@/features/pos/components/PosHeader";
import { ProductGrid } from "@/features/pos/components/ProductGrid";
import { CartPanel } from "@/features/pos/components/CartPanel";
import { CashMovementModal } from "@/features/pos/components/modals/CashMovementModal";
import { CheckoutModal } from "@/features/pos/components/modals/CheckoutModal";
import { CloseShiftModal } from "@/features/pos/components/modals/CloseShiftModal";
import { CreateCustomerModal } from "@/features/pos/components/modals/CreateCustomerModal";
import { ModifierModal } from "@/features/pos/components/modals/ModifierModal";
import { OpenShiftModal } from "@/features/pos/components/modals/OpenShiftModal";
import { ShiftRequiredDialog } from "@/features/pos/components/modals/ShiftRequiredDialog";
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
import type { Product } from "@/features/pos/types";
import { calculateItemTotal, createPaymentMethodLabelMap } from "@/features/pos/utils";
import { buildSaleReceiptDocument } from "@/features/pos/printing/receipt-documents";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveOrganization } from "@/lib/auth-client";

export default function PosPage() {
	const isMobile = useIsMobile();
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCustomerId, setSelectedCustomerId] = useState("");
	const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
	const [isShiftRequiredOpen, setIsShiftRequiredOpen] = useState(false);
	const { data: activeOrganization } = useActiveOrganization();
	const activeOrganizationId = activeOrganization?.id ?? null;

	// Data queries
	const { data: bootstrap, isLoading: isBootstrapLoading } = usePosBootstrap();
	const { data: productsData, isLoading: isProductsLoading } = usePosProducts(
		activeCategoryId,
		searchQuery,
	);
	const { data: customersData } = usePosCustomers();
	const { data: creditAccountsData } = useCreditAccounts();

	// Extract data
	const activeShift = bootstrap?.activeShift ?? null;
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
		[settings?.paymentMethods],
	);
	const allowCreditSales = settings?.allowCreditSales ?? false;
	const defaultTerminalName = settings?.defaultTerminalName ?? "Caja Principal";

	const products = productsData?.data ?? [];
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
		setIsModifierModalOpen,
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
			const customer = customers.find(
				(c) => c.id === selectedCustomerId,
			);
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
		},
	);

	// Create customer modal
	const createCustomerModal = useCreateCustomerModal((customerId) => {
		setSelectedCustomerId(customerId);
	});

	// Toggle favorite
	const toggleFavoriteMutation = useToggleProductFavoriteMutation();

	// Credit account for selected customer
	const selectedCustomerCreditAccount = useMemo(() => {
		if (!selectedCustomerId) return null;
		return (
			creditAccounts.find(
				(account) => account.customerId === selectedCustomerId,
			) ?? null
		);
	}, [creditAccounts, selectedCustomerId]);

	const projectedCreditBalance = useMemo(() => {
		if (!selectedCustomerCreditAccount) return checkout.remainingCreditAmount;
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

	const handleBarcodeScan = async (value: string): Promise<boolean> => {
		if (!activeShift) {
			setIsShiftRequiredOpen(true);
			return false;
		}
		const matchedProduct = products.find(
			(p) =>
				p.barcode?.trim() === value ||
				p.sku?.trim().toLowerCase() === value.toLowerCase(),
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
		<div className="flex h-dvh flex-col overflow-hidden bg-[var(--color-void)] text-[var(--color-photon)]">
			<PosHeader
				activeShift={activeShift}
				defaultTerminalName={defaultTerminalName}
				customers={customers}
				selectedCustomerId={selectedCustomerId}
				onCustomerChange={setSelectedCustomerId}
				onOpenShift={() => shift.setIsShiftOpenModalOpen(true)}
				onCashMovement={() => shift.setIsCashMovementModalOpen(true)}
					onOpenDrawer={async () => {
						const { openPosCashDrawer } = await import(
							"@/features/pos/printing/print-thermal-receipt.client"
						);
						await openPosCashDrawer(activeOrganizationId);
					}}
				onCloseShift={() => shift.setIsCloseShiftModalOpen(true)}
				onCreateCustomer={() =>
					createCustomerModal.setIsCreateCustomerModalOpen(true)
				}
			/>

			<div className="flex flex-1 min-h-0 overflow-hidden">
				<ProductGrid
					categories={categories}
					activeCategoryId={activeCategoryId}
					searchQuery={searchQuery}
					products={products}
					isLoading={isBootstrapLoading || isProductsLoading}
					isActiveShift={!!activeShift}
					shouldAutoFocusSearch={!isMobile}
					getProductQuantity={getProductQuantity}
					onCategoryChange={setActiveCategoryId}
					onSearchChange={setSearchQuery}
					onClearSearch={() => setSearchQuery("")}
					onBarcodeScan={handleBarcodeScan}
					onProductSelect={handleProductSelect}
					onToggleFavorite={(productId) => {
						toggleFavoriteMutation.mutate({ productId });
					}}
					isTogglingFavorite={toggleFavoriteMutation.isPending}
					className={isMobile ? "border-r-0" : undefined}
				/>

				{!isMobile && (
					<CartPanel
						cart={cart}
						totalItems={totalItems}
						totals={totals}
						isActiveShift={!!activeShift}
						onUpdateQuantity={updateQuantity}
						onRemoveItem={removeFromCart}
						onUpdateItemDiscount={updateItemDiscount}
						onClearCart={clearCart}
						onCheckout={handleCheckout}
					/>
				)}
			</div>

			{/* Mobile cart drawer */}
			{isMobile && (
				<Drawer open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
					<DrawerTrigger asChild>
						<Button
							className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-[var(--color-voltage)] text-black hover:bg-[#c9e605] shadow-lg"
							size="icon"
						>
							<ShoppingCart className="h-5 w-5" />
							{totalItems > 0 && (
								<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
									{totalItems}
								</span>
							)}
						</Button>
					</DrawerTrigger>
					<DrawerContent className="bg-[var(--color-carbon)] border-gray-800 text-white max-h-[85dvh]">
						<DrawerHeader className="border-b border-gray-800">
							<DrawerTitle>Orden Actual</DrawerTitle>
						</DrawerHeader>
						<div className="flex flex-col h-[calc(85dvh-80px)]">
							<CartPanel
								cart={cart}
								totalItems={totalItems}
								totals={totals}
								isActiveShift={!!activeShift}
								onUpdateQuantity={updateQuantity}
								onRemoveItem={removeFromCart}
								onUpdateItemDiscount={updateItemDiscount}
								onClearCart={clearCart}
								onCheckout={() => {
									setIsMobileCartOpen(false);
									handleCheckout();
								}}
								className="w-full border-l-0 flex-1"
							/>
						</div>
					</DrawerContent>
				</Drawer>
			)}

			{/* Modals */}
			<OpenShiftModal
				isOpen={shift.isShiftOpenModalOpen}
				onClose={() => shift.setIsShiftOpenModalOpen(false)}
				startingCash={shift.startingCash}
				setStartingCash={shift.setStartingCash}
				openShiftNotes={shift.openShiftNotes}
				setOpenShiftNotes={shift.setOpenShiftNotes}
				canOpenShift={shift.canOpenShift}
				isOpening={shift.isOpeningShift}
				error={shift.openShiftError}
				onConfirm={shift.handleOpenShift}
			/>

			<CashMovementModal
				isOpen={shift.isCashMovementModalOpen}
				onClose={() => shift.setIsCashMovementModalOpen(false)}
				movementType={shift.movementType as "expense" | "payout" | "inflow"}
				setMovementType={shift.setMovementType}
				movementPaymentMethod={shift.movementPaymentMethod}
				setMovementPaymentMethod={shift.setMovementPaymentMethod}
				paymentMethodOptions={paymentMethodOptions}
				movementAmount={shift.movementAmount}
				setMovementAmount={shift.setMovementAmount}
				movementDescription={shift.movementDescription}
				setMovementDescription={shift.setMovementDescription}
				canRegister={shift.canRegisterCashMovement}
				isRegistering={shift.isRegisteringMovement}
				hasActiveShift={!!activeShift}
				error={shift.cashMovementError}
				onConfirm={shift.handleCashMovement}
			/>

			<CloseShiftModal
				isOpen={shift.isCloseShiftModalOpen}
				onClose={() => shift.setIsCloseShiftModalOpen(false)}
				activeShift={activeShift}
				shiftCloseSummary={shift.shiftCloseSummary}
				isLoading={shift.isShiftSummaryFetching}
				closureAmounts={shift.closureAmounts}
				setClosureAmounts={shift.setClosureAmounts}
				closeShiftNotes={shift.closeShiftNotes}
				setCloseShiftNotes={shift.setCloseShiftNotes}
				hasInvalidAmounts={shift.hasInvalidCloseAmounts}
				isClosing={shift.isClosingShift}
				error={shift.closeShiftError}
				onConfirm={shift.handleCloseShift}
			/>

			<CheckoutModal
				isOpen={checkout.isCheckoutModalOpen}
				onClose={() => checkout.setIsCheckoutModalOpen(false)}
				totalAmount={totals.totalAmount}
				discountInput={discountInput}
				setDiscountInput={setDiscountInput}
				payments={checkout.payments}
				paymentMethodOptions={paymentMethodOptions}
				allowCreditSales={allowCreditSales}
				isCreditSale={checkout.isCreditSale}
				setIsCreditSale={checkout.setIsCreditSale}
				customers={customers}
				selectedCustomerId={selectedCustomerId}
				onCustomerChange={setSelectedCustomerId}
				selectedCustomerCreditAccount={selectedCustomerCreditAccount}
				projectedCreditBalance={projectedCreditBalance}
				remainingCreditAmount={checkout.remainingCreditAmount}
				shouldCreateCreditBalance={checkout.shouldCreateCreditBalance}
				canFinalize={checkout.canFinalizeSale}
				isProcessing={checkout.isProcessing}
				paymentDifference={checkout.paymentDifference}
				hasPaymentDifference={checkout.hasPaymentDifference}
				canReturnCashChange={checkout.canReturnCashChange}
				cashChangeDue={checkout.cashChangeDue}
				error={checkout.error}
				onAddPaymentMethod={checkout.addPaymentMethod}
				onRemovePaymentMethod={checkout.removePaymentMethod}
				onUpdatePayment={checkout.updatePayment}
				onConfirm={checkout.handleFinalizeSale}
			/>

			<CreateCustomerModal
				isOpen={createCustomerModal.isCreateCustomerModalOpen}
				onClose={() => createCustomerModal.setIsCreateCustomerModalOpen(false)}
				name={createCustomerModal.newCustomerName}
				setName={createCustomerModal.setNewCustomerName}
				phone={createCustomerModal.newCustomerPhone}
				setPhone={createCustomerModal.setNewCustomerPhone}
				documentType={createCustomerModal.newCustomerDocumentType}
				setDocumentType={createCustomerModal.setNewCustomerDocumentType}
				documentNumber={createCustomerModal.newCustomerDocumentNumber}
				setDocumentNumber={createCustomerModal.setNewCustomerDocumentNumber}
				canCreate={createCustomerModal.canCreateCustomer}
				isCreating={createCustomerModal.isCreating}
				error={createCustomerModal.error}
				onConfirm={createCustomerModal.handleCreateCustomer}
			/>

			<ModifierModal
				isOpen={isModifierModalOpen}
				onClose={handleCloseModifierModal}
				selectedProduct={selectedProductForModifiers}
				modifierProducts={modifierProducts}
				modifierQuantities={modifierQuantities}
				onUpdateModifierQuantity={updateModifierQuantity}
				onConfirm={handleConfirmModifiers}
				onQuickAdd={handleQuickAddWithoutModifiers}
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
