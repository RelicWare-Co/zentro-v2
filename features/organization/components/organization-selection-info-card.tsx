import { XCircle } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OrganizationSelectionInfoCard() {
  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="size-4 text-zinc-400" />
          Sin correo manual
        </CardTitle>
        <CardDescription className="text-zinc-400">
          El alta nueva se maneja dentro de la app. Los admins deben compartir
          invitaciones internas o join links.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
