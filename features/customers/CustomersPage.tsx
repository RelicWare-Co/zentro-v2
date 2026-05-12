import {
	Edit3,
	Loader2,
	Plus,
	Search,
	Trash2,
	Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	TableCell,
	TableHead,
	TableRow,
} from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import {
	useCreateCustomerMutation,
	useCustomersSearch,
	useDeleteCustomerMutation,
	useUpdateCustomerMutation,
	type Customer,
} from "@/features/customers/hooks/use-customers";
import { getErrorMessage } from "@/lib/utils";

const DOCUMENT_TYPE_OPTIONS = [
	{ value: "CC", label: "Cédula de ciudadanía" },
	{ value: "CE", label: "Cédula de extranjería" },
	{ value: "NIT", label: "NIT" },
	{ value: "PP", label: "Pasaporte" },
	{ value: "TI", label: "Tarjeta de identidad" },
];

const CUSTOMER_TYPE_OPTIONS = [
	{ value: "natural", label: "Natural" },
	{ value: "juridica", label: "Jurídica" },
];

type CustomerFormState = {
	name: string;
	documentType: string;
	documentNumber: string;
	phone: string;
	email: string;
	type: string;
};

const EMPTY_CUSTOMER_FORM: CustomerFormState = {
	name: "",
	documentType: "",
	documentNumber: "",
	phone: "",
	email: "",
	type: "natural",
};

function getCustomerFormInitialValue(customer: Customer | null): CustomerFormState {
	if (!customer) {
		return EMPTY_CUSTOMER_FORM;
	}
	return {
		name: customer.name,
		documentType: customer.documentType ?? "",
		documentNumber: customer.documentNumber ?? "",
		phone: customer.phone ?? "",
		email: customer.email ?? "",
		type: customer.type ?? "natural",
	};
}

export function CustomersPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
	const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

	const customersQuery = useCustomersSearch(searchQuery);
	const customers = customersQuery.data?.data ?? [];
	const total = customersQuery.data?.total ?? 0;

	const createMutation = useCreateCustomerMutation();
	const updateMutation = useUpdateCustomerMutation();
	const deleteMutation = useDeleteCustomerMutation();

	const formError = createMutation.error ?? updateMutation.error;

	const openCreate = () => {
		setEditingCustomer(null);
		setIsSheetOpen(true);
	};

	const openEdit = (customer: Customer) => {
		setEditingCustomer(customer);
		setIsSheetOpen(true);
	};

	if (customersQuery.isPending) {
		return (
			<div className="flex min-h-[60dvh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (customersQuery.isError) {
		return (
			<div className="mx-auto max-w-3xl p-6 md:p-8">
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>No se pudieron cargar los clientes</AlertTitle>
					<AlertDescription className="flex flex-col gap-3">
						{getErrorMessage(
							customersQuery.error,
							"Intenta recargar la página.",
						)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => void customersQuery.refetch()}
							className="mt-1 w-fit border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
						>
							Reintentar
						</Button>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
			<section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
						<Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
							{total} clientes
						</Badge>
					</div>
					<p className="text-sm text-gray-400">
						Gestiona tus clientes y sus datos de contacto.
					</p>
				</div>
				<Button
					type="button"
					onClick={openCreate}
					className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
				>
					<Plus className="h-4 w-4" />
					Crear cliente
				</Button>
			</section>

			<div className="relative w-full sm:max-w-sm">
				<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
				<Input
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder="Buscar por nombre, teléfono, documento o email…"
					className="border-gray-800 bg-black/20 pl-9"
				/>
			</div>

			<VirtualTable
				data={customers}
				header={
					<TableRow className="border-gray-800 hover:bg-transparent">
						<TableHead className="px-4 text-gray-400">Nombre</TableHead>
						<TableHead className="text-gray-400">Documento</TableHead>
						<TableHead className="text-gray-400">Teléfono</TableHead>
						<TableHead className="text-gray-400">Email</TableHead>
						<TableHead className="text-right text-gray-400">Acciones</TableHead>
					</TableRow>
				}
				renderRow={(customer) => (
					<>
						<TableCell className="px-4">
							<div className="min-w-0">
								<p className="truncate font-medium text-white">{customer.name}</p>
								{customer.type ? (
									<Badge
										variant="outline"
										className="mt-1 border-gray-700 bg-gray-800/80 text-gray-300"
									>
										{customer.type === "juridica" ? "Jurídica" : "Natural"}
									</Badge>
								) : null}
							</div>
						</TableCell>
						<TableCell className="text-sm text-gray-300">
							{customer.documentType && customer.documentNumber ? (
								<span>{customer.documentType} {customer.documentNumber}</span>
							) : customer.documentNumber ? (
								<span>{customer.documentNumber}</span>
							) : (
								<span className="text-gray-500">—</span>
							)}
						</TableCell>
						<TableCell className="text-sm text-gray-300">
							{customer.phone ?? <span className="text-gray-500">—</span>}
						</TableCell>
						<TableCell className="text-sm text-gray-300">
							{customer.email ?? <span className="text-gray-500">—</span>}
						</TableCell>
						<TableCell className="text-right">
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => openEdit(customer)}
									className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
								>
									<Edit3 className="h-3.5 w-3.5" />
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => setCustomerToDelete(customer)}
									className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						</TableCell>
						</>
				)}
				getItemKey={(customer) => customer.id}
				estimateSize={72}
				maxHeight={600}
				emptyState={
					customers.length === 0 ? (
						<div className="flex flex-col items-center gap-3 p-10 text-center">
							<Users className="h-8 w-8 text-gray-600" />
							<p className="text-sm text-gray-500">
								{searchQuery.trim()
									? "No hay clientes que coincidan con la búsqueda."
									: "Aún no hay clientes registrados."}
							</p>
							{!searchQuery.trim() ? (
								<Button
									type="button"
									variant="outline"
									onClick={openCreate}
									className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
								>
									<Plus className="mr-2 h-4 w-4" />
									Crear cliente
								</Button>
							) : null}
						</div>
					) : null
				}
			/><CustomerFormSheet
				open={isSheetOpen}
				onOpenChange={(open) => {
					setIsSheetOpen(open);
					if (!open) setEditingCustomer(null);
				}}
				customer={editingCustomer}
				isPending={createMutation.isPending || updateMutation.isPending}
				error={formError}
				onSave={async (payload) => {
					if (payload.id) {
						await updateMutation.mutateAsync({
							id: payload.id,
							...payload,
						});
						setIsSheetOpen(false);
						setEditingCustomer(null);
					} else {
						await createMutation.mutateAsync(payload);
						setIsSheetOpen(false);
						setEditingCustomer(null);
					}
				}}
			/>

			<AlertDialog
				open={Boolean(customerToDelete)}
				onOpenChange={(open) => {
					if (!open) setCustomerToDelete(null);
				}}
			>
				<AlertDialogContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
					<AlertDialogHeader>
						<AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							{customerToDelete?.name} será removido de la lista activa.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5">
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (customerToDelete) {
									void deleteMutation.mutateAsync({
										id: customerToDelete.id,
									});
								}
								setCustomerToDelete(null);
							}}
							className="bg-red-500 text-white hover:bg-red-600"
						>
							{deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}

function CustomerFormSheet({
	open,
	onOpenChange,
	customer,
	isPending,
	error,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customer: Customer | null;
	isPending: boolean;
	error: unknown;
	onSave: (payload: {
		id?: string;
		name: string;
		documentType: string | null;
		documentNumber: string | null;
		phone: string | null;
		email: string | null;
		type: string | null;
	}) => Promise<void>;
}) {
	return (
		<CustomerFormSheetContent
			key={open ? (customer?.id ?? "new") : "closed"}
			open={open}
			onOpenChange={onOpenChange}
			customer={customer}
			isPending={isPending}
			error={error}
			onSave={onSave}
		/>
	);
}

function CustomerFormSheetContent({
	open,
	onOpenChange,
	customer,
	isPending,
	error,
	onSave,
}: Parameters<typeof CustomerFormSheet>[0]) {
	const [form, setForm] = useState(() => getCustomerFormInitialValue(customer));

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await onSave({
			...(customer ? { id: customer.id } : {}),
			name: form.name,
			documentType: form.documentType || null,
			documentNumber: form.documentNumber || null,
			phone: form.phone || null,
			email: form.email || null,
			type: form.type || null,
		});
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="!w-full !max-w-full overflow-hidden border-l border-gray-800 bg-[var(--color-carbon)] p-0 text-white sm:!w-[540px]">
				<form onSubmit={handleSubmit} className="flex h-full flex-col">
					<SheetHeader className="shrink-0 border-b border-gray-800 p-6">
						<SheetTitle className="text-2xl font-bold">
							{customer ? "Editar cliente" : "Crear cliente"}
						</SheetTitle>
						<SheetDescription className="text-gray-400">
							Datos de contacto e identificación.
						</SheetDescription>
					</SheetHeader>

					<div className="flex-1 space-y-6 overflow-y-auto p-6">
						<div className="grid gap-4">
							<Field label="Nombre" required>
								<Input
									value={form.name}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
									required
								/>
							</Field>
							<Field label="Tipo de cliente">
								<Select
									value={form.type || "natural"}
									onValueChange={(value) =>
										setForm((current) => ({
											...current,
											type: value,
										}))
									}
								>
									<SelectTrigger className="w-full border-gray-700 bg-black/20 text-white">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
										{CUSTOMER_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Tipo de documento">
								<Select
									value={form.documentType || "none"}
									onValueChange={(value) =>
										setForm((current) => ({
											...current,
											documentType: value === "none" ? "" : value,
										}))
									}
								>
									<SelectTrigger className="w-full border-gray-700 bg-black/20 text-white">
										<SelectValue placeholder="Sin documento" />
									</SelectTrigger>
									<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
										<SelectItem value="none">Sin documento</SelectItem>
										{DOCUMENT_TYPE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Número de documento">
								<Input
									value={form.documentNumber}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											documentNumber: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							<Field label="Teléfono">
								<Input
									type="tel"
									value={form.phone}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											phone: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
							<Field label="Correo electrónico">
								<Input
									type="email"
									value={form.email}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											email: event.target.value,
										}))
									}
									className="border-gray-700 bg-black/20"
								/>
							</Field>
						</div>

						{error ? (
							<p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm font-medium text-red-300">
								{getErrorMessage(error, "No se pudo guardar el cliente.")}
							</p>
						) : null}
					</div>

					<SheetFooter className="shrink-0 border-t border-gray-800 bg-black/30 p-6">
						<Button
							type="submit"
							disabled={isPending || !form.name.trim()}
							className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
						>
							{isPending ? "Guardando…" : "Guardar cliente"}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}

function Field({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>
				{label}
				{required ? <span className="text-red-400"> *</span> : null}
			</Label>
			{children}
		</div>
	);
}
