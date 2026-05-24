import { Building2, Link2, Mail, Users } from "lucide-react";
import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ORGANIZATION_TAB_VALUES,
  type OrganizationTab,
} from "@/features/organization/organization-page.constants.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";

export function OrganizationPageTabs({ children }: { children: ReactNode }) {
  const { state, actions } = useOrganizationPage();

  return (
    <Tabs
      className="gap-6"
      onValueChange={(value) => {
        if (
          ORGANIZATION_TAB_VALUES.includes(
            value as (typeof ORGANIZATION_TAB_VALUES)[number]
          )
        ) {
          actions.setActiveTab(value as OrganizationTab);
        }
      }}
      value={state.activeTab}
    >
      <div className="flex justify-center sm:hidden">
        <Select
          onValueChange={(value) => {
            if (
              ORGANIZATION_TAB_VALUES.includes(
                value as (typeof ORGANIZATION_TAB_VALUES)[number]
              )
            ) {
              actions.setActiveTab(value as OrganizationTab);
            }
          }}
          value={state.activeTab}
        >
          <SelectTrigger className="h-10 w-auto min-w-[180px] rounded-xl border-zinc-800 bg-[var(--color-carbon)] px-5 font-medium text-sm text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            <SelectItem value="general">
              <div className="flex items-center gap-2">
                <Building2 className="size-4" />
                General
              </div>
            </SelectItem>
            <SelectItem value="members">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                Miembros
              </div>
            </SelectItem>
            <SelectItem value="invitations">
              <div className="flex items-center gap-2">
                <Mail className="size-4" />
                Invitaciones
              </div>
            </SelectItem>
            <SelectItem value="access">
              <div className="flex items-center gap-2">
                <Link2 className="size-4" />
                Acceso
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TabsList className="hidden h-auto w-full flex-wrap gap-2 border-0 bg-transparent p-0 sm:flex">
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 shrink-0 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white"
          value="general"
        >
          <Building2 className="size-4" />
          General
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 shrink-0 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white"
          value="members"
        >
          <Users className="size-4" />
          Miembros
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 shrink-0 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white"
          value="invitations"
        >
          <Mail className="size-4" />
          Invitaciones
        </TabsTrigger>
        <TabsTrigger
          className="data-[state=active]:!border-zinc-700 h-10 shrink-0 gap-2 rounded-xl border border-transparent px-5 font-medium text-sm text-zinc-400 transition-all hover:text-white data-[state=active]:bg-[var(--color-carbon)] data-[state=active]:text-white"
          value="access"
        >
          <Link2 className="size-4" />
          Acceso
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}

export function OrganizationPageGeneralTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <TabsContent value="general">{children}</TabsContent>;
}

export function OrganizationPageMembersTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <TabsContent value="members">{children}</TabsContent>;
}

export function OrganizationPageInvitationsTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <TabsContent value="invitations">{children}</TabsContent>;
}

export function OrganizationPageAccessTabContent({
  children,
}: {
  children: ReactNode;
}) {
  return <TabsContent value="access">{children}</TabsContent>;
}
