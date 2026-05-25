import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationSelectionErrorAlert() {
  const { state } = useOrganizationSelectionPage();

  if (!state.errorMsg) {
    return null;
  }

  return (
    <div aria-live="polite">
      <Alert
        className="border-red-500/20 bg-red-500/10 text-red-100"
        variant="destructive"
      >
        <AlertTitle>No se pudo completar la acción</AlertTitle>
        <AlertDescription>{state.errorMsg}</AlertDescription>
      </Alert>
    </div>
  );
}
