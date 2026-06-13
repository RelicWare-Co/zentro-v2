import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function UserStatusBadges({ user }: { user: AdminPanelUser }) {
  const isBanned = isUserCurrentlyBanned(user);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isAdminUser(user) ? (
        <Badge className="border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 text-[var(--color-voltage)] hover:bg-[var(--color-voltage)]/10">
          <ShieldCheck className="size-3" />
          Admin
        </Badge>
      ) : (
        <Badge
          className="border-zinc-700 bg-zinc-800/80 text-zinc-300"
          variant="outline"
        >
          {formatUserRoleLabel(user.role)}
        </Badge>
      )}
      {isBanned ? (
        <Badge className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/10">
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
      toast.error(getErrorMessage(error, "No se pudo suplantar al usuario."));
    }
  };

  const handleUnban = async () => {
    try {
      await adminActions.unbanUser.mutateAsync({ userId: user.id });
      toast.success(`${user.name} fue reactivado.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo reactivar al usuario."));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Acciones para ${user.name}`}
          className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
          size="sm"
          type="button"
          variant="outline"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-zinc-800 bg-[var(--color-carbon)] text-zinc-200"
      >
        <DropdownMenuItem onSelect={() => actions.openEdit(user)}>
          <Pencil className="size-4" />
          Editar datos
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isSelf}
          onSelect={() => actions.openRole(user)}
        >
          <UserCog className="size-4" />
          Cambiar rol
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.openPassword(user)}>
          <KeyRound className="size-4" />
          Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.openSessions(user)}>
          <MonitorSmartphone className="size-4" />
          Ver sesiones
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem
          disabled={isSelf}
          onSelect={() => {
            handleImpersonate().catch(() => undefined);
          }}
        >
          <VenetianMask className="size-4" />
          Suplantar usuario
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-800" />
        {isBanned ? (
          <DropdownMenuItem
            onSelect={() => {
              handleUnban().catch(() => undefined);
            }}
          >
            <UserCheck className="size-4" />
            Reactivar usuario
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => actions.openBan(user)}
          >
            <UserX className="size-4" />
            Suspender usuario
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-300 focus:text-red-200"
          disabled={isSelf}
          onSelect={() => actions.openDelete(user)}
        >
          <Trash2 className="size-4" />
          Eliminar usuario
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="border-zinc-800 bg-black/20 pl-9"
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder={
              state.searchField === "email"
                ? "Buscar por email…"
                : "Buscar por nombre…"
            }
            value={state.searchQuery}
          />
          {state.isFetching && !state.isPending ? (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-zinc-500" />
          ) : null}
        </div>
        <Select
          onValueChange={(value) =>
            actions.setSearchField(value as AdminUsersSearchField)
          }
          value={state.searchField}
        >
          <SelectTrigger className="w-full border-zinc-700 bg-black/20 text-white sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-[var(--color-carbon)] text-white">
            {SEARCH_FIELD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
            disabled={state.page <= 1}
            onClick={() => actions.setPage(state.page - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
            disabled={state.page >= state.totalPages}
            onClick={() => actions.setPage(state.page + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
