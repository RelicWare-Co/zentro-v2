import {
	CircleDollarSign,
	Clock3,
	Filter,
	Receipt,
	Search,
	Store,
	User,
	Wallet,
} from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
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
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/components/Link";
import {
	createPaymentMethodLabelMap,
	formatCurrency,
	formatPaymentMethodLabel,
} from "@/features/pos/utils";
import { useShiftsList } from "./hooks/use-shifts";

const DEFAULT_LIST_PARAMS = {
	limit: 10,
	cursor: 0,
};

const ALL_FILTER_VALUE = "all";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
});

const countFormatter = new Intl.NumberFormat("es-CO");

function formatCount(value: number) {
	return countFormatter.format(value);
}

function formatShiftStatus(status: string) {
	return status === "open" ? "Abierto" : "Cerrado";
}

function formatShiftRange(openedAt: number, closedAt: number | null) {
	return closedAt
		? `${dateTimeFormatter.format(openedAt)} - ${dateTimeFormatter.format(closedAt)}`
		: `${dateTimeFormatter.format(openedAt)} - En curso`;
}

function getShiftStatusBadgeClass(status: string) {
	return status === "open"
		? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
		: "border-gray-700 bg-gray-800/80 text-gray-300 hover:bg-gray-800/80";
}

function getDifferenceClassName(value: number) {
	if (value > 0) {
		return "text-sm font-medium text-emerald-300";
	}
	if (value < 0) {
		return "text-sm font-medium text-rose-300";
	}
	return "text-sm font-medium text-gray-300";
}

function formatSignedCurrency(value: number) {
	const prefix = value > 0 ? "+" : "";
	return `${prefix}${formatCurrency(value)}`;
}

function formatMovementType(type: string) {
	const labels: Record<string, string> = {
		inflow: "Ingreso manual",
		expense: "Gasto operativo",
		payout: "Pago a proveedor",
	};
	return labels[type] ?? type;
}

export function ShiftsPage() {
	const searchId = useId();
	const statusId = useId();
	const cashierIdField = useId();
	const terminalIdField = useId();
	const paymentMethodIdField = useId();
	const differenceStatusIdField = useId();
	const hasMovementsIdField = useId();
	const startDateIdField = useId();
	const endDateIdField = useId();

	const [searchQuery, setSearchQuery] = useState("");
	const [status, setStatus] = useState("");
	const [cashierId, setCashierId] = useState("");
	const [terminalName, setTerminalName] = useState("");
	const [paymentMethod, setPaymentMethod] = useState("");
	const [differenceStatus, setDifferenceStatus] = useState("");
	const [hasMovements, setHasMovements] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [cursor, setCursor] = useState(0);
	const [pageSize, setPageSize] = useState(DEFAULT_LIST_PARAMS.limit);

	const deferredSearchQuery = useDeferredValue(searchQuery);

	const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

	const listParams = useMemo(() => {
		return {
			limit: pageSize,
			cursor,
			searchQuery: deferredSearchQuery.trim() || null,
			status:
				status === "open" || status === "closed" ? (status as "open" | "closed") : null,
			cashierId: cashierId || null,
			terminalName: terminalName || null,
			paymentMethod: paymentMethod || null,
			differenceStatus:
				differenceStatus === "short" ||
				differenceStatus === "over" ||
				differenceStatus === "balanced"
					? (differenceStatus as "short" | "over" | "balanced")
					: null,
			hasMovements:
				hasMovements === "yes" || hasMovements === "no"
					? (hasMovements as "yes" | "no")
					: null,
			startDate: startDate || null,
			endDate: endDate || null,
		};
	}, [
		pageSize,
		cursor,
		deferredSearchQuery,
		status,
		cashierId,
		terminalName,
		paymentMethod,
		differenceStatus,
		hasMovements,
		startDate,
		endDate,
	]);

	useEffect(() => {
		setCursor(0);
	}, [
		deferredSearchQuery,
		status,
		cashierId,
		terminalName,
		paymentMethod,
		differenceStatus,
		hasMovements,
		startDate,
		endDate,
	]);

	const shiftsQuery = useShiftsList(listParams);
	const shifts = shiftsQuery.data?.data ?? [];
	const filterOptions = shiftsQuery.data?.filterOptions ?? {
		cashiers: [],
		terminals: [],
		paymentMethods: [],
	};
	const totalResults = shiftsQuery.data?.total ?? shifts.length;
	const nextCursor = shiftsQuery.data?.nextCursor ?? null;
	const hasMore = shiftsQuery.data?.hasMore ?? false;

	const summary = useMemo(() => {
		return shifts.reduce(
			(accumulator, shift) => {
				accumulator.expectedCash += shift.totals.expectedCash;
				accumulator.expectedPayments += shift.totals.totalPayments;
				accumulator.closureDifference += shift.totals.totalDifference;
				accumulator.movements += shift.movements.length;
				if (shift.status === "open") {
					accumulator.openShifts += 1;
				}
				return accumulator;
			},
			{
				expectedCash: 0,
				expectedPayments: 0,
				closureDifference: 0,
				movements: 0,
				openShifts: 0,
			},
		);
	}, [shifts]);

	const paymentMethodLabels = useMemo(
		() => createPaymentMethodLabelMap(filterOptions.paymentMethods),
		[filterOptions.paymentMethods],
	);

	const activeFilterCount = [
		searchQuery,
		status,
		cashierId,
		terminalName,
		paymentMethod,
		differenceStatus,
		hasMovements,
		startDate,
		endDate,
	].filter(Boolean).length;

	const activeAdvancedFilterCount = [
		cashierId,
		terminalName,
		paymentMethod,
		differenceStatus,
		hasMovements,
		startDate,
		endDate,
	].filter(Boolean).length;

	const clearFilters = () => {
		setIsMobileFilterOpen(false);
		setSearchQuery("");
		setStatus("");
		setCashierId("");
		setTerminalName("");
		setPaymentMethod("");
		setDifferenceStatus("");
		setHasMovements("");
		setStartDate("");
		setEndDate("");
		setCursor(0);
	};

	const updatePagination = (nextCursor: number, nextPageSize = pageSize) => {
		setCursor(nextCursor);
		setPageSize(nextPageSize);
	};

	const rangeStart = totalResults === 0 ? 0 : cursor + 1;
	const rangeEnd = totalResults === 0 ? 0 : cursor + shifts.length;

	const renderAdvancedFilters = (mode: "mobile" | "desktop") => {
		const isMobile = mode === "mobile";
		const idPrefix = isMobile ? "mobile-" : "";
		const inputClassName = `${
			isMobile ? "h-11" : "h-9"
		} border-gray-700 bg-black/20 text-white placeholder:text-gray-500`;
		const selectClassName = `${
			isMobile ? "h-11" : "h-9"
		} w-full border-gray-700 bg-black/20 text-white`;

		return (
			<div className={isMobile ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
				<FilterField label="Cajero" htmlFor={`${idPrefix}${cashierIdField}`}>
					<Select
						value={cashierId || ALL_FILTER_VALUE}
						onValueChange={(value) =>
							setCashierId(value === ALL_FILTER_VALUE ? "" : value)
						}
					>
						<SelectTrigger
							id={`${idPrefix}${cashierIdField}`}
							className={selectClassName}
						>
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
							<SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
							{filterOptions.cashiers.map((cashier) => (
								<SelectItem key={cashier.id} value={cashier.id}>
									{cashier.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Terminal" htmlFor={`${idPrefix}${terminalIdField}`}>
					<Select
						value={terminalName || ALL_FILTER_VALUE}
						onValueChange={(value) =>
							setTerminalName(value === ALL_FILTER_VALUE ? "" : value)
						}
					>
						<SelectTrigger
							id={`${idPrefix}${terminalIdField}`}
							className={selectClassName}
						>
							<SelectValue placeholder="Todas" />
						</SelectTrigger>
						<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
							<SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
							{filterOptions.terminals.map((terminal) => (
								<SelectItem key={terminal} value={terminal}>
									{terminal}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Metodo" htmlFor={`${idPrefix}${paymentMethodIdField}`}>
					<Select
						value={paymentMethod || ALL_FILTER_VALUE}
						onValueChange={(value) =>
							setPaymentMethod(value === ALL_FILTER_VALUE ? "" : value)
						}
					>
						<SelectTrigger
							id={`${idPrefix}${paymentMethodIdField}`}
							className={selectClassName}
						>
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
							<SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
							{filterOptions.paymentMethods.map((pm) => (
								<SelectItem key={pm.id} value={pm.id}>
									{pm.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField
					label="Diferencia"
					htmlFor={`${idPrefix}${differenceStatusIdField}`}
				>
					<Select
						value={differenceStatus || ALL_FILTER_VALUE}
						onValueChange={(value) =>
							setDifferenceStatus(
								value === ALL_FILTER_VALUE ? "" : value,
							)
						}
					>
						<SelectTrigger
							id={`${idPrefix}${differenceStatusIdField}`}
							className={selectClassName}
						>
							<SelectValue placeholder="Todas" />
						</SelectTrigger>
						<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
							<SelectItem value={ALL_FILTER_VALUE}>Todas</SelectItem>
							<SelectItem value="short">Faltante</SelectItem>
							<SelectItem value="over">Sobrante</SelectItem>
							<SelectItem value="balanced">Cuadrada</SelectItem>
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField
					label="Movimientos"
					htmlFor={`${idPrefix}${hasMovementsIdField}`}
				>
					<Select
						value={hasMovements || ALL_FILTER_VALUE}
						onValueChange={(value) =>
							setHasMovements(value === ALL_FILTER_VALUE ? "" : value)
						}
					>
						<SelectTrigger
							id={`${idPrefix}${hasMovementsIdField}`}
							className={selectClassName}
						>
							<SelectValue placeholder="Todos" />
						</SelectTrigger>
						<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
							<SelectItem value={ALL_FILTER_VALUE}>Todos</SelectItem>
							<SelectItem value="yes">Con movimientos</SelectItem>
							<SelectItem value="no">Sin movimientos</SelectItem>
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Desde" htmlFor={`${idPrefix}${startDateIdField}`}>
					<Input
						id={`${idPrefix}${startDateIdField}`}
						type="date"
						value={startDate}
						onChange={(event) => setStartDate(event.target.value)}
						className={inputClassName}
					/>
				</FilterField>

				<FilterField label="Hasta" htmlFor={`${idPrefix}${endDateIdField}`}>
					<Input
						id={`${idPrefix}${endDateIdField}`}
						type="date"
						value={endDate}
						onChange={(event) => setEndDate(event.target.value)}
						className={inputClassName}
					/>
				</FilterField>
			</div>
		);
	};

	return (
		<main className="flex-1 flex flex-col space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12 font-sans min-h-0 overflow-hidden">
			<div className="shrink-0 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
				<div className="flex items-baseline gap-3">
					<h1 className="text-3xl font-bold tracking-tight text-white">
						Turnos y cierres de caja
					</h1>
					<span className="text-sm text-gray-400">
						{formatCount(shifts.length)} turnos •{" "}
						{formatCurrency(summary.expectedCash)}
					</span>
				</div>

				<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
					<Button
						asChild
						variant="outline"
						className="h-10 w-full shrink-0 rounded-lg border-gray-800 bg-[var(--color-carbon)] px-4 py-2 text-gray-300 hover:bg-white/5 hover:text-white sm:w-auto"
					>
						<Link href="/dashboard">Ver dashboard</Link>
					</Button>
					<Button
						asChild
						className="h-10 w-full shrink-0 rounded-lg bg-[var(--color-voltage)] px-4 py-2 font-semibold text-black hover:bg-[#c9e605] sm:w-auto"
					>
						<Link href="/pos">
							<Store className="mr-2 h-4 w-4" aria-hidden="true" />
							Ir al POS
						</Link>
					</Button>
				</div>
			</div>

			<div className="shrink-0 grid gap-3 grid-cols-2 lg:grid-cols-4">
				<CompactMetricCard
					title="Turnos cargados"
					value={formatCount(shifts.length)}
					icon={Receipt}
				/>
				<CompactMetricCard
					title="Turnos abiertos"
					value={formatCount(summary.openShifts)}
					icon={Clock3}
				/>
				<CompactMetricCard
					title="Efectivo esperado"
					value={formatCurrency(summary.expectedCash)}
					icon={Wallet}
				/>
				<CompactMetricCard
					title="Movimientos"
					value={formatCount(summary.movements)}
					icon={CircleDollarSign}
				/>
			</div>

			<div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-xl border border-gray-800 bg-[var(--color-carbon)]">
				<div className="shrink-0 flex flex-col gap-4 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center w-full">
						<div className="relative w-full sm:max-w-xs md:max-w-sm">
							<Search
								className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
								aria-hidden="true"
							/>
							<Input
								id={searchId}
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
								placeholder="Cajero, terminal o id…"
								className="h-10 rounded-lg border-gray-800 bg-black/20 pl-9 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20"
							/>
						</div>

						<div className="w-full sm:w-[200px]">
							<Select
								value={status || ALL_FILTER_VALUE}
								onValueChange={(value) =>
									setStatus(
										value === ALL_FILTER_VALUE ? "" : value,
									)
								}
							>
								<SelectTrigger
									id={statusId}
									className="h-10 w-full rounded-lg border-gray-800 bg-black/20 text-white"
								>
									<SelectValue placeholder="Estado" />
								</SelectTrigger>
								<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
									<SelectItem value={ALL_FILTER_VALUE}>
										Todos
									</SelectItem>
									<SelectItem value="open">Abierto</SelectItem>
									<SelectItem value="closed">Cerrado</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Sheet
							open={isMobileFilterOpen}
							onOpenChange={setIsMobileFilterOpen}
						>
							<SheetTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="h-10 w-full rounded-lg border-gray-800 bg-black/20 text-gray-300 hover:bg-white/5 hover:text-white sm:hidden"
								>
									<Filter
										className="mr-2 h-4 w-4"
										aria-hidden="true"
									/>
									Filtros
									{activeAdvancedFilterCount > 0 ? (
										<Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
											{activeAdvancedFilterCount}
										</Badge>
									) : null}
								</Button>
							</SheetTrigger>
							<SheetContent
								side="bottom"
								className="h-[85vh] rounded-t-xl border-gray-800 bg-[var(--color-carbon)] text-white"
								showCloseButton={false}
							>
								<SheetHeader className="border-b border-gray-800 pb-4">
									<SheetTitle className="text-gray-200">
										Filtros avanzados
									</SheetTitle>
								</SheetHeader>
								<div className="flex-1 overflow-y-auto px-4 py-4">
									{renderAdvancedFilters("mobile")}
								</div>
								<div className="grid grid-cols-2 gap-3 border-t border-gray-800 p-4">
									<Button
										type="button"
										variant="outline"
										onClick={clearFilters}
										className="border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
									>
										Limpiar
									</Button>
									<Button
										type="button"
										onClick={() => {
											setIsMobileFilterOpen(false);
											setCursor(0);
										}}
										className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
									>
										Aplicar
									</Button>
								</div>
							</SheetContent>
						</Sheet>

						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="hidden h-10 rounded-lg border-gray-800 bg-black/20 text-gray-300 hover:bg-white/5 hover:text-white sm:inline-flex"
								>
									<Filter
										className="mr-2 h-4 w-4"
										aria-hidden="true"
									/>
									Filtros
									{activeAdvancedFilterCount > 0 ? (
										<Badge className="ml-2 rounded-sm bg-[var(--color-voltage)]/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/30">
											{activeAdvancedFilterCount}
										</Badge>
									) : null}
								</Button>
							</PopoverTrigger>
							<PopoverContent
								align="start"
								className="z-50 w-[600px] rounded-xl border-gray-800 bg-[var(--color-carbon)] p-4 text-white shadow-xl"
							>
								<div className="space-y-4">
									<h4 className="text-sm font-medium text-gray-200">
										Filtros avanzados
									</h4>
									{renderAdvancedFilters("desktop")}
									<div className="flex justify-end pt-2">
										<Button
											type="button"
											onClick={() => {
												setCursor(0);
											}}
											className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
										>
											Aplicar filtros
										</Button>
									</div>
								</div>
							</PopoverContent>
						</Popover>

						{activeFilterCount > 0 && (
							<Button
								type="button"
								variant="ghost"
								onClick={clearFilters}
								className="h-10 text-gray-400 hover:text-white"
							>
								Limpiar
							</Button>
						)}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto min-h-0 p-4">
					<div className="space-y-4">
						{shiftsQuery.isLoading && !shiftsQuery.isPlaceholderData ? (
							<div className="rounded-xl border border-dashed border-gray-800 px-4 py-16 text-center text-sm text-gray-500">
								Cargando turnos…
							</div>
						) : shiftsQuery.isError ? (
							<div className="rounded-xl border border-dashed border-rose-800 px-4 py-16 text-center text-sm text-rose-300">
								<p className="font-medium">Error al cargar turnos</p>
								<p className="mt-1 text-xs text-gray-400">
									{shiftsQuery.error?.message ?? "Intenta de nuevo más tarde."}
								</p>
								<Button
									type="button"
									variant="outline"
									onClick={() => shiftsQuery.refetch()}
									className="mt-4 border-gray-700 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
								>
									Reintentar
								</Button>
							</div>
						) : shifts.length > 0 ? (
							shifts.map((shift) => (
								<div
									key={shift.id}
									className="overflow-hidden rounded-xl border border-gray-800 bg-black/10 transition-colors hover:border-gray-700 hover:bg-white/5"
								>
									<div className="flex flex-col gap-4 border-b border-gray-800/50 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex items-center gap-4">
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-800 bg-[var(--color-carbon)] text-gray-400">
												<User className="h-4 w-4" />
											</div>
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<h3 className="truncate font-medium text-white">
														{shift.cashierName}
													</h3>
													<Badge
														className={`${getShiftStatusBadgeClass(shift.status)} border-0`}
													>
														{formatShiftStatus(shift.status)}
													</Badge>
													<span className="font-mono text-xs text-gray-500">
														#{shift.id.slice(0, 8)}
													</span>
												</div>
												<p className="mt-0.5 truncate text-xs text-gray-400">
													{shift.terminalName ?? "Caja principal"}
												</p>
											</div>
										</div>
										<div className="shrink-0 text-left sm:text-right">
											<p className="text-sm font-medium text-gray-300">
												{formatShiftRange(
													shift.openedAt,
													shift.closedAt,
												)}
											</p>
											{shift.notes ? (
												<p
													className="mt-1 max-w-[280px] truncate text-xs text-gray-500 sm:ml-auto"
													title={shift.notes}
													>
													{shift.notes}
												</p>
											) : null}
										</div>
									</div>

									<div className="grid grid-cols-1 divide-y divide-gray-800/50 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
										<div className="p-4">
											<h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
												Operaciones
											</h4>
											<div className="space-y-3">
												<div className="grid grid-cols-2 gap-4">
													<div>
														<p className="text-xs text-gray-500">
															Pagadas (
															{formatCount(
																shift.operations.paidSalesCount,
															)})
														</p>
														<p className="text-sm font-medium text-white">
															{formatCurrency(
																shift.operations.paidSalesAmount,
															)}
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-500">
															A crédito (
															{formatCount(
																shift.operations.creditSalesCount,
															)})
														</p>
														<p className="text-sm font-medium text-white">
															{formatCurrency(
																shift.operations.creditSalesAmount,
															)}
														</p>
													</div>
												</div>
												<div className="border-t border-gray-800/50 pt-2">
													<div className="flex items-center justify-between">
														<span className="text-xs text-gray-400">
															Anuladas (
															{formatCount(
																shift.operations
																	.cancelledSalesCount,
															)})
														</span>
														<span className="text-xs text-gray-300">
															{formatCurrency(
																shift.operations
																	.cancelledSalesAmount,
															)}
														</span>
													</div>
												</div>
											</div>
										</div>

										<div className="bg-black/5 p-4">
											<h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
												Valores Esperados
											</h4>
											<div className="space-y-3">
												<div className="flex items-end justify-between">
													<div>
														<p className="text-xs text-gray-500">
															Efectivo Total
														</p>
														<p className="text-base font-semibold text-emerald-400">
															{formatCurrency(
																shift.totals.expectedCash,
															)}
														</p>
														<p className="text-xs text-gray-500">
															Base:{" "}
															{formatCurrency(
																shift.startingCash,
															)}
														</p>
													</div>
													<div className="text-right">
														<p className="text-xs text-gray-500">
															Otros Pagos (
															{formatCount(
																shift.payments.length,
															)})
														</p>
														<p className="text-sm font-medium text-white">
															{formatCurrency(
																shift.totals.totalPayments,
															)}
														</p>
													</div>
												</div>
												{shift.paymentBreakdown.length > 0 && (
													<div className="space-y-1.5 border-t border-gray-800/50 pt-2">
														{shift.paymentBreakdown.map(
															(pm) => (
																<div
																	key={pm.method}
																	className="flex items-center justify-between text-xs"
																>
																	<span className="text-gray-400">
																		{formatPaymentMethodLabel(
																			pm.method,
																			paymentMethodLabels,
																		)}
																	</span>
																	<span className="font-medium text-gray-300">
																		{formatCurrency(
																			pm.amount,
																		)}
																	</span>
																</div>
															),
														)}
													</div>
												)}
											</div>
										</div>

										<div className="bg-black/10 p-4">
											<div className="mb-3 flex items-center justify-between">
												<h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
													Cierre y Conciliación
												</h4>
												{shift.closures.length > 0 && (
													<Badge
														variant="outline"
														className={`h-6 rounded-md border-0 px-2 py-0.5 ${getDifferenceClassName(shift.totals.totalDifference)}`}
													>
														{shift.totals.totalDifference === 0
															? "Cuadrado"
															: formatSignedCurrency(
																	shift.totals
																	.totalDifference,
																)}
													</Badge>
												)}
											</div>

											{shift.closures.length > 0 ? (
												<div className="space-y-2">
													{shift.closures.map(
														(closure) => (
															<div
																key={
																	closure.paymentMethod
																}
																className="flex items-center justify-between text-xs"
															>
																<span className="text-gray-300">
																	{formatPaymentMethodLabel(
																		closure.paymentMethod,
																		paymentMethodLabels,
																	)}
																</span>
																<div className="text-right">
																	<span className="block font-medium text-white">
																		{formatCurrency(
																			closure.actualAmount,
																		)}
																	</span>
																	<span className="text-gray-500 text-[10px]">
																		vs{" "}
																		{formatCurrency(
																			closure.expectedAmount,
																		)}
																	</span>
																</div>
															</div>
														),
													)}
												</div>
											) : (
												<p className="text-xs italic text-gray-500">
													El turno sigue abierto o aún no
													tiene conciliación registrada.
												</p>
											)}

											{shift.movements.length > 0 && (
												<div className="mt-4 border-t border-gray-800/50 pt-3">
													<p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
														Movimientos de caja (
														{shift.movements.length})
													</p>
													<div className="space-y-1.5">
														{shift.movements
															.slice(0, 3)
															.map((m) => (
																<div
																	key={
																		m.id
																	}
																	className="flex items-start justify-between gap-2 text-xs"
																>
																	<span
																		className="line-clamp-2 break-words text-gray-400"
																		title={
																			m.description
																		}
																	>
																		{m.description ||
																		formatMovementType(
																			m.type,
																		)}
																	</span>
																	<span
																		className={`shrink-0 font-medium ${
																		m.type === "inflow"
																			? "text-emerald-400"
																			: "text-rose-400"
																		}`}
																	>
																		{m.type ===
																		"inflow"
																		? "+"
																		: "-"}
																		{formatCurrency(
																			m.amount,
																		)}
																	</span>
																</div>
															))}
														{shift.movements.length >
															3 && (
																<p className="mt-1 text-[10px] italic text-gray-500">
																	+{" "}
																	{shift.movements
																		.length - 3}{" "}
																	movimientos
																	más
																</p>
															)}
													</div>
												</div>
											)}
										</div>
									</div>
								</div>
							))
						) : (
							<div className="rounded-xl border border-dashed border-gray-800 px-4 py-16 text-center text-sm text-gray-500">
								No hay turnos que coincidan con los filtros
								actuales.
							</div>
						)}
					</div>
				</div>

				<div className="shrink-0 flex flex-col items-center justify-between gap-4 border-t border-gray-800 bg-black/10 p-4 text-sm text-gray-400 sm:flex-row">
					<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-start">
						<div className="flex items-center gap-2">
							<span>Mostrar</span>
							<Select
								value={`${pageSize}`}
								onValueChange={(value) => {
									setPageSize(Number(value));
									setCursor(0);
								}}
							>
								<SelectTrigger className="h-8 w-[70px] rounded-md border-gray-700 bg-[var(--color-carbon)] text-white">
									<SelectValue placeholder={pageSize} />
								</SelectTrigger>
								<SelectContent className="border-gray-800 bg-[var(--color-carbon)] text-white">
									{[10, 20, 30, 40, 50].map((size) => (
										<SelectItem key={size} value={`${size}`}>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span>filas</span>
						</div>
						<div className="hidden sm:block tabular-nums">
							{rangeStart}-{rangeEnd} de {totalResults}
						</div>
					</div>

					<div className="flex w-full items-center justify-end gap-2 sm:w-auto">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={cursor <= 0}
							onClick={() =>
								updatePagination(Math.max(cursor - pageSize, 0))
							}
							className="h-8 rounded-md border-gray-700 bg-[var(--color-carbon)] px-3 text-gray-300 hover:bg-white/5 hover:text-white"
						>
							Anterior
						</Button>
						<Button
							type="button"
							variant="default"
							size="sm"
							disabled={!nextCursor}
							onClick={() =>
								nextCursor && updatePagination(nextCursor)
							}
							className="h-8 rounded-md border-none bg-[var(--color-voltage)] px-4 font-medium text-black hover:bg-[#c9e605]"
						>
							Siguiente
						</Button>
					</div>
				</div>
			</div>
		</main>
	);
}

function CompactMetricCard({
	title,
	value,
	icon: Icon,
}: {
	title: string;
	value: string;
	icon: typeof Receipt;
}) {
	return (
		<div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[var(--color-carbon)] p-4">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
				<Icon className="h-5 w-5" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<p className="truncate text-xs font-medium text-gray-400">
					{title}
				</p>
				<p className="truncate text-lg font-semibold tabular-nums text-white">
					{value}
				</p>
			</div>
		</div>
	);
}

function FilterField({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<label className="text-sm text-gray-400" htmlFor={htmlFor}>
				{label}
			</label>
			{children}
		</div>
	);
}
