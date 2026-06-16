import { Alert, Loader } from "@mantine/core";
import { OrganizationSelection } from "@/components/organization-selection";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { getErrorMessage } from "@/lib/utils";

export function OrganizationPageLoading() {
  return (
    <div className="flex min-h-[60dvh] w-full items-center justify-center">
      <Loader color="voltage.5" size="lg" />
    </div>
  );
}

export function OrganizationPageNoActiveOrg() {
  return <OrganizationSelection />;
}

export function OrganizationPageError({
  fallback = "Intenta recargar la página.",
}: {
  fallback?: string;
}) {
  const { state } = useOrganizationPage();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <Alert
        color="red"
        title="No se pudo cargar la organización"
        variant="light"
      >
        {getErrorMessage(state.error, fallback)}
      </Alert>
    </div>
  );
}
