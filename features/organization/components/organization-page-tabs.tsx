import { SegmentedControl, Select } from "@mantine/core";
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
    <div className="space-y-6">
      <div className="flex justify-center sm:hidden">
        <Select
          allowDeselect={false}
          aria-label="Seleccionar pestaña"
          data={MOBILE_TAB_DATA}
          onChange={selectTab}
          value={state.activeTab}
          w={200}
        />
      </div>
      <div className="hidden w-full justify-center sm:flex">
        <SegmentedControl
          data={[
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> General
                </span>
              ),
              value: "general",
            },
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" /> Miembros
                </span>
              ),
              value: "members",
            },
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-4" /> Invitaciones
                </span>
              ),
              value: "invitations",
            },
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="size-4" /> Acceso
                </span>
              ),
              value: "access",
            },
          ]}
          onChange={selectTab}
          value={state.activeTab}
        />
      </div>
      {children}
    </div>
  );
}

export function OrganizationPageGeneralTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useOrganizationPage();
  return <div hidden={state.activeTab !== "general"}>{children}</div>;
}

export function OrganizationPageMembersTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useOrganizationPage();
  return <div hidden={state.activeTab !== "members"}>{children}</div>;
}

export function OrganizationPageInvitationsTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useOrganizationPage();
  return <div hidden={state.activeTab !== "invitations"}>{children}</div>;
}

export function OrganizationPageAccessTabContent({
  children,
}: {
  children: ReactNode;
}) {
  const { state } = useOrganizationPage();
  return <div hidden={state.activeTab !== "access"}>{children}</div>;
}
