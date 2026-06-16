import { XCircle } from "lucide-react";

export function OrganizationSelectionInfoCard() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[var(--color-carbon)] p-6 text-[var(--color-photon)]">
      <h3 className="flex items-center gap-2 font-semibold">
        <XCircle className="size-4 text-zinc-400" />
        Sin correo manual
      </h3>
      <p className="mt-1.5 text-sm text-zinc-400">
        El alta nueva se maneja dentro de la app. Los admins deben compartir
        invitaciones internas o join links.
      </p>
    </div>
  );
}
