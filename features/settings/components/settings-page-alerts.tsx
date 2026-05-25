import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSettingsPage } from "@/features/settings/settings-page-context";
import { getErrorMessage } from "@/lib/utils";

export function SettingsPageAlerts() {
  const { meta, state } = useSettingsPage();
  const { canManageSettings, showSavedMessage } = state;

  return (
    <>
      {showSavedMessage ? (
        <Alert
          aria-live="polite"
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
        >
          <AlertTitle>Cambios guardados</AlertTitle>
          <AlertDescription>
            Los próximos flujos usarán esta configuración.
          </AlertDescription>
        </Alert>
      ) : null}

      {canManageSettings ? null : (
        <Alert className="border-zinc-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
          <AlertTitle>Solo lectura</AlertTitle>
          <AlertDescription>
            Necesitas rol admin u owner para cambiar estos ajustes.
          </AlertDescription>
        </Alert>
      )}

      {meta.saveError ? (
        <Alert
          aria-live="polite"
          className="border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>
            {getErrorMessage(
              meta.saveError,
              "Revisa los campos e intenta otra vez."
            )}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
