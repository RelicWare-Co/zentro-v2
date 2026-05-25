import type { ReactNode } from "react";
import { AccessTab } from "@/features/organization/components/access-tab";
import { GeneralTab } from "@/features/organization/components/general-tab";
import { InvitationsTab } from "@/features/organization/components/invitations-tab";
import { MembersTab } from "@/features/organization/components/members-tab";
import { OrganizationFeedbackAlert } from "@/features/organization/components/organization-feedback-alert";
import { OrganizationPageHeader } from "@/features/organization/components/organization-page-header";
import {
  OrganizationPageError,
  OrganizationPageLoading,
  OrganizationPageNoActiveOrg,
} from "@/features/organization/components/organization-page-states";
import {
  OrganizationPageAccessTabContent,
  OrganizationPageGeneralTabContent,
  OrganizationPageInvitationsTabContent,
  OrganizationPageMembersTabContent,
  OrganizationPageTabs,
} from "@/features/organization/components/organization-page-tabs";
import {
  OrganizationPageProvider,
  useOrganizationPage,
} from "@/features/organization/organization-page-context";

function OrganizationPageRoot({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-[var(--color-void)] text-[var(--color-photon)]">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col">
        {children}
      </div>
    </div>
  );
}

function OrganizationPageLayout() {
  const { state, meta } = useOrganizationPage();

  if (state.isActiveOrgPending || state.isPending) {
    return <OrganizationPageLoading />;
  }

  if (!meta.activeOrganization) {
    return <OrganizationPageNoActiveOrg />;
  }

  if (state.isError) {
    return <OrganizationPageError />;
  }

  if (!state.data) {
    return state.isPending ? (
      <OrganizationPageLoading />
    ) : (
      <OrganizationPageError />
    );
  }

  return (
    <OrganizationPageRoot>
      <OrganizationPageHeader />
      <main className="flex-1 p-6 md:p-8 lg:p-12">
        <div className="max-w-5xl space-y-6">
          <OrganizationFeedbackAlert />
          <OrganizationPageTabs>
            <OrganizationPageGeneralTabContent>
              <GeneralTab />
            </OrganizationPageGeneralTabContent>
            <OrganizationPageMembersTabContent>
              <MembersTab />
            </OrganizationPageMembersTabContent>
            <OrganizationPageInvitationsTabContent>
              <InvitationsTab />
            </OrganizationPageInvitationsTabContent>
            <OrganizationPageAccessTabContent>
              <AccessTab />
            </OrganizationPageAccessTabContent>
          </OrganizationPageTabs>
        </div>
      </main>
    </OrganizationPageRoot>
  );
}

export function OrganizationManagement() {
  return (
    <OrganizationPageProvider>
      <OrganizationPageLayout />
    </OrganizationPageProvider>
  );
}

export const OrganizationPageCompound = {
  Provider: OrganizationPageProvider,
  Root: OrganizationPageRoot,
  Header: OrganizationPageHeader,
  Tabs: OrganizationPageTabs,
  GeneralTab,
  MembersTab,
  InvitationsTab,
  AccessTab,
};
