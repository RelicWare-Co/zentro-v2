import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PosCustomer } from "../types";

interface CustomerPickerProps {
	customers: PosCustomer[];
	selectedCustomerId: string;
	onCustomerChange: (customerId: string) => void;
	buttonClassName?: string;
	contentClassName?: string;
	searchPlaceholder?: string;
}

export function CustomerPicker({
	customers,
	selectedCustomerId,
	onCustomerChange,
	buttonClassName,
	contentClassName,
	searchPlaceholder = "Buscar por nombre, documento o teléfono...",
}: CustomerPickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedCustomer = useMemo(
		() =>
			customers.find((customer) => customer.id === selectedCustomerId) ?? null,
		[customers, selectedCustomerId],
	);
	const selectedCustomerLabel = selectedCustomer?.name ?? "Cliente Mostrador";
	const selectedCustomerMeta = selectedCustomer
		? [
				selectedCustomer.documentNumber,
				selectedCustomer.phone,
				selectedCustomer.email,
			]
				.filter(Boolean)
				.join(" · ")
		: "Venta rápida sin cliente asociado";

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					role="combobox"
					aria-expanded={isOpen}
					className={cn(
						"h-11 min-w-0 justify-between rounded-lg border border-gray-800 bg-[#101010] px-3 py-2 text-left text-sm text-white hover:bg-[#151515] hover:text-white",
						buttonClassName,
					)}
				>
					<span className="min-w-0">
						<span className="block truncate">{selectedCustomerLabel}</span>
						<span className="block truncate text-xs text-gray-500">
							{selectedCustomerMeta}
						</span>
					</span>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={cn(
					"w-[min(360px,calc(100vw-2rem))] border-gray-800 bg-[var(--color-carbon)] p-0 text-white",
					contentClassName,
				)}
			>
				<Command className="bg-transparent">
					<CommandInput
						placeholder={searchPlaceholder}
						className="text-white placeholder:text-gray-500"
					/>
					<CommandList className="p-1.5">
						<CommandEmpty className="text-gray-400">
							No se encontraron clientes.
						</CommandEmpty>
						<CommandItem
							value="mostrador cliente mostrador venta rápida"
							onSelect={() => {
								onCustomerChange("");
								setIsOpen(false);
							}}
							className="gap-3 rounded-lg py-3 text-white"
						>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="truncate font-medium">Cliente Mostrador</p>
								<p className="truncate text-xs text-gray-400">
									Venta rápida sin cliente asociado
								</p>
							</div>
							<Check
								className={cn(
									"h-4 w-4 shrink-0",
									selectedCustomerId === "" ? "opacity-100" : "opacity-0",
								)}
							/>
						</CommandItem>
						{customers.map((customer) => (
							<CommandItem
								key={customer.id}
								value={`${customer.name} ${customer.documentNumber ?? ""} ${customer.phone ?? ""} ${customer.email ?? ""}`}
								onSelect={() => {
									onCustomerChange(customer.id);
									setIsOpen(false);
								}}
								className="gap-3 rounded-lg py-3 text-white"
							>
								<div className="min-w-0 flex-1 space-y-1">
									<p className="truncate font-medium">{customer.name}</p>
									<p className="truncate text-xs text-gray-400">
										{[customer.documentNumber, customer.phone, customer.email]
											.filter(Boolean)
											.join(" · ") || "Sin datos adicionales"}
									</p>
								</div>
								<Check
									className={cn(
										"h-4 w-4 shrink-0",
										selectedCustomerId === customer.id
											? "opacity-100"
											: "opacity-0",
									)}
								/>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
