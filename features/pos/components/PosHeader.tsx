import { ArrowLeftRight, Lock, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ActiveShift, PosCustomer } from "../types";
import { CustomerPicker } from "./CustomerPicker";

interface PosHeaderProps {
	activeShift: ActiveShift | null;
	defaultTerminalName: string;
	customers: PosCustomer[];
	selectedCustomerId: string;
	onCustomerChange: (customerId: string) => void;
	onOpenShift: () => void;
	onCashMovement: () => void;
	onOpenDrawer: () => void;
	onCloseShift: () => void;
	onCreateCustomer: () => void;
}

export function PosHeader({
	activeShift,
	defaultTerminalName,
	customers,
	selectedCustomerId,
	onCustomerChange,
	onOpenShift,
	onCashMovement,
	onOpenDrawer,
	onCloseShift,
	onCreateCustomer,
}: PosHeaderProps) {
	return (
		<header className="z-10 shrink-0 border-b border-gray-800 bg-[var(--color-carbon)] px-3 py-3 md:px-4 md:py-2">
			<div className="flex min-h-10 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
					<div className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap">
						<span
							className={`w-2.5 h-2.5 rounded-full ${
								activeShift
									? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
									: "bg-gray-500"
								}`}
						/>
						<span className="font-semibold text-white">
							{activeShift?.terminalName || defaultTerminalName}
						</span>
						<span className="text-gray-400 text-xs px-1.5 py-0.5 bg-gray-800 rounded-md">
							{activeShift ? "Abierto" : "Cerrado"}
						</span>
					</div>

					<Separator
						orientation="vertical"
						className="hidden h-5 border-gray-700 md:block"
					/>

					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 transition-colors focus-within:border-[var(--color-voltage)] focus-within:ring-1 focus-within:ring-[var(--color-voltage)]/20">
						<CustomerPicker
							customers={customers}
							selectedCustomerId={selectedCustomerId}
							onCustomerChange={onCustomerChange}
							buttonClassName="h-auto min-h-7 flex-1 border-0 bg-transparent px-0 py-0 hover:bg-transparent"
							contentClassName="w-[min(320px,calc(100vw-2rem))]"
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCreateCustomer}
							className="h-7 shrink-0 px-2 text-xs text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10 hover:text-[var(--color-voltage)]"
						>
							<Plus className="mr-1 h-3.5 w-3.5" />
							Cliente
						</Button>
					</div>
				</div>

				<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
					{!activeShift && (
						<Button
							variant="outline"
							size="sm"
							onClick={onOpenShift}
							className="col-span-2 h-9 whitespace-nowrap border-[var(--color-voltage)]/40 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] transition-all hover:bg-[var(--color-voltage)]/20 sm:col-span-1"
						>
							Abrir Turno
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={onCashMovement}
						disabled={!activeShift}
						className="h-9 whitespace-nowrap border-gray-700 bg-gray-900/50 text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-800 hover:text-white"
					>
						<ArrowLeftRight className="h-4 w-4 sm:mr-2" />
						<span className="sm:hidden">Caja</span>
						<span className="hidden sm:inline">Movimiento de Caja</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onOpenDrawer}
						disabled={!activeShift}
						className="h-9 whitespace-nowrap border-gray-700 bg-gray-900/50 text-gray-300 transition-all hover:border-gray-600 hover:bg-gray-800 hover:text-white"
					>
						<Printer className="h-4 w-4 sm:mr-2" />
						<span className="sm:hidden">Abrir</span>
						<span className="hidden sm:inline">Abrir Caja</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onCloseShift}
						disabled={!activeShift}
						className="h-9 whitespace-nowrap border-red-900/30 bg-red-900/10 text-red-400 transition-all hover:border-red-900/50 hover:bg-red-900/30 hover:text-red-300"
					>
						<Lock className="h-4 w-4 sm:mr-2" />
						<span className="sm:hidden">Turno</span>
						<span className="hidden sm:inline">Cerrar Turno</span>
					</Button>
				</div>
			</div>
		</header>
	);
}
