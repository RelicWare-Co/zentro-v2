import { Loader2 } from "lucide-react";
import { useOrganizationSelectionPage } from "@/features/organization/organization-selection-context";

export function OrganizationSelectionLoading() {
  return (
    <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
      <Loader2 className="size-8 animate-spin text-[var(--color-voltage)]" />
    </div>
  );
}

export function OrganizationSelectionStates() {
  const { state } = useOrganizationSelectionPage();

  if (state.isInitialLoading) {
    return <OrganizationSelectionLoading />;
  }

  return null;
}
