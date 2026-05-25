import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationCreationControlledCard() {
  const { state } = useOrganizationSelectionPage();

  return (
    <Card className="border-zinc-800 bg-[var(--color-carbon)] text-[var(--color-photon)] shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-300" />
          Creación Controlada
        </CardTitle>
        <CardDescription className="text-zinc-400">
          La cuenta no puede abrir organizaciones nuevas por sí sola.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTitle>Solicita acceso al admin</AlertTitle>
          <AlertDescription>{state.contactMessage}</AlertDescription>
        </Alert>
        {state.contactHref ? (
          <Button
            asChild
            className="w-full border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white"
            variant="outline"
          >
            <a href={state.contactHref} rel="noreferrer" target="_blank">
              {state.contactLabel}
            </a>
          </Button>
        ) : (
          <div className="rounded-2xl border border-zinc-800 border-dashed bg-black/10 p-4 text-sm text-zinc-300">
            {state.contactLabel ?? "Contactar al administrador"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
