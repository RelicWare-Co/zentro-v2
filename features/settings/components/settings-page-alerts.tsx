import { Alert } from "@mantine/core";
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
          color="teal"
          title="Cambios guardados"
          variant="light"
        >
          Los próximos flujos usarán esta configuración.
        </Alert>
      ) : null}

      {canManageSettings ? null : (
        <Alert color="gray" title="Solo lectura">
          Necesitas rol admin u owner para cambiar estos ajustes.
        </Alert>
      )}

      {meta.saveError ? (
        <Alert
          aria-live="polite"
          color="red"
          title="No se pudo guardar"
          variant="light"
        >
          {getErrorMessage(
            meta.saveError,
            "Revisa los campos e intenta otra vez."
          )}
        </Alert>
      ) : null}
    </>
  );
}
