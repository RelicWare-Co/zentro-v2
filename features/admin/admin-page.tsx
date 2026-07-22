import { SegmentedControl } from "@mantine/core";
import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
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
import { AdminProductImportsTab } from "@/features/product-imports/components/admin-product-imports-tab";

function AdminPageRoot({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6 bg-[var(--color-void)] p-6 text-[var(--color-photon)] md:p-8 lg:p-12">
      {children}
    </main>
  );
}

function AdminPageLayout() {
  const { state, meta } = useAdminPage();
  const [adminTab, setAdminTab] = useState<
    "overview" | "organizations" | "users" | "imports"
  >("overview");

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
        <div className="space-y-6">
          <div className="overflow-x-auto pb-1">
            <SegmentedControl<
              "overview" | "organizations" | "users" | "imports"
            >
              className="min-w-max"
              data={[
                {
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <LayoutDashboard className="size-4" /> Resumen
                    </span>
                  ),
                  value: "overview",
                },
                {
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="size-4" /> Organizaciones
                    </span>
                  ),
                  value: "organizations",
                },
                {
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> Usuarios
                    </span>
                  ),
                  value: "users",
                },
                {
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <FileSpreadsheet className="size-4" /> Importaciones
                    </span>
                  ),
                  value: "imports",
                },
              ]}
              onChange={setAdminTab}
              value={adminTab}
            />
          </div>
          <div hidden={adminTab !== "overview"}>
            <AdminOverviewTab />
          </div>
          <div hidden={adminTab !== "organizations"}>
            <AdminOrganizationsTab />
          </div>
          <div hidden={adminTab !== "users"}>
            <AdminUsersTab />
          </div>
          <div hidden={adminTab !== "imports"}>
            <AdminProductImportsTab />
          </div>
        </div>
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
