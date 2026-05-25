import { Building2 } from "lucide-react";
import type { JoinLinkPreview } from "@/features/auth/login-page.constants.shared";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";

export function JoinContextCard({
  joinPreview,
}: {
  joinPreview: JoinLinkPreview | null;
}) {
  if (!joinPreview) {
    return null;
  }

  if (!joinPreview.organization) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100 text-sm">
        <p className="font-medium">Enlace no disponible</p>
        <p className="text-red-200/90">{joinPreview.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[#dfff06]/10 p-2 text-[#dfff06]">
          <Building2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">
            {joinPreview.organization.name}
          </p>
          <p className="text-sm text-zinc-400">
            /{joinPreview.organization.slug}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-medium text-sky-200 text-xs">
              {formatOrganizationRoleLabel(joinPreview.role)}
            </span>
            {joinPreview.label ? (
              <span className="inline-flex items-center rounded-full border border-zinc-700 bg-transparent px-2 py-0.5 font-medium text-xs text-zinc-300">
                {joinPreview.label}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-zinc-400">
            {joinPreview.canJoin
              ? "Cuando termines de iniciar sesión o crear tu cuenta entrarás directo a esta organización."
              : joinPreview.message}
          </p>
        </div>
      </div>
    </div>
  );
}
