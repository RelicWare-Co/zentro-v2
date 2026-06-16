import { Alert } from "@mantine/core";
import { useOrganizationPage } from "@/features/organization/organization-page-context";

export function OrganizationFeedbackAlert() {
  const { state } = useOrganizationPage();

  if (!state.feedbackMessage) {
    return null;
  }

  const isError = state.feedbackType === "error";

  return (
    <Alert
      color={isError ? "red" : "voltage"}
      title={isError ? "Error" : "Estado"}
      variant="light"
    >
      {state.feedbackMessage}
    </Alert>
  );
}
