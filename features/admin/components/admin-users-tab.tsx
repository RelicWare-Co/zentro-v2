import { Badge, Button } from "@mantine/core";
import { UserPlus } from "lucide-react";
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
          <Badge color="voltage.5" tt="none" variant="light">
            {state.total} usuarios
          </Badge>
        </div>
        <Button
          c="black"
          color="voltage.5"
          leftSection={<UserPlus className="size-4" />}
          onClick={actions.openCreate}
          type="button"
        >
          Crear usuario
        </Button>
      </div>
      <AdminStatsCards />
      <AdminUsersTable />
    </div>
  );
}
