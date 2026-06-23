import { Select, Tabs } from "@mantine/core";
import { Building2, Link2, Mail, Users } from "lucide-react";
import type { ReactNode } from "react";
import {
  ORGANIZATION_TAB_VALUES,
  type OrganizationTab,
} from "@/features/organization/organization-page.constants.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";

const MOBILE_TAB_DATA = [
  { value: "general", label: "General" },
  { value: "members", label: "Miembros" },
  { value: "invitations", label: "Invitaciones" },
  { value: "access", label: "Acceso" },
];

export function OrganizationPageTabs({ children }: { children: ReactNode }) {
  const { state, actions } = useOrganizationPage();

  const selectTab = (value: string | null) => {
    if (
      value &&
      ORGANIZATION_TAB_VALUES.includes(
        value as (typeof ORGANIZATION_TAB_VALUES)[number]
      )
    ) {
      actions.setActiveTab(value as OrganizationTab);
    }
  };

  return (
    <Tabs className="gap-6" onChange={selectTab} value={state.activeTab}>
      <div className="flex justify-center sm:hidden">
        <Select
          allowDeselect={false}
          data={MOBILE_TAB_DATA}
          onChange={selectTab}
          value={state.activeTab}
          w={200}
        />
      </div>
      <div className="hidden w-full justify-center sm:flex">
        <Tabs.List className="flex-wrap">
          <Tabs.Tab
            leftSection={<Building2 className="size-4" />}
            value="general"
          >
            General
          </Tabs.Tab>
          <Tabs.Tab leftSection={<Users className="size-4" />} value="members">
            Miembros
          </Tabs.Tab>
          <Tabs.Tab
            leftSection={<Mail className="size-4" />}
            value="invitations"
          >
            Invitaciones
          </Tabs.Tab>
          <Tabs.Tab leftSection={<Link2 className="size-4" />} value="access">
            Acceso
          </Tabs.Tab>
        </Tabs.List>
      </div>
      {children}
    </Tabs>
  );
}

export function OrganizationPageGeneralTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <Tabs.Panel value="general">{children}</Tabs.Panel>;
}

export function OrganizationPageMembersTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <Tabs.Panel value="members">{children}</Tabs.Panel>;
}

export function OrganizationPageInvitationsTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <Tabs.Panel value="invitations">{children}</Tabs.Panel>;
}

export function OrganizationPageAccessTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <Tabs.Panel value="access">{children}</Tabs.Panel>;
}
