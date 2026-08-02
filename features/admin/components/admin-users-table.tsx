import {
  ActionIcon,
  Badge,
  Button,
  Loader,
  Menu,
  NumberInput,
  Select,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
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
  X,
} from "lucide-react";
import { useState } from "react";
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
import { useAdminOptionsQuery } from "@/features/admin/hooks/use-admin-options";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import type { AdminUsersSearchField } from "@/features/admin/hooks/use-admin-users";
import { formatCurrency } from "@/lib/format-currency.shared";
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

function UserSortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
}) {
  let Icon = ArrowUpDown;
  if (active) {
    Icon = direction === "asc" ? ArrowUp : ArrowDown;
  }
  return (
    <button
      className="inline-flex items-center gap-1 hover:text-white"
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

export function AdminUsersTable() {
  const { state, actions } = useAdminPage();
  const [organizationSearch, setOrganizationSearch] = useState("");
  const organizationOptionsQuery = useAdminOptionsQuery({
    resource: "organizations",
    search: organizationSearch,
    selectedIds: state.organizationId ? [state.organizationId] : [],
  });
  const organizationOptions =
    organizationOptionsQuery.data?.items.map((organization) => ({
      value: organization.id,
      label: organization.name,
    })) ?? [];
  const hasFilters = Boolean(
    state.searchQuery.trim() ||
      state.organizationId ||
      state.role ||
      state.banned !== null ||
      state.emailVerified !== null ||
      state.hasSales !== null ||
      state.paidMin !== null ||
      state.paidMax !== null ||
      state.period !== "30d"
  );
  const toggleSort = (sortBy: typeof state.sortBy) => {
    actions.setSort(sortBy);
    if (state.sortBy === sortBy && state.sortDirection === "desc") {
      actions.setSortDirection("asc");
    } else {
      actions.setSortDirection("desc");
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        <Select
          allowDeselect={false}
          aria-label="Campo de búsqueda"
          data={SEARCH_FIELD_OPTIONS}
          onChange={(value) =>
            actions.setSearchField((value ?? "email") as AdminUsersSearchField)
          }
          value={state.searchField}
        />
        <Select
          clearable
          data={organizationOptions}
          nothingFoundMessage="No se encontraron organizaciones"
          onChange={(value) => actions.setOrganizationId(value ?? "")}
          onSearchChange={setOrganizationSearch}
          placeholder="Organización"
          searchable
          searchValue={organizationSearch}
          value={state.organizationId || null}
        />
        <Select
          clearable
          data={[
            { value: "admin", label: "Administradores" },
            { value: "user", label: "Usuarios" },
          ]}
          onChange={(value) =>
            actions.setRole((value ?? "") as typeof state.role)
          }
          placeholder="Rol"
          value={state.role || null}
        />
        <Select
          clearable
          data={[
            { value: "true", label: "Suspendidos" },
            { value: "false", label: "Activos" },
          ]}
          onChange={(value) =>
            actions.setBanned(value === null ? null : value === "true")
          }
          placeholder="Estado"
          value={state.banned === null ? null : String(state.banned)}
        />
        <Select
          clearable
          data={[
            { value: "true", label: "Email verificado" },
            { value: "false", label: "Email no verificado" },
          ]}
          onChange={(value) =>
            actions.setEmailVerified(value === null ? null : value === "true")
          }
          placeholder="Verificación de email"
          value={
            state.emailVerified === null ? null : String(state.emailVerified)
          }
        />
        <Select
          clearable
          data={[
            { value: "true", label: "Con ventas" },
            { value: "false", label: "Sin ventas" },
          ]}
          onChange={(value) =>
            actions.setHasSales(value === null ? null : value === "true")
          }
          placeholder="Actividad"
          value={state.hasSales === null ? null : String(state.hasSales)}
        />
        <NumberInput
          hideControls
          label="Cobrado mínimo"
          min={0}
          onChange={(value) =>
            actions.setPaidMin(typeof value === "number" ? value : null)
          }
          value={state.paidMin ?? ""}
        />
        <NumberInput
          hideControls
          label="Cobrado máximo"
          min={0}
          onChange={(value) =>
            actions.setPaidMax(typeof value === "number" ? value : null)
          }
          value={state.paidMax ?? ""}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          allowDeselect={false}
          data={[
            { value: "30d", label: "Últimos 30 días" },
            { value: "custom", label: "Periodo personalizado" },
            { value: "all", label: "Histórico" },
          ]}
          onChange={(value) =>
            actions.setPeriod((value ?? "30d") as typeof state.period)
          }
          value={state.period}
          w={190}
        />
        {state.period === "custom" ? (
          <>
            <TextInput
              aria-label="Desde"
              onChange={(event) => actions.setStartDate(event.target.value)}
              type="date"
              value={state.startDate}
            />
            <TextInput
              aria-label="Hasta"
              onChange={(event) => actions.setEndDate(event.target.value)}
              type="date"
              value={state.endDate}
            />
          </>
        ) : null}
        {hasFilters ? (
          <Button
            leftSection={<X className="size-4" />}
            onClick={actions.clearUserFilters}
            variant="subtle"
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[var(--color-carbon)]">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="px-4 text-zinc-400">
                <UserSortHeader
                  active={state.sortBy === "name"}
                  direction={state.sortDirection}
                  label="Usuario"
                  onClick={() => toggleSort("name")}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Estado</TableHead>
              <TableHead className="hidden text-zinc-400 md:table-cell">
                Verificado
              </TableHead>
              <TableHead className="hidden text-zinc-400 lg:table-cell">
                <UserSortHeader
                  active={state.sortBy === "createdAt"}
                  direction={state.sortDirection}
                  label="Creado"
                  onClick={() => toggleSort("createdAt")}
                />
              </TableHead>
              <TableHead className="hidden text-right text-zinc-400 lg:table-cell">
                <UserSortHeader
                  active={state.sortBy === "lastSaleAt"}
                  direction={state.sortDirection}
                  label="Última venta"
                  onClick={() => toggleSort("lastSaleAt")}
                />
              </TableHead>
              <TableHead className="hidden text-right text-zinc-400 xl:table-cell">
                <UserSortHeader
                  active={state.sortBy === "paidAmount"}
                  direction={state.sortDirection}
                  label="Cobrado"
                  onClick={() => toggleSort("paidAmount")}
                />
              </TableHead>
              <TableHead className="hidden text-right text-zinc-400 2xl:table-cell">
                <UserSortHeader
                  active={state.sortBy === "historicalPaidAmount"}
                  direction={state.sortDirection}
                  label="Histórico"
                  onClick={() => toggleSort("historicalPaidAmount")}
                />
              </TableHead>
              <TableHead className="text-right text-zinc-400">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.users.length === 0 ? (
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center gap-3 p-10 text-center">
                    <Users className="size-8 text-zinc-600" />
                    <p className="text-sm text-zinc-500">
                      {hasFilters
                        ? "No hay usuarios que coincidan con los filtros."
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
                  <TableCell className="hidden text-right text-sm text-zinc-400 lg:table-cell">
                    {user.metrics?.lastSaleAt
                      ? formatAdminDateTime(user.metrics.lastSaleAt)
                      : "Sin ventas"}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm text-zinc-300 tabular-nums xl:table-cell">
                    {formatCurrency(user.metrics?.paidAmount ?? 0)}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm text-zinc-300 tabular-nums 2xl:table-cell">
                    {formatCurrency(user.metrics?.historicalPaidAmount ?? 0)}
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
          Página {state.page} de {state.totalPages} · {state.total} usuarios
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
