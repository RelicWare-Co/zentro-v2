import { useId } from "react";
import { OrganizationCreateCard } from "@/features/organization/components/organization-create-form";
import { OrganizationCreationControlledCard } from "@/features/organization/components/organization-creation-controlled-card";
import { OrganizationInvitationsCard } from "@/features/organization/components/organization-invitations-card";
import { OrganizationListCard } from "@/features/organization/components/organization-list-card";
import { OrganizationSelectionErrorAlert } from "@/features/organization/components/organization-selection-error-alert";
import { OrganizationSelectionHeader } from "@/features/organization/components/organization-selection-header";
import { OrganizationSelectionInfoCard } from "@/features/organization/components/organization-selection-info-card";
import { OrganizationSelectionLoading } from "@/features/organization/components/organization-selection-states";
import {
  OrganizationSelectionProvider,
  useOrganizationSelectionPage,
} from "@/features/organization/organization-selection-context";

function OrganizationSelectionLayout() {
  const { state } = useOrganizationSelectionPage();

  if (state.isInitialLoading) {
    return <OrganizationSelectionLoading />;
  }

  return (
    <div className="app-safe-area flex min-h-[100dvh] w-full items-center justify-center bg-[var(--color-void)] text-[var(--color-photon)]">
      <div className="w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <OrganizationSelectionHeader />
        <OrganizationSelectionErrorAlert />

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <OrganizationListCard />

          <div className="space-y-6">
            <OrganizationInvitationsCard />

            {state.allowOrganizationCreation ? (
              <OrganizationCreateCard />
            ) : (
              <OrganizationCreationControlledCard />
            )}

            <OrganizationSelectionInfoCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function OrganizationSelectionWithProvider() {
  const orgNameInputId = useId();
  const orgSlugInputId = useId();

  return (
    <OrganizationSelectionProvider
      orgNameInputId={orgNameInputId}
      orgSlugInputId={orgSlugInputId}
    >
      <OrganizationSelectionLayout />
    </OrganizationSelectionProvider>
  );
}

export function OrganizationSelection() {
  return <OrganizationSelectionWithProvider />;
}

export const OrganizationSelectionCompound = {
  Provider: OrganizationSelectionProvider,
  Layout: OrganizationSelectionLayout,
  Header: OrganizationSelectionHeader,
  ListCard: OrganizationListCard,
  InvitationsCard: OrganizationInvitationsCard,
  CreateCard: OrganizationCreateCard,
  CreationControlledCard: OrganizationCreationControlledCard,
  InfoCard: OrganizationSelectionInfoCard,
};
