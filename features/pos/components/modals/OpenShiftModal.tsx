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
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyInput, sanitizeMoneyInput } from "@/lib/utils";

interface OpenShiftModalProps {
	isOpen: boolean;
	onClose: () => void;
	startingCash: string;
	setStartingCash: (value: string) => void;
	openShiftNotes: string;
	setOpenShiftNotes: (value: string) => void;
	canOpenShift: boolean;
	isOpening: boolean;
	error: Error | null;
	onConfirm: () => void;
}

export function OpenShiftModal({
	isOpen,
	onClose,
	startingCash,
	setStartingCash,
	openShiftNotes,
	setOpenShiftNotes,
	canOpenShift,
	isOpening,
	error,
	onConfirm,
}: OpenShiftModalProps) {
	const startingCashId = useId();
	const openShiftNotesId = useId();

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>Apertura de Turno</DialogTitle>
				</DialogHeader>

				<div className="py-4">
					<p className="text-sm text-gray-400 mb-4">
						Ingresa la base de efectivo inicial en la caja para comenzar a
						operar.
					</p>

					<div className="grid gap-2">
						<label
							htmlFor={startingCashId}
							className="text-sm font-medium text-gray-300"
						>
							Base en Efectivo
						</label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
								$
							</span>
							<Input
								id={startingCashId}
								type="text"
								inputMode="numeric"
								placeholder="0"
								value={formatMoneyInput(startingCash)}
								onChange={(e) =>
									setStartingCash(sanitizeMoneyInput(e.target.value))
								}
								className="pl-7 bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)] text-lg h-12"
							/>
						</div>
					</div>

					<div className="grid gap-2 mt-4">
						<label
							htmlFor={openShiftNotesId}
							className="text-sm font-medium text-gray-300"
						>
							Notas del turno
						</label>
						<Textarea
							id={openShiftNotesId}
							placeholder="Opcional: observaciones de apertura"
							value={openShiftNotes}
							onChange={(event) => setOpenShiftNotes(event.target.value)}
							className="min-h-[72px] bg-[#0a0a0a] border-gray-800 text-white focus-visible:ring-[var(--color-voltage)]"
						/>
					</div>

					{error instanceof Error && (
						<p className="text-sm text-red-400 mt-3">{error.message}</p>
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
						disabled={!canOpenShift || isOpening}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						{isOpening ? "Abriendo..." : "Abrir Turno"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
