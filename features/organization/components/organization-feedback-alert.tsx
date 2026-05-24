import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOrganizationPage } from "@/features/organization/organization-page-context";

export function OrganizationFeedbackAlert() {
  const { state } = useOrganizationPage();

  if (!state.feedbackMessage) {
    return null;
  }

  return (
    <Alert
      className={
        state.feedbackType === "error"
          ? "border-red-500/20 bg-red-500/10 text-red-100"
          : "border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-photon)]"
      }
      variant={state.feedbackType === "error" ? "destructive" : "default"}
    >
      <AlertTitle>
        {state.feedbackType === "error" ? "Error" : "Estado"}
      </AlertTitle>
      <AlertDescription>{state.feedbackMessage}</AlertDescription>
    </Alert>
  );
}
