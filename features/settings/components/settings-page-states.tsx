import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSettingsPage } from "@/features/settings/settings-page-context";
import { getErrorMessage } from "@/lib/utils";

export function SettingsPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function SettingsPageError() {
  const { state } = useSettingsPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        className="border-red-500/20 bg-red-500/10 text-red-100"
        variant="destructive"
      >
        <AlertTitle>No se pudo cargar configuración</AlertTitle>
        <AlertDescription>
          {getErrorMessage(state.error, "Intenta recargar la página.")}
        </AlertDescription>
      </Alert>
    </div>
  );
}
