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

interface CreateCustomerModalProps {
	isOpen: boolean;
	onClose: () => void;
	name: string;
	setName: (value: string) => void;
	phone: string;
	setPhone: (value: string) => void;
	documentType: string;
	setDocumentType: (value: string) => void;
	documentNumber: string;
	setDocumentNumber: (value: string) => void;
	canCreate: boolean;
	isCreating: boolean;
	error: Error | null;
	onConfirm: () => void;
}

export function CreateCustomerModal({
	isOpen,
	onClose,
	name,
	setName,
	phone,
	setPhone,
	documentType,
	setDocumentType,
	documentNumber,
	setDocumentNumber,
	canCreate,
	isCreating,
	error,
	onConfirm,
}: CreateCustomerModalProps) {
	const customerNameId = useId();
	const customerPhoneId = useId();
	const customerDocumentTypeId = useId();
	const customerDocumentNumberId = useId();

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="bg-[#151515] border-gray-800 text-white sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Crear cliente rápido</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="grid gap-2">
						<label
							htmlFor={customerNameId}
							className="text-sm font-medium text-gray-300"
						>
							Nombre
						</label>
						<Input
							id={customerNameId}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Nombre del cliente"
							className="bg-[#0a0a0a] border-gray-800 text-white"
						/>
					</div>

					<div className="grid gap-2">
						<label
							htmlFor={customerPhoneId}
							className="text-sm font-medium text-gray-300"
						>
							Teléfono
						</label>
						<Input
							id={customerPhoneId}
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							placeholder="Opcional"
							className="bg-[#0a0a0a] border-gray-800 text-white"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-2">
							<label
								htmlFor={customerDocumentTypeId}
								className="text-sm font-medium text-gray-300"
							>
								Tipo doc
							</label>
							<Select value={documentType} onValueChange={setDocumentType}>
								<SelectTrigger
									id={customerDocumentTypeId}
									className="h-10 w-full rounded-md border border-gray-800 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:ring-[var(--color-voltage)] focus:ring-2"
								>
									<SelectValue placeholder="Tipo doc" />
								</SelectTrigger>
								<SelectContent className="bg-[#0a0a0a] border-gray-800 text-white">
									<SelectItem value="CC">CC</SelectItem>
									<SelectItem value="NIT">NIT</SelectItem>
									<SelectItem value="CE">CE</SelectItem>
									<SelectItem value="PAS">Pasaporte</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<label
								htmlFor={customerDocumentNumberId}
								className="text-sm font-medium text-gray-300"
							>
								Número doc
							</label>
							<Input
								id={customerDocumentNumberId}
								value={documentNumber}
								onChange={(event) => setDocumentNumber(event.target.value)}
								placeholder="Opcional"
								className="bg-[#0a0a0a] border-gray-800 text-white"
							/>
						</div>
					</div>

					{error instanceof Error && (
						<p className="text-sm text-red-400">{error.message}</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onClose}
						className="text-gray-400 hover:text-white"
					>
						Cancelar
					</Button>
					<Button
						onClick={onConfirm}
						disabled={!canCreate || isCreating}
						className="bg-[var(--color-voltage)] text-black hover:bg-[#c9e605]"
					>
						{isCreating ? "Creando..." : "Crear cliente"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
