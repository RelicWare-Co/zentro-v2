import { Building2, LayoutDashboard, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AdminPageProvider,
  useAdminPage,
} from "@/features/admin/admin-page-context";
import { AdminBanDialog } from "@/features/admin/components/admin-ban-dialog";
import { AdminDeleteDialog } from "@/features/admin/components/admin-delete-dialog";
import { AdminOrganizationSheet } from "@/features/admin/components/admin-organization-sheet";
import { AdminOrganizationsTab } from "@/features/admin/components/admin-organizations-tab";
import { AdminOverviewTab } from "@/features/admin/components/admin-overview-tab";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import {
  AdminPageError,
  AdminPageLoading,
} from "@/features/admin/components/admin-page-states";
import { AdminPasswordDialog } from "@/features/admin/components/admin-password-dialog";
import { AdminRoleDialog } from "@/features/admin/components/admin-role-dialog";
import { AdminSessionsSheet } from "@/features/admin/components/admin-sessions-sheet";
import { AdminUserFormSheet } from "@/features/admin/components/admin-user-form-sheet";
import { AdminUsersTab } from "@/features/admin/components/admin-users-tab";

function AdminPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function AdminPageLayout() {
  const { state, meta } = useAdminPage();

  if (state.isPending) {
    return <AdminPageLoading />;
  }

  if (state.isError) {
    return <AdminPageError error={meta.usersError} />;
  }

  return (
    <>
      <AdminPageRoot>
        <AdminPageHeader />
        <Tabs className="space-y-6" defaultValue="overview">
          <TabsList className="border border-zinc-800 bg-[var(--color-carbon)]">
            <TabsTrigger value="overview">
              <LayoutDashboard className="size-4" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="organizations">
              <Building2 className="size-4" />
              Organizaciones
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="size-4" />
              Usuarios
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <AdminOverviewTab />
          </TabsContent>
          <TabsContent value="organizations">
            <AdminOrganizationsTab />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsersTab />
          </TabsContent>
        </Tabs>
      </AdminPageRoot>
      <AdminUserFormSheet />
      <AdminRoleDialog />
      <AdminPasswordDialog />
      <AdminBanDialog />
      <AdminSessionsSheet />
      <AdminDeleteDialog />
      <AdminOrganizationSheet />
    </>
  );
}

export function AdminPage() {
  return (
    <AdminPageProvider>
      <AdminPageLayout />
    </AdminPageProvider>
  );
}
