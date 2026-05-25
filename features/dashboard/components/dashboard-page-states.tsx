export function DashboardPageLoading() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-8 text-sm text-zinc-400">
        Cargando dashboard…
      </div>
    </main>
  );
}

export function DashboardPageError() {
  return (
    <main className="flex-1 overflow-y-auto bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      <div className="mx-auto max-w-7xl rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
        <h1 className="font-semibold text-lg text-rose-100">
          No se pudo cargar el dashboard
        </h1>
        <p className="mt-2 text-rose-100/70 text-sm">
          Intenta recargar la página. Si el problema continúa, revisa la sesión
          y la organización activa.
        </p>
      </div>
    </main>
  );
}
