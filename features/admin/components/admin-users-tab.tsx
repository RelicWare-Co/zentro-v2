import { Badge, Button } from "@mantine/core";
import { UserPlus } from "lucide-react";
import { useAdminPage } from "@/features/admin/admin-page-context";
import {
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
import { AdminStatsCards } from "@/features/admin/components/admin-stats-cards";
import { AdminUsersTable } from "@/features/admin/components/admin-users-table";

export function AdminUsersTab() {
  const { state, actions } = useAdminPage();

  if (state.isPending) {
    return <AdminTabLoading />;
  }
  if (state.isError) {
    return (
      <AdminTabError
        error={state.isError ? "No se pudo cargar la consulta." : null}
        fallbackMessage="Ocurrió un error al cargar los usuarios. Intenta de nuevo."
        onRetry={() => window.location.reload()}
        title="No se pudieron cargar los usuarios"
      />
    );
  }

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
