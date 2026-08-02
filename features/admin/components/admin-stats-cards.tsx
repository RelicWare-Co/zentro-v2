import { Skeleton } from "@mantine/core";
import { ShieldCheck, Users, UserX } from "lucide-react";
import { useAdminPage } from "@/features/admin/admin-page-context";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-voltage)]/10 text-[var(--color-voltage)]">
        {icon}
      </div>
      <div className="min-w-0">
        {value === null ? (
          <Skeleton height={28} radius="sm" width={48} />
        ) : (
          <p className="font-semibold text-2xl text-white">{value}</p>
        )}
        <p className="truncate text-sm text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

export function AdminStatsCards() {
  const { state } = useAdminPage();
  const stats = state.summary;

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={<Users className="size-5" />}
        label="Usuarios en los resultados"
        value={stats.total}
      />
      <StatCard
        icon={<ShieldCheck className="size-5" />}
        label="Administradores en los resultados"
        value={stats.admins}
      />
      <StatCard
        icon={<UserX className="size-5" />}
        label="Suspendidos en los resultados"
        value={stats.banned}
      />
    </section>
  );
}
