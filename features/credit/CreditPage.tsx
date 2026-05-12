import {
	CalendarClock,
	History,
	Loader2,
	Plus,
	Receipt,
	Search,
	Wallet,
} from "lucide-react";
import { useId, useState, type FormEvent } from "react";
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
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	TableCell,
	TableHead,
	TableRow,
} from "@/components/ui/table";
import { VirtualTable } from "@/components/ui/virtual-table";
import { VirtualList } from "@/components/ui/virtual-list";
import {
	useActiveShift,
	useCreditAccountsSearch,
	useCreditTransactions,
	useOrganizationSettings,
	useRegisterCreditPaymentMutation,
	type CreditAccount,
	type CreditTransaction,
} from "@/features/credit/hooks/use-credit";
import { getErrorMessage } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

function formatTransactionType(type: string) {
	if (type === "charge") return "Cargo";
	if (type === "payment") return "Abono";
	if (type === "interest") return "Interés";
	return type;
}

function getTransactionTypeBadgeClass(type: string) {
	if (type === "charge")
		return "border-rose-500/20 bg-rose-500/10 text-rose-300";
	if (type === "payment")
		return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
	if (type === "interest")
		return "border-amber-500/20 bg-amber-500/10 text-amber-300";
	return "border-gray-700 bg-gray-800/80 text-gray-300";
}

export function CreditPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedAccount, setSelectedAccount] = useState<CreditAccount | null>(
		null,
	);
	const [isLedgerOpen, setIsLedgerOpen] = useState(false);
	const [isPaymentOpen, setIsPaymentOpen] = useState(false);

	const accountsQuery = useCreditAccountsSearch(searchQuery);
	const accounts = accountsQuery.data?.data ?? [];
	const totalAccounts = accountsQuery.data?.total ?? 0;
	const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

	const transactionsQuery = useCreditTransactions(
		isLedgerOpen ? selectedAccount?.id ?? null : null,
	);
	const transactions = (transactionsQuery.data?.data ?? []) as CreditTransaction[];

	const activeShiftQuery = useActiveShift();
	const activeShift = activeShiftQuery.data?.shift ?? null;

	const settingsQuery = useOrganizationSettings();
	const paymentMethods =
		settingsQuery.data?.settings.pos.paymentMethods.filter((m) => m.enabled) ??
		[];

	const registerPaymentMutation = useRegisterCreditPaymentMutation();

	const openLedger = (account: CreditAccount) => {
		setSelectedAccount(account);
		setIsLedgerOpen(true);
	};

	if (accountsQuery.isPending) {
		return (
			<div className="flex min-h-[60dvh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-[var(--color-voltage)]" />
			</div>
		);
	}

	if (accountsQuery.isError) {
		return (
			<div className="mx-auto max-w-3xl p-6 md:p-8">
				<Alert
					variant="destructive"
					className="border-red-500/20 bg-red-500/10 text-red-100"
				>
					<AlertTitle>No se pudieron cargar las cuentas de crédito</AlertTitle>
					<AlertDescription>
						{getErrorMessage(
							accountsQuery.error,
							"Intenta recargar la página.",
						)}
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
						<h1 className="text-3xl font-bold tracking-tight">Crédito</h1>
						<Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
							{totalAccounts} cuentas
						</Badge>
					</div>
					<p className="text-sm text-gray-400">
						Saldo total pendiente:{" "}
						<span className="font-semibold text-[var(--color-voltage)]">
							{currencyFormatter.format(totalBalance)}
						</span>
					</p>
				</div>
			</section>

			<div className="relative w-full sm:max-w-sm">
				<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
				<Input
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder="Buscar por nombre, documento o teléfono…"
					className="border-gray-800 bg-black/20 pl-9"
				/>
			</div>

			<VirtualTable
				data={accounts}
				header={
					<TableRow className="border-gray-800 hover:bg-transparent">
						<TableHead className="px-4 text-gray-400">Cliente</TableHead>
						<TableHead className="text-gray-400">Documento</TableHead>
						<TableHead className="text-gray-400">Teléfono</TableHead>
						<TableHead className="text-right text-gray-400">Saldo pendiente</TableHead>
						<TableHead className="text-right text-gray-400">Acciones</TableHead>
					</TableRow>
				}
				renderRow={(account) => (
					<>
						<TableCell className="px-4">
							<div className="min-w-0">
								<p className="truncate font-medium text-white">{account.customerName}</p>
							</div>
						</TableCell>
						<TableCell className="text-sm text-gray-300">
							{account.customerDocument ?? <span className="text-gray-500">—</span>}
						</TableCell>
						<TableCell className="text-sm text-gray-300">
							{account.customerPhone ?? <span className="text-gray-500">—</span>}
						</TableCell>
						<TableCell className="text-right">
							<p className={`font-semibold tabular-nums ${account.balance > 0 ? "text-[var(--color-voltage)]" : "text-gray-400"}`}>
								{currencyFormatter.format(account.balance)}
							</p>
						</TableCell>
						<TableCell className="text-right">
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => openLedger(account)}
									className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5"
								>
									<History className="h-3.5 w-3.5" />
									<span className="sr-only">Ver historial</span>
								</Button>
								{account.balance > 0 ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											setSelectedAccount(account);
											setIsPaymentOpen(true);
										}}
										className="border-emerald-500/30 bg-transparent text-emerald-200 hover:bg-emerald-500/10"
									>
										<Plus className="h-3.5 w-3.5" />
										<span className="sr-only">Registrar abono</span>
									</Button>
								) : null}
							</div>
						</TableCell>
						</>
					)}
					getItemKey={(account) => account.id}
					estimateSize={64}
					maxHeight={600}
					emptyState={
						accounts.length === 0 ? (
							<div className="flex flex-col items-center gap-3 p-10 text-center">
								<Wallet className="h-8 w-8 text-gray-600" />
								<p className="text-sm text-gray-500">
									{searchQuery.trim()
										? "No hay cuentas que coincidan con la búsqueda."
										: "Aún no hay cuentas de crédito registradas."}
								</p>
							</div>
						) : null
					}
				/><Sheet open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
				<SheetContent className="!w-full !max-w-full overflow-hidden border-l border-gray-800 bg-[var(--color-carbon)] p-0 text-white sm:!w-[640px]">
					<div className="flex h-full flex-col">
						<SheetHeader className="shrink-0 border-b border-gray-800 p-6">
							<SheetTitle className="text-2xl font-bold">
								Historial de crédito
							</SheetTitle>
							<SheetDescription className="text-gray-400">
								{selectedAccount?.customerName} — Saldo pendiente:{" "}
								<span className="font-semibold text-[var(--color-voltage)]">
									{currencyFormatter.format(
										selectedAccount?.balance ?? 0,
									)}
								</span>
							</SheetDescription>
						</SheetHeader>

						<div className="flex-1 overflow-hidden p-6">
							{transactionsQuery.isLoading ? (
								<div className="flex items-center justify-center py-12">
									<Loader2 className="h-6 w-6 animate-spin text-[var(--color-voltage)]" />
								</div>
							) : transactions.length > 0 ? (
								<VirtualList
									data={transactions}
									renderItem={(tx) => (
										<div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/10 p-4">
											<div className="min-w-0 space-y-1">
												<div className="flex items-center gap-2">
													<Badge
														className={`${getTransactionTypeBadgeClass(tx.type)} px-2 py-0.5 text-xs border-0`}
													>
														{formatTransactionType(tx.type)}
													</Badge>
													{tx.saleId ? (
														<span className="text-xs text-gray-500">
															<Receipt className="inline h-3 w-3" />{" "}
															{tx.saleId.slice(0, 8)}…
														</span>
													) : null}
												</div>
												{tx.notes ? (
													<p className="text-sm text-gray-400">
														{tx.notes}
													</p>
												) : null}
												<p className="text-xs text-gray-500">
													{dateTimeFormatter.format(tx.createdAt)}
												</p>
											</div>
											<div className="shrink-0 pl-4 text-right">
												<p
													className={`font-semibold tabular-nums ${tx.type === "payment" ? "text-emerald-300" : tx.type === "charge" ? "text-rose-300" : "text-amber-300"}`}
												>
													{tx.type === "payment" ? "-" : "+"}
													{currencyFormatter.format(tx.amount)}
												</p>
											</div>
										</div>
									)}
									getItemKey={(tx) => tx.id}
									estimateSize={80}
									gap={12}
									className="h-full"
								/>
							) : (
								<div className="flex flex-col items-center gap-3 py-12 text-center">
									<History className="h-8 w-8 text-gray-600" />
									<p className="text-sm text-gray-500">
										No hay movimientos registrados.
									</p>
								</div>
							)}
						</div><div className="shrink-0 border-t border-gray-800 bg-black/30 p-4">
							<Button
								type="button"
								onClick={() => {
									setIsLedgerOpen(false);
									if (selectedAccount && selectedAccount.balance > 0) {
										setIsPaymentOpen(true);
									}
								}}
								disabled={
									!selectedAccount || selectedAccount.balance <= 0
								}
								className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
							>
								<Plus className="mr-2 h-4 w-4" />
								Registrar abono
							</Button>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			<PaymentFormSheet
				open={isPaymentOpen}
				onOpenChange={setIsPaymentOpen}
				account={selectedAccount}
				activeShift={activeShift}
				paymentMethods={paymentMethods}
				isPending={registerPaymentMutation.isPending}
				error={registerPaymentMutation.error}
				onSubmit={async (payload) => {
					if (!selectedAccount || !activeShift) return;
					await registerPaymentMutation.mutateAsync({
						shiftId: activeShift.id,
						creditAccountId: selectedAccount.id,
						amount: payload.amount,
						method: payload.method,
						saleId: payload.saleId || null,
						reference: payload.reference || null,
						notes: payload.notes || null,
					});
					setIsPaymentOpen(false);
				}}
			/>
		</main>
	);
}

function PaymentFormSheet({
	open,
	onOpenChange,
	account,
	activeShift,
	paymentMethods,
	isPending,
	error,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: CreditAccount | null;
	activeShift: { id: string; terminalName: string | null } | null;
	paymentMethods: Array<{ id: string; label: string; requiresReference: boolean }>;
	isPending: boolean;
	error: unknown;
	onSubmit: (payload: {
		amount: number;
		method: string;
		saleId: string;
		reference: string;
		notes: string;
	}) => Promise<void>;
}) {
	return (
		<PaymentFormSheetContent
			key={open ? (account?.id ?? "new") : "closed"}
			open={open}
			onOpenChange={onOpenChange}
			account={account}
			activeShift={activeShift}
			paymentMethods={paymentMethods}
			isPending={isPending}
			error={error}
			onSubmit={onSubmit}
		/>
	);
}

function PaymentFormSheetContent({
	open,
	onOpenChange,
	account,
	activeShift,
	paymentMethods,
	isPending,
	error,
	onSubmit,
}: Parameters<typeof PaymentFormSheet>[0]) {
	const [amount, setAmount] = useState("");
	const [method, setMethod] = useState("");
	const [saleId, setSaleId] = useState("");
	const [reference, setReference] = useState("");
	const [notes, setNotes] = useState("");
	const amountId = useId();
	const methodId = useId();
	const saleIdInputId = useId();
	const referenceId = useId();
	const notesId = useId();

	const maxAmount = account?.balance ?? 0;
	const parsedAmount = Number.isFinite(Number(amount)) ? Math.max(0, Math.round(Number(amount))) : 0;
	const isOverpayment = parsedAmount > maxAmount;
	const isValidAmount = parsedAmount > 0 && !isOverpayment;
	const selectedMethod = paymentMethods.find((m) => m.id === method);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isValidAmount || !method || !activeShift) return;
		await onSubmit({
			amount: parsedAmount,
			method,
			saleId,
			reference,
			notes,
		});
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="!w-full !max-w-full overflow-hidden border-l border-gray-800 bg-[var(--color-carbon)] p-0 text-white sm:!w-[480px]">
				<form onSubmit={handleSubmit} className="flex h-full flex-col">
					<SheetHeader className="shrink-0 border-b border-gray-800 p-6">
						<SheetTitle className="text-2xl font-bold">
							Registrar abono
						</SheetTitle>
						<SheetDescription className="text-gray-400">
							{account?.customerName} — Saldo pendiente:{" "}
							<span className="font-semibold text-[var(--color-voltage)]">
								{currencyFormatter.format(account?.balance ?? 0)}
							</span>
						</SheetDescription>
					</SheetHeader>

					<div className="flex-1 space-y-6 overflow-y-auto p-6">
						{!activeShift ? (
							<Alert
								variant="destructive"
								className="border-red-500/20 bg-red-500/10 text-red-100"
							>
								<AlertTitle>No hay turno abierto</AlertTitle>
								<AlertDescription>
									Debes abrir un turno para registrar abonos.
								</AlertDescription>
							</Alert>
						) : (
							<div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-black/10 p-3 text-sm text-gray-300">
								<CalendarClock className="h-4 w-4 text-gray-500" />
								<span>
									Turno activo:{" "}
									<span className="font-medium text-white">
										{activeShift.terminalName || "Caja principal"}
									</span>
								</span>
							</div>
						)}

						<div className="grid gap-4">
							<Field label="Monto" htmlFor={amountId} required>
								<Input
									id={amountId}
									type="number"
									min={1}
									step={1}
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="Ej. 50000"
									className="border-gray-700 bg-black/20"
									required
								/>
								{isOverpayment ? (
									<p className="text-sm text-red-400">
										El monto no puede superar el saldo pendiente ({" "}
										{currencyFormatter.format(maxAmount)}).
									</p>
								) : null}
							</Field>

							<Field label="Método de pago" htmlFor={methodId} required>
								<Select
									value={method}
									onValueChange={setMethod}
								>
									<SelectTrigger
										id={methodId}
										className="w-full border-gray-700 bg-black/20 text-white"
									>
										<SelectValue placeholder="Selecciona método" />
									</SelectTrigger>
									<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
										{paymentMethods.map((pm) => (
											<SelectItem key={pm.id} value={pm.id}>
												{pm.label}
												{pm.requiresReference ? (
													<span className="ml-1 text-xs text-gray-500">
														(requiere ref.)
													</span>
												) : null}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>

							<Field label="Venta asociada (opcional)" htmlFor={saleIdInputId}>
								<Input
									id={saleIdInputId}
									value={saleId}
									onChange={(e) => setSaleId(e.target.value)}
									placeholder="ID de venta"
									className="border-gray-700 bg-black/20"
								/>
							</Field>

							{selectedMethod?.requiresReference ? (
								<Field label="Referencia" htmlFor={referenceId} required>
									<Input
										id={referenceId}
										value={reference}
										onChange={(e) => setReference(e.target.value)}
										placeholder="Número de referencia"
										className="border-gray-700 bg-black/20"
										required
									/>
								</Field>
							) : (
								<Field label="Referencia (opcional)" htmlFor={referenceId}>
									<Input
										id={referenceId}
										value={reference}
										onChange={(e) => setReference(e.target.value)}
										placeholder="Número de referencia"
										className="border-gray-700 bg-black/20"
									/>
								</Field>
							)}

							<Field label="Notas (opcional)" htmlFor={notesId}>
								<Input
									id={notesId}
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Observaciones"
									className="border-gray-700 bg-black/20"
								/>
							</Field>
						</div>

						{error ? (
							<p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 text-sm font-medium text-red-300">
								{getErrorMessage(
									error,
									"No se pudo registrar el abono.",
								)}
							</p>
						) : null}
					</div>

					<div className="shrink-0 border-t border-gray-800 bg-black/30 p-6">
						<Button
							type="submit"
							disabled={
								isPending ||
								!isValidAmount ||
								!method ||
								!activeShift ||
								(selectedMethod?.requiresReference && !reference.trim())
							}
							className="w-full bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
						>
							{isPending ? "Registrando…" : "Registrar abono"}
						</Button>
					</div>
				</form>
			</SheetContent>
		</Sheet>
	);
}

function Field({
	label,
	htmlFor,
	required,
	children,
}: {
	label: string;
	htmlFor: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={htmlFor}>
				{label}
				{required ? <span className="text-red-400"> *</span> : null}
			</Label>
			{children}
		</div>
	);
}
