import { useId } from "react";
import { Button } from "@/components/ui/button";
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
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";
import type { CashMovementType } from "../../types";

interface CashMovementModalProps {
	isOpen: boolean;
	onClose: () => void;
	movementType: string;
	setMovementType: (value: CashMovementType) => void;
	movementPaymentMethod: string;
	setMovementPaymentMethod: (value: string) => void;
	paymentMethodOptions: Array<{ id: string; label: string }>;
	movementAmount: string;
	setMovementAmount: (value: string) => void;
	movementDescription: string;
	setMovementDescription: (value: string) => void;
	canRegister: boolean;
	isRegistering: boolean;
	hasActiveShift: boolean;
	error: Error | null;
	onConfirm: () => void;
}

export function CashMovementModal({
	isOpen,
	onClose,
	movementType,
	setMovementType,
	movementPaymentMethod,
	setMovementPaymentMethod,
	paymentMethodOptions,
	movementAmount,
	setMovementAmount,
	movementDescription,
	setMovementDescription,
	canRegister,
	isRegistering,
	hasActiveShift,
	error,
	onConfirm,
}: CashMovementModalProps) {
	const movementTypeId = useId();
	const movementPaymentMethodId = useId();
	const movementAmountId = useId();
	const movementDescriptionId = useId();

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Movimiento del Turno</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					{!hasActiveShift && (
						<p className="text-sm text-red-400">
							Debes abrir un turno antes de registrar movimientos.
						</p>
						)}

					<div className="grid gap-2">
						<label
							htmlFor={movementTypeId}
							className="text-sm font-medium text-gray-300"
						>
							Tipo de Movimiento
						</label>
						<Select
							value={movementType}
							onValueChange={(value) =>
								setMovementType(value as CashMovementType)
							}
						>
							<SelectTrigger
								id={movementTypeId}
								className="h-10 w-full rounded-md border border-gray-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-[var(--color-voltage)] focus:ring-2"
							>
								<SelectValue placeholder="Tipo de Movimiento" />
							</SelectTrigger>
							<SelectContent className="bg-[#0a0a0a] border-gray-800 text-white">
								<SelectItem value="inflow">Ingreso (Entrada manual)</SelectItem>
								<SelectItem value="expense">Gasto Operativo</SelectItem>
								<SelectItem value="payout">Pago a Proveedor</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<label
							htmlFor={movementPaymentMethodId}
							className="text-sm font-medium text-gray-300"
						>
							Método Afectado
						</label>
						<Select
							value={movementPaymentMethod}
							onValueChange={setMovementPaymentMethod}
						>
							<SelectTrigger
								id={movementPaymentMethodId}
								className="h-10 w-full rounded-md border border-gray-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-[var(--color-voltage)] focus:ring-2"
							>
								<SelectValue placeholder="Método de Pago" />
							</SelectTrigger>
							<SelectContent className="bg-[#0a0a0a] border-gray-800 text-white">
								{paymentMethodOptions.map((paymentMethod) => (
									<SelectItem key={paymentMethod.id} value={paymentMethod.id}>
										{paymentMethod.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<label
							htmlFor={movementAmountId}
							className="text-sm font-medium text-gray-300"
						>
							Monto
						</label>
						<Input
							id={movementAmountId}
							type="text"
							inputMode="numeric"
							placeholder="0"
							value={formatMoneyInput(movementAmount)}
							onChange={(e) =>
								setMovementAmount(sanitizeMoneyInput(e.target.value))
							}
							className="bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)]"
						/>
					</div>

					<div className="grid gap-2">
						<label
							htmlFor={movementDescriptionId}
							className="text-sm font-medium text-gray-300"
						>
							Descripción
						</label>
						<Input
							id={movementDescriptionId}
							placeholder="Ej. Pago de internet, Base adicional..."
							value={movementDescription}
							onChange={(e) => setMovementDescription(e.target.value)}
							className="bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)]"
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
						disabled={!canRegister || isRegistering}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						{isRegistering ? "Registrando..." : "Registrar Movimiento"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
