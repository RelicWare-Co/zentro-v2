export default function Page() {
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
				<p className="mt-2 text-sm text-gray-400">
					Resumen operativo de tu organización.
				</p>
			</div>

			<section className="grid gap-4 md:grid-cols-3">
				<MetricCard label="Ventas de hoy" value="$0" />
				<MetricCard label="Órdenes abiertas" value="0" />
				<MetricCard label="Productos activos" value="0" />
			</section>
		</div>
	);
}

function MetricCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-gray-800 bg-[var(--color-carbon)] p-5">
			<p className="text-sm text-gray-400">{label}</p>
			<p className="mt-3 text-3xl font-semibold text-white">{value}</p>
		</div>
	);
}
