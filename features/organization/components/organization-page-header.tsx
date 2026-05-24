import { ShieldCheck } from "lucide-react";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";

function HeaderStat(props: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">
        {props.label}
      </p>
      <p className="font-semibold text-lg text-white">{props.value}</p>
    </div>
  );
}

export function OrganizationPageHeader() {
  const { state } = useOrganizationPage();
  const data = state.data;

  if (!data) {
    return null;
  }

  return (
    <header className="shrink-0 border-zinc-800 border-b px-6 py-6 md:px-8 lg:px-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-semibold text-2xl text-white tracking-tight">
            {data.organization.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>/{data.organization.slug}</span>
            <span className="text-zinc-600">•</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-[var(--color-voltage)]" />
              {formatOrganizationRoleLabel(data.viewer.role)}
            </span>
          </div>
        </div>
        <div className="flex gap-4">
          <HeaderStat label="Miembros" value={data.stats.membersCount} />
          <div className="w-px bg-zinc-800" />
          <HeaderStat label="Links" value={data.stats.activeJoinLinksCount} />
        </div>
      </div>
    </header>
  );
}

export { HeaderStat };
