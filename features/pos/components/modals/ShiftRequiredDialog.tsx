import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface ShiftRequiredDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onOpenShift: () => void;
}

export function ShiftRequiredDialog({
	isOpen,
	onClose,
	onOpenShift,
}: ShiftRequiredDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[420px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
							<AlertCircle className="h-5 w-5" />
						</div>
						<div className="space-y-1">
							<DialogTitle>Turno cerrado</DialogTitle>
							<DialogDescription className="text-gray-400">
								Debes tener un turno abierto para poder vender productos.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
					Abre el turno de caja antes de intentar agregar productos al carrito.
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onClose}
						className="text-gray-400 hover:text-white hover:bg-gray-800"
					>
						Entendido
					</Button>
					<Button
						onClick={onOpenShift}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						Abrir turno
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
