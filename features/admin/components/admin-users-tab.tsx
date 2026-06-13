import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { AdminStatsCards } from "@/features/admin/components/admin-stats-cards";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";

export function AdminUsersTab() {
  const { state, actions } = useAdminPage();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-white text-xl">Usuarios</h2>
          <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
            {state.total} usuarios
          </Badge>
        </div>
        <Button
          className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
          onClick={actions.openCreate}
          type="button"
        >
          <UserPlus className="size-4" />
          Crear usuario
        </Button>
      </div>
      <AdminStatsCards />
      <AdminUsersTable />
    </div>
  );
}
