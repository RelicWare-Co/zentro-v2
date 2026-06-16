import { Alert } from "@mantine/core";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationSelectionErrorAlert() {
  const { state } = useOrganizationSelectionPage();

  if (!state.errorMsg) {
    return null;
  }

  return (
    <div aria-live="polite">
      <Alert color="red" title="No se pudo completar la acción" variant="light">
        {state.errorMsg}
      </Alert>
    </div>
  );
}
