import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowRight,
	CreditCard,
	Package,
	Receipt,
	Store,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	formatPaymentMethodIdLabel,
	normalizePaymentMethodId,
} from "@/features/settings/settings.shared";
import { orpcQuery } from "@/server/orpc/client/query";

const currencyFormatter = new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0,
});

const countFormatter = new Intl.NumberFormat("es-CO");

const compactNumberFormatter = new Intl.NumberFormat("es-CO", {
	notation: "compact",
	maximumFractionDigits: 1,
});

const dayFormatter = new Intl.DateTimeFormat("es-CO", {
	weekday: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

export function DashboardPage() {
	const overviewQuery = useQuery(orpcQuery.dashboard.overview.queryOptions());
	const data = overviewQuery.data;

	if (overviewQuery.isPending) {
		return (
			<main className="flex-1 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
				<div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-8 text-sm text-zinc-400">
					Cargando dashboard…
				</div>
			</main>
		);
	}

	if (overviewQuery.isError || !data) {
		return (
			<main className="flex-1 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
				<div className="mx-auto max-w-7xl rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
					<h1 className="text-lg font-semibold text-rose-100">
						No se pudo cargar el dashboard
					</h1>
					<p className="mt-2 text-sm text-rose-100/70">
						Intenta recargar la página. Si el problema continúa, revisa la
						sesión y la organización activa.
					</p>
				</div>
			</main>
		);
	}

	const todayRevenueChange = getPercentChange(
		data.stats.todayRevenue,
		data.stats.yesterdayRevenue,
	);
	const monthRevenueChange = getPercentChange(
		data.stats.monthRevenue,
		data.stats.previousMonthRevenue,
	);
	const maxTrendRevenue = Math.max(
		1,
		...data.salesTrend.map((point) => point.revenue),
	);
	const weeklyRevenue = data.salesTrend.reduce(
		(total, point) => total + point.revenue,
		0,
	);
	const weeklySales = data.salesTrend.reduce(
		(total, point) => total + point.salesCount,
		0,
	);
	const hasTrendData = weeklyRevenue > 0 || weeklySales > 0;
	const bestDay =
		data.salesTrend.toSorted(
			(left, right) => right.revenue - left.revenue,
		)[0] ?? null;
	const paymentTotal = data.paymentMix.reduce(
		(total, payment) => total + payment.amount,
		0,
	);
	const primaryPaymentMethod =
		data.paymentMix.toSorted((left, right) => right.amount - left.amount)[0] ??
		null;

	return (
		<main className="flex-1 space-y-6 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<div className="flex items-baseline gap-3">
						<h1 className="text-3xl font-semibold tracking-tight text-white">
							Panel de control
						</h1>
						<span className="text-sm text-zinc-400">Resumen operativo</span>
					</div>
					<p className="mt-2 text-sm text-zinc-500">
						Datos actualizados a las {dateTimeFormatter.format(data.generatedAt)}.
					</p>
				</div>

				<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
					<Button
						asChild
						variant="outline"
						className="h-10 w-full border-zinc-800 bg-[var(--color-carbon)] px-4 text-zinc-300 hover:bg-white/5 hover:text-white sm:w-auto"
					>
						<a href="/products">
							<Package className="mr-2 size-4" aria-hidden="true" />
							Ver inventario
						</a>
					</Button>
					<Button
						asChild
						className="h-10 w-full bg-[var(--color-voltage)] px-4 font-semibold text-black hover:bg-[#c9e605] sm:w-auto"
					>
						<a href="/pos">
							<Store className="mr-2 size-4" aria-hidden="true" />
							Ir al POS
						</a>
					</Button>
				</div>
			</div>

			<section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
				<CompactStatCard
					title="Ventas hoy"
					value={formatCurrency(data.stats.todayRevenue)}
					description={`${formatCount(data.stats.todaySalesCount)} ventas registradas`}
					highlight={formatDelta(todayRevenueChange, "vs ayer")}
					icon={Receipt}
				/>
				<CompactStatCard
					title="Ticket promedio"
					value={formatCurrency(data.stats.todayAvgTicket)}
					description={
						data.stats.todayCustomersServed > 0
							? `${formatCount(data.stats.todayCustomersServed)} clientes identificados`
							: "Sin clientes identificados"
					}
					highlight="Basado en ventas del día"
					icon={Wallet}
				/>
				<CompactStatCard
					title="Ventas del mes"
					value={formatCurrency(data.stats.monthRevenue)}
					description={`${formatCount(data.stats.monthSalesCount)} ventas acumuladas`}
					highlight={formatDelta(monthRevenueChange, "vs mes anterior")}
					icon={TrendingUp}
				/>
				<CompactStatCard
					title="Cartera pendiente"
					value={formatCurrency(data.stats.pendingCreditBalance)}
					description={`${formatCount(data.stats.creditAccountsCount)} cuentas por cobrar`}
					highlight={
						data.stats.creditAccountsCount > 0
							? "Requiere seguimiento"
							: "Sin saldo pendiente"
					}
					icon={CreditCard}
				/>
				<CompactStatCard
					title="Inventario en riesgo"
					value={formatCount(data.stats.lowStockCount)}
					description={`${formatCount(data.stats.activeProductsCount)} productos activos`}
					highlight={`Stock <= ${data.lowStockThreshold}`}
					icon={AlertTriangle}
				/>
			</section>

			<section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
				<div className="flex flex-col gap-6 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-base font-semibold text-white">
								Ventas de los últimos 7 días
							</h2>
							<p className="text-sm text-zinc-400">
								Comportamiento reciente de ingresos y volumen de ventas.
							</p>
						</div>
						<Badge
							variant="outline"
							className="self-start border-zinc-700 bg-black/20 text-zinc-300 sm:self-auto"
						>
							{formatCurrency(weeklyRevenue)}
						</Badge>
					</div>

					<div className="grid gap-3 md:grid-cols-3">
						<MiniMetric
							label="Ingresos"
							value={formatCurrency(weeklyRevenue)}
							description="Últimos 7 días"
						/>
						<MiniMetric
							label="Ventas"
							value={formatCount(weeklySales)}
							description="Tickets registrados"
						/>
						<MiniMetric
							label="Mejor día"
							value={
								bestDay && bestDay.revenue > 0
									? formatShortDay(bestDay.dateKey)
									: "Sin ventas"
							}
							description={
								bestDay && bestDay.revenue > 0
									? formatCurrency(bestDay.revenue)
									: "Aún no hay historial"
							}
						/>
					</div>

					{hasTrendData ? (
						<div className="grid h-48 grid-cols-7 gap-2 sm:gap-3">
							{data.salesTrend.map((point) => {
								const barHeight = Math.max(
									point.revenue > 0 ? 12 : 4,
									(point.revenue / maxTrendRevenue) * 100,
								);

								return (
									<div
										key={point.dateKey}
										className="flex h-full min-w-0 flex-col justify-end"
									>
										<div className="mb-2 text-center text-[10px] text-zinc-500 sm:text-[11px]">
											{formatCompactCurrency(point.revenue)}
										</div>
										<div className="flex h-28 items-end border-b border-zinc-800/80 px-1">
											<div
												className={
													point.revenue > 0
														? "w-full rounded-t-lg bg-gradient-to-t from-[var(--color-voltage)] to-[#f1ff87] shadow-[0_0_20px_rgba(201,230,5,0.12)] transition-all"
														: "w-full rounded-full bg-zinc-800 transition-all"
												}
												style={{ height: `${barHeight}%` }}
											/>
										</div>
										<div className="mt-3 text-center">
											<div className="text-xs font-medium text-zinc-300">
												{formatShortDay(point.dateKey)}
											</div>
											<div className="mt-1 hidden text-[10px] text-zinc-500 sm:block">
												{formatCount(point.salesCount)} ventas
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<EmptyState>
							No hay ventas en los últimos 7 días para mostrar el gráfico.
						</EmptyState>
					)}
				</div>

				<div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
					<div>
						<h2 className="text-base font-semibold text-white">
							Operación actual
						</h2>
						<p className="text-sm text-zinc-400">
							Estado del turno y distribución de cobros de hoy.
						</p>
					</div>

					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-sm font-medium text-white">Turno</p>
							<p className="mt-1 text-sm text-zinc-400">
								{data.activeShift
									? `Abierto en ${data.activeShift.terminalName ?? "caja principal"}`
									: "No hay un turno abierto para este usuario"}
							</p>
						</div>
						<Badge
							className={
								data.activeShift
									? "border-0 bg-emerald-500/10 text-emerald-300"
									: "border-0 bg-zinc-800/80 text-zinc-300"
							}
						>
							{data.activeShift ? "Activo" : "Pendiente"}
						</Badge>
					</div>

					{data.activeShift ? (
						<div className="rounded-xl border border-zinc-800/60 bg-black/20 p-2">
							<div className="grid gap-2 sm:grid-cols-2">
								<MetricItem
									label="Abierto desde"
									value={dateTimeFormatter.format(data.activeShift.openedAt)}
									description="Hora local"
								/>
								<MetricItem
									label="Base inicial"
									value={formatCurrency(data.activeShift.startingCash)}
									description="Efectivo de apertura"
								/>
							</div>
						</div>
					) : (
						<Button
							asChild
							variant="outline"
							className="h-9 w-full border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
						>
							<a href="/pos">
								Abrir caja en POS
								<ArrowRight className="ml-2 size-4" />
							</a>
						</Button>
					)}

					<div className="border-t border-zinc-800 pt-4">
						<div className="mb-3 flex items-center justify-between">
							<p className="text-sm font-medium text-white">Cobros hoy</p>
							<p className="text-sm text-zinc-400">
								{formatCurrency(paymentTotal)}
							</p>
						</div>

						{data.paymentMix.length > 0 ? (
							<div className="space-y-3">
								{data.paymentMix.map((paymentMethod) => {
									const width =
										paymentTotal > 0
											? (paymentMethod.amount / paymentTotal) * 100
											: 0;

									return (
										<div key={paymentMethod.method} className="space-y-1.5">
											<div className="flex items-center justify-between text-sm">
												<span className="text-zinc-300">
													{formatPaymentMethod(
														paymentMethod.method,
														data.paymentMethodLabels,
													)}
												</span>
												<span className="text-zinc-400">
													{formatCurrency(paymentMethod.amount)}
												</span>
											</div>
											<div className="h-2 overflow-hidden rounded-full bg-black/20">
												<div
													className="h-2 rounded-full bg-[var(--color-voltage)] transition-all"
													style={{ width: `${Math.max(width, 4)}%` }}
												/>
											</div>
										</div>
									);
								})}
								<p className="text-[11px] text-zinc-500">
									Medio principal:{" "}
									{primaryPaymentMethod
										? formatPaymentMethod(
												primaryPaymentMethod.method,
												data.paymentMethodLabels,
											)
										: "Sin registros"}
								</p>
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
								Aún no hay cobros registrados hoy.
							</div>
						)}
					</div>

					<div className="rounded-xl border border-zinc-800/60 bg-black/20 p-2">
						<div className="grid gap-2 sm:grid-cols-2">
							<MetricItem
								label="Clientes activos"
								value={formatCount(data.stats.activeCustomersCount)}
								description="Base disponible"
							/>
							<MetricItem
								label="Productos activos"
								value={formatCount(data.stats.activeProductsCount)}
								description="Catálogo habilitado"
							/>
						</div>
					</div>

					<Button
						asChild
						variant="outline"
						className="h-10 w-full border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
					>
						<a href="/shifts">
							Ver turnos y cierres
							<ArrowRight className="ml-2 size-4" />
						</a>
					</Button>
				</div>
			</section>

			<section className="grid gap-6 xl:grid-cols-2">
				<div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
					<div>
						<h2 className="text-base font-semibold text-white">
							Productos más vendidos
						</h2>
						<p className="text-sm text-zinc-400">
							Top de los últimos 30 días para vigilar rotación y stock.
						</p>
					</div>
					{data.topProducts.length > 0 ? (
						<div className="space-y-3">
							{data.topProducts.map((productItem, index) => (
								<div
									key={productItem.productId}
									className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5"
								>
									<div className="min-w-0">
										<div className="mb-0.5 flex items-center gap-2">
											<p className="text-xs font-semibold text-[var(--color-voltage)]">
												#{index + 1}
											</p>
											<p className="truncate font-medium text-white">
												{productItem.name}
											</p>
										</div>
										<p className="text-xs text-zinc-400">
											{formatCount(productItem.quantitySold)} uds. vendidas
										</p>
									</div>
									<div className="text-right">
										<p className="text-sm font-medium text-white">
											{formatCurrency(productItem.revenue)}
										</p>
										<p className="text-xs text-zinc-500">
											Stock: {formatCount(productItem.stock)}
										</p>
									</div>
								</div>
							))}
						</div>
					) : (
						<EmptyState>
							Aún no hay ventas suficientes para construir el ranking.
						</EmptyState>
					)}
				</div>

				<div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
					<div>
						<h2 className="text-base font-semibold text-white">
							Alertas operativas
						</h2>
						<p className="text-sm text-zinc-400">
							Señales clave para actuar antes de que afecten la operación.
						</p>
					</div>
					<div className="space-y-4">
						<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-amber-200">
										Inventario bajo
									</p>
									<p className="mt-1 text-xs text-amber-200/70">
										{formatCount(data.stats.lowStockCount)} productos con stock
										en riesgo.
									</p>
								</div>
								<AlertTriangle className="size-5 text-amber-400" />
							</div>
						</div>

						<div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-medium text-sky-200">
										Cartera pendiente
									</p>
									<p className="mt-1 text-xs text-sky-200/70">
										{formatCurrency(data.stats.pendingCreditBalance)} por cobrar
										en {formatCount(data.stats.creditAccountsCount)} cuentas.
									</p>
								</div>
								<CreditCard className="size-5 text-sky-400" />
							</div>
						</div>

						{data.lowStockProducts.length > 0 ? (
							<div className="space-y-3 pt-2">
								{data.lowStockProducts.map((productItem) => (
									<div
										key={productItem.id}
										className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium text-white">
												{productItem.name}
											</p>
											<p className="text-xs text-zinc-500">
												{productItem.categoryName ?? "Sin categoría"}
											</p>
										</div>
										<Badge className="border-0 bg-amber-500/10 text-amber-300">
											Stock {formatCount(productItem.stock)}
										</Badge>
									</div>
								))}
							</div>
						) : (
							<EmptyState>No hay productos con stock comprometido.</EmptyState>
						)}
					</div>
				</div>
			</section>

			<section>
				<div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
					<div>
						<h2 className="text-base font-semibold text-white">
							Ventas recientes
						</h2>
						<p className="text-sm text-zinc-400">
							Actividad más reciente para validar montos, tiempos y tipo de
							venta.
						</p>
					</div>
					{data.recentSales.length > 0 ? (
						<div className="space-y-3">
							{data.recentSales.map((recentSale) => (
								<div
									key={recentSale.id}
									className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/10 px-4 py-3 transition-colors hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2">
											<p className="truncate text-sm font-medium text-white">
												{recentSale.customerName ?? "Cliente mostrador"}
											</p>
											<Badge
												className={`${getSaleStatusBadgeClass(recentSale.status)} border-0 px-2 py-0.5 text-[10px]`}
											>
												{formatSaleStatus(recentSale.status)}
											</Badge>
										</div>
										<p className="mt-1 text-[11px] text-zinc-500">
											{dateTimeFormatter.format(recentSale.createdAt)}
										</p>
									</div>
									<p className="text-sm font-semibold text-[var(--color-voltage)]">
										{formatCurrency(recentSale.totalAmount)}
									</p>
								</div>
							))}
						</div>
					) : (
						<EmptyState>No se han registrado ventas todavía.</EmptyState>
					)}
				</div>
			</section>
		</main>
	);
}

function CompactStatCard({
	title,
	value,
	description,
	highlight,
	icon: Icon,
}: {
	title: string;
	value: string;
	description?: string;
	highlight?: string;
	icon: typeof Receipt;
}) {
	return (
		<div className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-3 sm:gap-3 sm:p-4">
			<div className="flex items-center gap-2 sm:gap-3">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] sm:h-10 sm:w-10">
					<Icon className="size-4 sm:h-5 sm:w-5" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-[11px]">
						{title}
					</p>
					<p className="mt-0.5 truncate text-base font-semibold tabular-nums text-white sm:text-lg">
						{value}
					</p>
				</div>
			</div>
			{description || highlight ? (
				<div className="hidden text-[11px] sm:block">
					{description ? (
						<p className="truncate text-zinc-400">{description}</p>
					) : null}
					{highlight ? (
						<p className="mt-0.5 truncate text-zinc-500">{highlight}</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function MiniMetric({
	label,
	value,
	description,
}: {
	label: string;
	value: string;
	description: string;
}) {
	return (
		<div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
			<p className="text-sm text-zinc-400">{label}</p>
			<p className="mt-2 text-lg font-semibold text-white">{value}</p>
			<p className="mt-1 text-xs text-zinc-500">{description}</p>
		</div>
	);
}

function MetricItem({
	label,
	value,
	description,
}: {
	label: string;
	value: string;
	description: string;
}) {
	return (
		<div className="p-3">
			<p className="text-sm text-zinc-400">{label}</p>
			<p className="mt-1 text-base font-semibold text-white">{value}</p>
			<p className="text-xs text-zinc-500">{description}</p>
		</div>
	);
}

function EmptyState({ children }: { children: string }) {
	return (
		<div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
			{children}
		</div>
	);
}

function getPercentChange(current: number, previous: number) {
	if (previous === 0) {
		return current === 0 ? 0 : null;
	}

	return ((current - previous) / previous) * 100;
}

function formatDelta(value: number | null, suffix: string) {
	if (value === null) {
		return `Sin base ${suffix}`;
	}

	const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
	return `${value > 0 ? "+" : ""}${rounded}% ${suffix}`;
}

function formatCurrency(value: number) {
	return currencyFormatter.format(value);
}

function formatCompactCurrency(value: number) {
	return `$${compactNumberFormatter.format(value)}`;
}

function formatCount(value: number) {
	return countFormatter.format(value);
}

function formatShortDay(dateKey: string) {
	return dayFormatter
		.format(new Date(`${dateKey}T12:00:00`))
		.replace(".", "")
		.toUpperCase();
}

function formatPaymentMethod(
	method: string,
	paymentMethodLabels?: Record<string, string>,
) {
	const normalizedMethodId = normalizePaymentMethodId(method);

	if (
		paymentMethodLabels &&
		Object.hasOwn(paymentMethodLabels, normalizedMethodId)
	) {
		return (
			paymentMethodLabels[normalizedMethodId] ??
			formatPaymentMethodIdLabel(method)
		);
	}

	return formatPaymentMethodIdLabel(method);
}

function formatSaleStatus(status: string) {
	if (status === "credit") {
		return "Crédito";
	}

	if (status === "completed") {
		return "Pagada";
	}

	return status;
}

function getSaleStatusBadgeClass(status: string) {
	if (status === "credit") {
		return "bg-sky-500/10 text-sky-300 hover:bg-sky-500/10";
	}

	if (status === "completed") {
		return "bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10";
	}

	if (status === "cancelled") {
		return "bg-rose-500/10 text-rose-300 hover:bg-rose-500/10";
	}

	return "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800/80";
}
