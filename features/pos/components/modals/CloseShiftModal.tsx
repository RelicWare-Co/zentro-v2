import { type Dispatch, type SetStateAction, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	formatMoneyInput,
	parseMoneyInput,
	sanitizeMoneyInput,
} from "@/lib/utils";
import type { ActiveShift } from "../../types";
import type { ShiftCloseSummaryResultSchema } from "../../../../schemas/pos";
import type { z } from "zod";
import {
	createPaymentMethodLabelMap,
	formatCurrency,
	formatPaymentMethodLabel,
} from "../../utils";

interface CloseShiftModalProps {
	isOpen: boolean;
	onClose: () => void;
	activeShift: ActiveShift | null;
	shiftCloseSummary: z.infer<typeof ShiftCloseSummaryResultSchema> | undefined;
	isLoading: boolean;
	closureAmounts: Record<string, string>;
	setClosureAmounts: Dispatch<SetStateAction<Record<string, string>>>;
	closeShiftNotes: string;
	setCloseShiftNotes: (value: string) => void;
	hasInvalidAmounts: boolean;
	isClosing: boolean;
	error: Error | null;
	onConfirm: () => void;
}

export function CloseShiftModal({
	isOpen,
	onClose,
	activeShift,
	shiftCloseSummary,
	isLoading,
	closureAmounts,
	setClosureAmounts,
	closeShiftNotes,
	setCloseShiftNotes,
	hasInvalidAmounts,
	isClosing,
	error,
	onConfirm,
}: CloseShiftModalProps) {
	const closeShiftNotesId = useId();

	// Initialize closure amounts when summary is loaded
	useEffect(() => {
		if (!shiftCloseSummary) return;

		setClosureAmounts(
			Object.fromEntries(
				shiftCloseSummary.summaryByMethod.map((row) => [
					row.paymentMethod,
					row.actualAmount != null
						? String(row.actualAmount)
						: row.paymentMethod === "cash"
							? ""
							: String(row.expectedAmount),
				]),
			),
		);
	}, [shiftCloseSummary, setClosureAmounts]);

	const cashSummary = shiftCloseSummary?.summaryByMethod.find(
		(row) => row.paymentMethod === "cash",
	);
	const paymentMethodLabels = createPaymentMethodLabelMap(
		shiftCloseSummary?.paymentMethods ?? [],
	);
	const movementSummary = shiftCloseSummary?.movements;
	const movementItems = movementSummary?.items ?? [];
	const nonCashSummaryRows =
		shiftCloseSummary?.summaryByMethod.filter(
			(row) => row.paymentMethod !== "cash",
		) ?? [];
	const hasMovementItems = movementItems.length > 0;
	const shouldShowSeparatorBeforeTotal =
		hasMovementItems || nonCashSummaryRows.length > 0;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Cierre de Turno</DialogTitle>
				</DialogHeader>

				<div className="py-4 space-y-6">
					<div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
						<h4 className="text-sm font-medium text-gray-400 mb-3">
							Resumen del Sistema
						</h4>
						{isLoading && (
							<p className="text-sm text-gray-400">Cargando resumen...</p>
						)}
						{shiftCloseSummary && (
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-300">Base inicial</span>
									<span className="text-white font-medium tabular-nums">
										{formatCurrency(shiftCloseSummary.shift.startingCash)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-300">Efectivo esperado</span>
									<span className="text-white font-medium tabular-nums">
										{formatCurrency(cashSummary?.expectedAmount ?? 0)}
									</span>
								</div>
								{hasMovementItems ? (
									<>
										<Separator className="my-2 border-gray-700" />
										<div className="space-y-2">
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
												Movimientos de caja
											</p>
											<div className="flex justify-between">
												<span className="text-gray-300">Ingresos manuales</span>
												<span className="font-medium tabular-nums text-emerald-400">
													+
													{formatCurrency(
														shiftCloseSummary.movements.totals.inflow,
													)}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-300">Gastos operativos</span>
												<span className="font-medium tabular-nums text-red-400">
													-
													{formatCurrency(
														shiftCloseSummary.movements.totals.expense,
													)}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-300">Pagos a proveedor</span>
												<span className="font-medium tabular-nums text-red-400">
													-
													{formatCurrency(
														shiftCloseSummary.movements.totals.payout,
													)}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-300">Ajuste neto</span>
												<span
													className={`font-medium tabular-nums ${
														shiftCloseSummary.movements.totals.net >= 0
															? "text-emerald-400"
															: "text-red-400"
													}`}
												>
													{shiftCloseSummary.movements.totals.net >= 0
														? "+"
														: ""}
													{formatCurrency(
														shiftCloseSummary.movements.totals.net,
													)}
												</span>
											</div>
										</div>
									</>
								) : (
									<p className="text-xs text-gray-500">
										No hay movimientos de caja registrados en este turno.
									</p>
								)}
								{nonCashSummaryRows.length > 0 ? (
									<>
										<Separator className="my-2 border-gray-700" />
										{nonCashSummaryRows.map((row) => (
											<div
												key={`expected-${row.paymentMethod}`}
												className="flex justify-between"
											>
												<span className="text-gray-300">
													{formatPaymentMethodLabel(
														row.paymentMethod,
														paymentMethodLabels,
													)}
												</span>
												<span className="text-white font-medium tabular-nums">
													{formatCurrency(row.expectedAmount)}
												</span>
											</div>
										))}
									</>
								) : null}
								{shouldShowSeparatorBeforeTotal ? (
									<Separator className="my-2 border-gray-700" />
								) : null}
								<div className="flex justify-between text-base">
									<span className="text-gray-200 font-semibold">
										Total Esperado
									</span>
									<span className="text-[var(--color-voltage)] font-bold tabular-nums">
										{formatCurrency(shiftCloseSummary.totalExpected)}
									</span>
								</div>
							</div>
						)}
					</div>

					{hasMovementItems ? (
						<div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
							<h4 className="text-sm font-medium text-gray-400 mb-3">
								Detalle de Movimientos
							</h4>
							<div className="space-y-2">
								{movementItems.map((movement) => (
									<div
										key={`${movement.type}-${movement.paymentMethod}-${movement.createdAt}-${movement.description}`}
										className="flex items-start justify-between gap-3 rounded-md border border-gray-800/80 bg-black/20 px-3 py-2"
									>
										<div className="min-w-0">
											<p className="text-sm font-medium text-white">
												{formatMovementType(movement.type)}
											</p>
											<p className="text-xs text-gray-400">
												{formatPaymentMethodLabel(
													movement.paymentMethod,
													paymentMethodLabels,
												)}
												{" · "}
												{movement.description}
											</p>
										</div>
										<span
											className={`shrink-0 text-sm font-semibold tabular-nums ${
												movement.type === "inflow"
													? "text-emerald-400"
													: "text-red-400"
											}`}
										>
											{movement.type === "inflow" ? "+" : "-"}
											{formatCurrency(movement.amount)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}

					{shiftCloseSummary && (
						<div className="grid gap-3">
							{shiftCloseSummary.summaryByMethod.map((row) => (
								<div key={row.paymentMethod} className="grid gap-2">
									<label
										htmlFor={`closure-${row.paymentMethod}`}
										className="text-sm font-medium text-gray-300"
									>
										{formatPaymentMethodLabel(
											row.paymentMethod,
											paymentMethodLabels,
										)}{" "}
										(Esperado: {formatCurrency(row.expectedAmount)})
									</label>
									<div className="relative">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
											$
										</span>
										<Input
											id={`closure-${row.paymentMethod}`}
											type="text"
											inputMode="numeric"
											placeholder="0"
											value={formatMoneyInput(
												closureAmounts[row.paymentMethod] ?? "",
											)}
											onChange={(event) =>
												setClosureAmounts((prev) => ({
													...prev,
													[row.paymentMethod]: sanitizeMoneyInput(
														event.target.value,
													),
												}))
											}
											className="pl-7 bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)]"
										/>
									</div>
									{closureAmounts[row.paymentMethod] && (
										<div
											className={`text-sm mt-1 flex items-center justify-between tabular-nums ${
												parseMoneyInput(closureAmounts[row.paymentMethod]) -
													row.expectedAmount ===
												0
													? "text-green-400"
													: "text-red-400"
											}`}
										>
											<span>Diferencia:</span>
											<span className="font-semibold">
												{formatCurrency(
													parseMoneyInput(closureAmounts[row.paymentMethod]) -
														row.expectedAmount,
												)}
											</span>
										</div>
									)}
								</div>
							))}
						</div>
					)}

					<div className="grid gap-2">
						<label
							htmlFor={closeShiftNotesId}
							className="text-sm font-medium text-gray-300"
						>
							Notas de cierre
						</label>
						<Textarea
							id={closeShiftNotesId}
							placeholder="Opcional: explica diferencias o novedades del cierre"
							value={closeShiftNotes}
							onChange={(event) => setCloseShiftNotes(event.target.value)}
							className="min-h-[72px] bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)]"
						/>
					</div>

					{error instanceof Error && (
						<p className="text-sm text-red-400">{error.message}</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onClose}
						className="text-gray-400 hover:text-white hover:bg-gray-800"
					>
						Cancelar
					</Button>
					<Button
						onClick={onConfirm}
						disabled={
							!activeShift ||
							!shiftCloseSummary ||
							hasInvalidAmounts ||
							isLoading ||
							isClosing
						}
						className="bg-red-900/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 border border-red-900/50"
					>
						{isClosing ? "Cerrando..." : "Cerrar Turno Definitivamente"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function formatMovementType(type: string) {
	const labels: Record<string, string> = {
		inflow: "Ingreso manual",
		expense: "Gasto operativo",
		payout: "Pago a proveedor",
	};

	return labels[type] ?? type;
}
