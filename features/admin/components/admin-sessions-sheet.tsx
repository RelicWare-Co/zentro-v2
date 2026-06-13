import { Loader2, MonitorSmartphone, ShieldOff, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  type AdminPanelSession,
  type AdminPanelUser,
  formatAdminDateTime,
} from "@/features/admin/admin.shared";
import { useAdminPage } from "@/features/admin/admin-page-context";
import { useAdminUserActions } from "@/features/admin/hooks/use-admin-user-actions";
import { useAdminUserSessionsQuery } from "@/features/admin/hooks/use-admin-users";
import { getErrorMessage } from "@/lib/utils";

function SessionRow({ session }: { session: AdminPanelSession }) {
  const adminActions = useAdminUserActions();

  const handleRevoke = async () => {
    try {
      await adminActions.revokeUserSession.mutateAsync({
        sessionToken: session.token,
      });
      toast.success("Sesión revocada.");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo revocar la sesión."));
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4">
      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium text-sm text-white">
          {session.userAgent ?? "Dispositivo desconocido"}
        </p>
        <p className="text-xs text-zinc-500">
          IP: {session.ipAddress || "desconocida"}
        </p>
        <p className="text-xs text-zinc-500">
          Inició: {formatAdminDateTime(session.createdAt)} · Expira:{" "}
          {formatAdminDateTime(session.expiresAt)}
        </p>
        {session.impersonatedBy ? (
          <Badge className="border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10">
            Suplantación activa
          </Badge>
        ) : null}
      </div>
      <Button
        aria-label="Revocar sesión"
        className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
        disabled={adminActions.revokeUserSession.isPending}
        onClick={() => {
          handleRevoke().catch(() => undefined);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function AdminSessionsSheetContent({ user }: { user: AdminPanelUser }) {
  const adminActions = useAdminUserActions();
  const sessionsQuery = useAdminUserSessionsQuery(user.id);
  const sessions = sessionsQuery.data ?? [];

  const handleRevokeAll = async () => {
    try {
      await adminActions.revokeUserSessions.mutateAsync({ userId: user.id });
      toast.success(`Sesiones de ${user.name} revocadas.`);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "No se pudieron revocar las sesiones.")
      );
    }
  };

  let sessionsContent: React.ReactNode;
  if (sessionsQuery.isPending) {
    sessionsContent = (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    );
  } else if (sessionsQuery.isError) {
    sessionsContent = (
      <p className="rounded-md border border-red-400/20 bg-red-400/10 p-3 font-medium text-red-300 text-sm">
        {getErrorMessage(
          sessionsQuery.error,
          "No se pudieron cargar las sesiones."
        )}
      </p>
    );
  } else if (sessions.length === 0) {
    sessionsContent = (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <MonitorSmartphone className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          Este usuario no tiene sesiones activas.
        </p>
      </div>
    );
  } else {
    sessionsContent = (
      <div className="space-y-3">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="shrink-0 border-zinc-800 border-b p-6">
        <SheetTitle className="font-bold text-2xl">Sesiones activas</SheetTitle>
        <SheetDescription className="text-zinc-400">
          Sesiones abiertas de {user.name} ({user.email}).
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-6">{sessionsContent}</div>

      <SheetFooter className="shrink-0 border-zinc-800 border-t bg-black/30 p-6">
        <Button
          className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
          disabled={
            adminActions.revokeUserSessions.isPending || sessions.length === 0
          }
          onClick={() => {
            handleRevokeAll().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          <ShieldOff className="size-4" />
          {adminActions.revokeUserSessions.isPending
            ? "Revocando…"
            : "Revocar todas las sesiones"}
        </Button>
      </SheetFooter>
    </div>
  );
}

export function AdminSessionsSheet() {
  const { state, actions } = useAdminPage();
  const isOpen = state.activeOverlay?.type === "sessions";
  const user =
    state.activeOverlay?.type === "sessions" ? state.activeOverlay.user : null;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          actions.closeOverlay();
        }
      }}
      open={isOpen}
    >
      <SheetContent className="!w-full !max-w-full sm:!w-[540px] overflow-hidden border-zinc-800 border-l bg-[var(--color-carbon)] p-0 text-white">
        {user ? <AdminSessionsSheetContent key={user.id} user={user} /> : null}
      </SheetContent>
    </Sheet>
  );
}
