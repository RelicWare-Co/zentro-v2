import { Plus, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";
import type { PaymentMethod, PosCustomer } from "../../types";
import { formatCurrency } from "../../utils";
import { CustomerPicker } from "../CustomerPicker";

interface CheckoutModalProps {
	isOpen: boolean;
	onClose: () => void;
	totalAmount: number;
	discountInput: string;
	setDiscountInput: (value: string) => void;
	payments: PaymentMethod[];
	paymentMethodOptions: Array<{
		id: string;
		label: string;
		requiresReference: boolean;
	}>;
	allowCreditSales: boolean;
	isCreditSale: boolean;
	setIsCreditSale: (value: boolean) => void;
	customers: PosCustomer[];
	selectedCustomerId: string;
	onCustomerChange: (customerId: string) => void;
	selectedCustomerCreditAccount: { balance: number } | null;
	projectedCreditBalance: number;
	remainingCreditAmount: number;
	shouldCreateCreditBalance: boolean;
	canFinalize: boolean;
	isProcessing: boolean;
	paymentDifference: number;
	hasPaymentDifference: boolean;
	canReturnCashChange: boolean;
	cashChangeDue: number;
	error: Error | null;
	onAddPaymentMethod: () => void;
	onRemovePaymentMethod: (index: number) => void;
	onUpdatePayment: (
		index: number,
		field: "method" | "amount" | "reference",
		value: string,
	) => void;
	onConfirm: () => void;
}

const paymentFieldClassName =
	"h-10 touch-manipulation rounded-lg border-zinc-700 bg-[#151515] py-0 text-base text-white md:text-sm";
const paymentSelectFieldClassName =
	"data-[size=default]:h-10 data-[size=default]:rounded-lg";

export function CheckoutModal({
	isOpen,
	onClose,
	totalAmount,
	discountInput,
	setDiscountInput,
	payments,
	paymentMethodOptions,
	allowCreditSales,
	isCreditSale,
	setIsCreditSale,
	customers,
	selectedCustomerId,
	onCustomerChange,
	selectedCustomerCreditAccount,
	projectedCreditBalance,
	remainingCreditAmount,
	shouldCreateCreditBalance,
	canFinalize,
	isProcessing,
	paymentDifference,
	hasPaymentDifference,
	canReturnCashChange,
	cashChangeDue,
	error,
	onAddPaymentMethod,
	onRemovePaymentMethod,
	onUpdatePayment,
	onConfirm,
}: CheckoutModalProps) {
	const paymentAmountInputRef = useRef<HTMLInputElement | null>(null);
	const discountInputRef = useRef<HTMLInputElement | null>(null);
	const isMobile = useIsMobile();
	const discountInputId = useId();
	const discountEnabledId = useId();
	const creditSaleId = useId();
	const [isDiscountEnabled, setIsDiscountEnabled] = useState(
		Number(discountInput) > 0,
	);
	const paymentMethodById = new Map(
		paymentMethodOptions.map((paymentMethod) => [
			paymentMethod.id,
			paymentMethod,
		]),
	);
	const footerLabel = isCreditSale
		? "Saldo que quedará a crédito:"
		: canReturnCashChange
			? "Cambio a devolver:"
			: "Diferencia de pago:";
	const footerValue = isCreditSale
		? Math.abs(paymentDifference)
		: canReturnCashChange
			? cashChangeDue
			: Math.abs(paymentDifference);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setIsDiscountEnabled(Number(discountInput) > 0);
		if (isMobile) {
			return;
		}

		const focusTimeout = window.setTimeout(() => {
			paymentAmountInputRef.current?.focus();
			paymentAmountInputRef.current?.select();
		}, 0);

		return () => window.clearTimeout(focusTimeout);
	}, [discountInput, isMobile, isOpen]);

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-zinc-800 text-white sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="text-xl">Cobrar Orden</DialogTitle>
				</DialogHeader>

				<div className="py-4 space-y-6">
					<div className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-lg border border-zinc-800">
						<span className="text-zinc-400 font-medium">Total a Pagar</span>
						<span className="text-3xl font-bold text-[var(--color-voltage)]">
							{formatCurrency(totalAmount)}
						</span>
					</div>

					<div className="space-y-4">
						<div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3">
							<div className="space-y-1">
								<p className="text-sm font-medium text-zinc-200">
									Cliente de la venta
								</p>
								<p className="text-xs text-zinc-500">
									Puedes asignarlo aquí mismo antes de finalizar el cobro.
								</p>
							</div>
							<CustomerPicker
								customers={customers}
								selectedCustomerId={selectedCustomerId}
								onCustomerChange={onCustomerChange}
								buttonClassName="mt-3 h-auto w-full justify-between border-zinc-700 bg-[#151515] hover:bg-[#151515]"
								contentClassName="w-[min(420px,calc(100vw-2rem))]"
							/>
						</div>

						<div className="rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3">
							<div className="flex items-center justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-zinc-200">
										Aplicar descuento
									</p>
									<p className="text-xs text-zinc-500">
										Actívalo solo cuando la orden lo necesite.
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Checkbox
										id={discountEnabledId}
										checked={isDiscountEnabled}
										onCheckedChange={(checked) => {
											const nextValue = checked === true;
											setIsDiscountEnabled(nextValue);
											if (!nextValue) {
												setDiscountInput("0");
												return;
											}
											if (isMobile) {
												return;
											}

											window.setTimeout(() => {
												discountInputRef.current?.focus();
												discountInputRef.current?.select();
											}, 0);
										}}
										className="border-zinc-600 data-[state=checked]:border-[var(--color-voltage)] data-[state=checked]:bg-[var(--color-voltage)] data-[state=checked]:text-black"
									/>
									<label
										htmlFor={discountEnabledId}
										className="cursor-pointer text-sm text-zinc-300"
									>
										Agregar
									</label>
								</div>
							</div>

							{isDiscountEnabled ? (
								<div className="relative mt-3">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
										$
									</span>
									<Input
										ref={discountInputRef}
										id={discountInputId}
										type="text"
										inputMode="numeric"
										autoComplete="off"
										value={formatMoneyInput(discountInput)}
										onChange={(event) =>
											setDiscountInput(sanitizeMoneyInput(event.target.value))
										}
										className="h-10 touch-manipulation border-zinc-700 bg-[#151515] pl-7 text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:text-sm"
									/>
								</div>
							) : null}
						</div>

						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold text-zinc-300">
								Métodos de Pago
							</h4>
							{allowCreditSales ? (
								<div className="flex items-center gap-2">
									<input
										type="checkbox"
										id={creditSaleId}
										checked={isCreditSale}
										onChange={(e) => setIsCreditSale(e.target.checked)}
										className="size-4 rounded border-zinc-700 bg-[#0a0a0a] text-[var(--color-voltage)] focus:ring-[var(--color-voltage)]"
									/>
									<label
										htmlFor={creditSaleId}
										className="text-sm text-zinc-400 cursor-pointer"
									>
										Dejar saldo a crédito
									</label>
								</div>
							) : (
								<span className="text-sm text-zinc-500">
									Crédito deshabilitado en ajustes
								</span>
							)}
						</div>

						{shouldCreateCreditBalance && !selectedCustomerId && (
							<p className="text-sm text-amber-400">
								Selecciona un cliente para registrar venta a crédito.
							</p>
						)}

						{shouldCreateCreditBalance &&
							selectedCustomerId &&
							!selectedCustomerCreditAccount && (
								<p className="text-sm text-amber-300">
									Se creará la cuenta de crédito del cliente con el saldo
									pendiente de esta venta.
								</p>
							)}

						{isCreditSale && (
							<p className="text-sm text-zinc-400">
								{shouldCreateCreditBalance
									? "Puedes registrar un abono inicial ahora y el restante quedará pendiente en la cuenta del cliente."
									: "Con los descuentos y pagos actuales no quedará saldo pendiente, así que la venta se registrará como pagada."}
							</p>
						)}

						{selectedCustomerCreditAccount && (
							<div className="bg-amber-900/20 border border-amber-900/40 rounded-lg p-3 space-y-1 text-sm">
								<p className="text-amber-300 font-medium">
									Saldo pendiente actual:{" "}
									{formatCurrency(selectedCustomerCreditAccount.balance)}
								</p>
								{isCreditSale && (
									<>
										<p className="text-amber-200">
											{shouldCreateCreditBalance
												? "Saldo que quedará pendiente por esta venta: "
												: "Saldo pendiente por esta venta: "}
											{formatCurrency(remainingCreditAmount)}
										</p>
										{shouldCreateCreditBalance ? (
											<p className="text-amber-200">
												Saldo proyectado total tras esta venta:{" "}
												{formatCurrency(projectedCreditBalance)}
											</p>
										) : null}
									</>
								)}
							</div>
						)}

						<div className="space-y-3">
							{payments.map((payment, index) => {
								const selectedPaymentMethod = paymentMethodById.get(
									payment.method,
								);

								return (
									<div
										key={payment.id}
										className="relative flex flex-col gap-2 rounded-lg border border-zinc-800 bg-[#0a0a0a] p-3"
									>
										{payments.length > 1 && (
											<div className="flex items-center justify-between gap-3">
												<p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
													Pago {index + 1}
												</p>
												<button
													type="button"
													onClick={() => onRemovePaymentMethod(index)}
													className="inline-flex h-8 touch-manipulation items-center gap-1 rounded-md px-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
													aria-label={`Eliminar método de pago ${index + 1}`}
												>
													<XIcon className="size-3.5" />
													<span>Quitar</span>
												</button>
											</div>
										)}

										<div className="flex gap-2">
											<Select
												value={payment.method}
												onValueChange={(value) =>
													onUpdatePayment(index, "method", value)
												}
											>
												<SelectTrigger
													className={`${paymentFieldClassName} ${paymentSelectFieldClassName} flex-1 px-3 [&_[data-slot=select-value]]:leading-none`}
												>
													<SelectValue placeholder="Método" />
												</SelectTrigger>
												<SelectContent className="bg-[#151515] border-zinc-700 text-white">
													{paymentMethodOptions.map((paymentMethodOption) => (
														<SelectItem
															key={paymentMethodOption.id}
															value={paymentMethodOption.id}
														>
															{paymentMethodOption.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>

											<div className="relative flex-1">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
													$
												</span>
												<Input
													ref={index === 0 ? paymentAmountInputRef : undefined}
													type="text"
													inputMode="numeric"
													autoComplete="off"
													placeholder="Monto"
													value={formatMoneyInput(payment.amount)}
													onChange={(e) =>
														onUpdatePayment(
															index,
															"amount",
															sanitizeMoneyInput(e.target.value),
														)
													}
													className={`${paymentFieldClassName} pl-7`}
												/>
											</div>
										</div>

										{selectedPaymentMethod?.requiresReference ? (
											<Input
												placeholder="Referencia (Ej. últimos 4 dígitos o voucher)"
												autoComplete="off"
												value={payment.reference}
												onChange={(e) =>
													onUpdatePayment(index, "reference", e.target.value)
												}
												className="h-10 touch-manipulation border-zinc-700 bg-[#151515] text-base focus-visible:border-[var(--color-voltage)] focus-visible:ring-0 md:h-9 md:text-sm"
											/>
										) : null}
									</div>
								);
							})}

							<Button
								variant="outline"
								onClick={onAddPaymentMethod}
								className="w-full h-9 border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 bg-transparent"
							>
								<Plus className="size-4 mr-2" />
								Dividir Pago (Otro método)
							</Button>
						</div>
					</div>

					<div className="flex justify-between items-center text-sm pt-2 border-t border-zinc-800">
						<span className="text-zinc-400">{footerLabel}</span>
						<span
							className={`font-semibold ${
								isCreditSale
									? shouldCreateCreditBalance
										? "text-[var(--color-voltage)]"
										: "text-green-400"
									: canReturnCashChange
										? "text-[var(--color-voltage)]"
										: paymentDifference === 0
											? "text-green-400"
											: paymentDifference > 0
												? "text-red-400"
												: "text-amber-400"
							}`}
						>
							{formatCurrency(footerValue)}
						</span>
					</div>

					{!isCreditSale && canReturnCashChange && hasPaymentDifference ? (
						<p className="text-sm text-zinc-400">
							El sistema registrará el valor recibido y mostrará este monto como
							vuelto para el cajero.
						</p>
					) : null}

					{error instanceof Error && (
						<p className="text-sm text-red-400">{error.message}</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onClose}
						className="text-zinc-400 hover:text-white"
					>
						Cancelar
					</Button>
					<Button
						onClick={onConfirm}
						disabled={!canFinalize || isProcessing}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						{isProcessing
							? "Procesando..."
							: shouldCreateCreditBalance
								? "Registrar Venta con Saldo"
								: "Finalizar Venta"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
