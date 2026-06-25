import {
  ActionIcon,
  Badge,
  Button,
  Loader,
  Menu,
  Select,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MonitorSmartphone,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  UserX,
  VenetianMask,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminPanelUser,
  formatAdminDateTime,
  formatUserRoleLabel,
  isAdminUser,
  isUserCurrentlyBanned,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import type { AdminUsersSearchField } from "@/features/admin/hooks/use-admin-users";
import { getErrorMessage } from "@/lib/utils";

const darkMenuStyles = {
  dropdown: {
    backgroundColor: "var(--color-carbon)",
    borderColor: "#27272a",
  },
  item: { color: "#e4e4e7" },
} as const;

function UserStatusBadges({ user }: { user: AdminPanelUser }) {
  const isBanned = isUserCurrentlyBanned(user);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isAdminUser(user) ? (
        <Badge
          color="voltage.5"
          leftSection={<ShieldCheck className="size-3" />}
          tt="none"
          variant="light"
        >
          Admin
        </Badge>
      ) : (
        <Badge
          className="border-zinc-700 bg-zinc-800/80 text-zinc-300"
          tt="none"
          variant="outline"
        >
          {formatUserRoleLabel(user.role)}
        </Badge>
      )}
      {isBanned ? (
        <Badge
          className="border-red-500/20 bg-red-500/10 text-red-300"
          tt="none"
          variant="outline"
        >
          Suspendido
        </Badge>
      ) : null}
    </div>
  );
}

function UserRowActions({ user }: { user: AdminPanelUser }) {
  const { state, actions } = useAdminPage();
  const adminActions = useAdminUserActions();
  const isSelf = user.id === state.currentUserId;
  const isBanned = isUserCurrentlyBanned(user);

  const handleImpersonate = async () => {
    try {
      await adminActions.impersonateUser.mutateAsync({ userId: user.id });
      window.location.href = "/dashboard";
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo suplantar al usuario."),
        color: "red",
      });
    }
  };

  const handleUnban = async () => {
    try {
      await adminActions.unbanUser.mutateAsync({ userId: user.id });
      notifications.show({
        message: `${user.name} fue reactivado.`,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        message: getErrorMessage(error, "No se pudo reactivar al usuario."),
        color: "red",
      });
    }
  };

  return (
    <Menu position="bottom-end" styles={darkMenuStyles} withinPortal>
      <Menu.Target>
        <ActionIcon
          aria-label={`Acciones para ${user.name}`}
          color="gray"
          variant="outline"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<Pencil className="size-4" />}
          onClick={() => actions.openEdit(user)}
        >
          Editar datos
        </Menu.Item>
        <Menu.Item
          disabled={isSelf}
          leftSection={<UserCog className="size-4" />}
          onClick={() => actions.openRole(user)}
        >
          Cambiar rol
        </Menu.Item>
        <Menu.Item
          leftSection={<KeyRound className="size-4" />}
          onClick={() => actions.openPassword(user)}
        >
          Cambiar contraseña
        </Menu.Item>
        <Menu.Item
          leftSection={<MonitorSmartphone className="size-4" />}
          onClick={() => actions.openSessions(user)}
        >
          Ver sesiones
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          disabled={isSelf}
          leftSection={<VenetianMask className="size-4" />}
          onClick={() => {
            handleImpersonate().catch(() => undefined);
          }}
        >
          Suplantar usuario
        </Menu.Item>
        <Menu.Divider />
        {isBanned ? (
          <Menu.Item
            leftSection={<UserCheck className="size-4" />}
            onClick={() => {
              handleUnban().catch(() => undefined);
            }}
          >
            Reactivar usuario
          </Menu.Item>
        ) : (
          <Menu.Item
            disabled={isSelf}
            leftSection={<UserX className="size-4" />}
            onClick={() => actions.openBan(user)}
          >
            Suspender usuario
          </Menu.Item>
        )}
        <Menu.Item
          color="red"
          disabled={isSelf}
          leftSection={<Trash2 className="size-4" />}
          onClick={() => actions.openDelete(user)}
        >
          Eliminar usuario
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

const SEARCH_FIELD_OPTIONS: { label: string; value: AdminUsersSearchField }[] =
  [
    { value: "email", label: "Email" },
    { value: "name", label: "Nombre" },
  ];

export function AdminUsersTable() {
  const { state, actions } = useAdminPage();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-sm">
          <TextInput
            aria-label="Buscar usuarios"
            leftSection={<Search aria-hidden="true" className="size-4" />}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder={
              state.searchField === "email"
                ? "Buscar por email…"
                : "Buscar por nombre…"
            }
            rightSection={
              state.isFetching && !state.isPending ? (
                <Loader color="gray" size="xs" />
              ) : null
            }
            value={state.searchQuery}
          />
        </div>
        <Select
          allowDeselect={false}
          aria-label="Campo de búsqueda"
          className="w-full sm:w-40"
          data={SEARCH_FIELD_OPTIONS}
          onChange={(value) =>
            actions.setSearchField((value ?? "email") as AdminUsersSearchField)
          }
          value={state.searchField}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="px-4 text-zinc-400">Usuario</TableHead>
              <TableHead className="text-zinc-400">Estado</TableHead>
              <TableHead className="hidden text-zinc-400 md:table-cell">
                Verificado
              </TableHead>
              <TableHead className="hidden text-zinc-400 lg:table-cell">
                Creado
              </TableHead>
              <TableHead className="text-right text-zinc-400">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.users.length === 0 ? (
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center gap-3 p-10 text-center">
                    <Users className="size-8 text-zinc-600" />
                    <p className="text-sm text-zinc-500">
                      {state.searchQuery.trim()
                        ? "No hay usuarios que coincidan con la búsqueda."
                        : "Aún no hay usuarios registrados."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              state.users.map((user) => (
                <TableRow
                  className="border-zinc-800 hover:bg-white/[0.02]"
                  key={user.id}
                >
                  <TableCell className="px-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {user.name}
                        {user.id === state.currentUserId ? (
                          <span className="ml-2 text-xs text-zinc-500">
                            (tú)
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-zinc-400">
                        {user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadges user={user} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-zinc-300 md:table-cell">
                    {user.emailVerified ? "Sí" : "No"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-zinc-300 lg:table-cell">
                    {formatAdminDateTime(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRowActions user={user} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Página {state.page} de {state.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            color="gray"
            disabled={state.page <= 1}
            leftSection={<ChevronLeft className="size-4" />}
            onClick={() => actions.setPage(state.page - 1)}
            size="xs"
            type="button"
            variant="outline"
          >
            Anterior
          </Button>
          <Button
            color="gray"
            disabled={state.page >= state.totalPages}
            onClick={() => actions.setPage(state.page + 1)}
            rightSection={<ChevronRight className="size-4" />}
            size="xs"
            type="button"
            variant="outline"
          >
            Siguiente
          </Button>
        </div>
      </div>
    </section>
  );
}
