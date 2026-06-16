import { Alert, Loader } from "@mantine/core";
import { useSettingsPage } from "@/features/settings/settings-page-context";
import { getErrorMessage } from "@/lib/utils";

export function SettingsPageLoading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Loader color="voltage.5" size="lg" />
    </div>
  );
}

export function SettingsPageError() {
  const { state } = useSettingsPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        color="red"
        title="No se pudo cargar configuración"
        variant="light"
      >
        {getErrorMessage(state.error, "Intenta recargar la página.")}
      </Alert>
    </div>
  );
}
