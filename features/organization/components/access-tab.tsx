import { Copy, Loader2, LogOut, XCircle } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrganizationLeaveDialog } from "@/features/organization/components/organization-leave-dialog";
import { JoinLinkStatusBadge } from "@/features/organization/components/organization-ui-primitives";
import {
  useCreateJoinLinkMutation,
  useLeaveOrganizationMutation,
  useRevokeJoinLinkMutation,
} from "@/features/organization/hooks/use-organization";
import { organizationDateTimeFormatter } from "@/features/organization/organization-formatters.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import {
  isJoinLinkActive,
  JOIN_LINK_EXPIRY_OPTIONS,
} from "@/lib/organization-shared";
import { getErrorMessage } from "@/lib/utils";

export function AccessTab() {
  const { state, actions } = useOrganizationPage();
  const data = state.data;

  const labelId = useId();
  const expiryId = useId();
  const [joinLinkLabel, setJoinLinkLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [latestJoinUrl, setLatestJoinUrl] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const createJoinLinkMutation = useCreateJoinLinkMutation();
  const revokeJoinLinkMutation = useRevokeJoinLinkMutation();
  const leaveMutation = useLeaveOrganizationMutation();

  if (!data) {
    return null;
  }

  const createJoinUrl = (joinPath: string) =>
    new URL(joinPath, window.location.origin).toString();

  const copyJoinUrl = async (joinPath: string) => {
    const joinUrl = createJoinUrl(joinPath);
    await navigator.clipboard.writeText(joinUrl);
    actions.setFeedback("Enlace copiado. Ya puedes compartirlo.");
  };

  const handleCreateJoinLink = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    actions.setFeedback(null);

    try {
      const result = await createJoinLinkMutation.mutateAsync({
        label: joinLinkLabel || undefined,
        expiresInDays: Number(expiresInDays),
      });
      const joinUrl = createJoinUrl(result.joinPath);
      setLatestJoinUrl(joinUrl);
      setJoinLinkLabel("");
      await navigator.clipboard.writeText(joinUrl);
      await actions.refetchManagement();
      actions.setFeedback("Enlace creado y copiado.");
    } catch (error) {
      setLatestJoinUrl(null);
      actions.setFeedback(
        getErrorMessage(error, "No se pudo crear el enlace de acceso."),
        "error"
      );
    }
  };

  const handleRevokeJoinLink = async (joinLinkId: string) => {
    actions.setFeedback(null);
    try {
      await revokeJoinLinkMutation.mutateAsync({ joinLinkId });
      await actions.refetchManagement();
      actions.setFeedback("El enlace fue revocado.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo revocar el enlace."),
        "error"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle>Crear Link de Acceso</CardTitle>
            <CardDescription className="text-zinc-400">
              Genera un enlace de un solo uso para sumar miembros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.viewer.canManageAccess ? (
              <form className="space-y-4" onSubmit={handleCreateJoinLink}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={labelId}>Referencia</Label>
                    <Input
                      autoComplete="off"
                      className="border-zinc-800 bg-black/30"
                      disabled={createJoinLinkMutation.isPending}
                      id={labelId}
                      name="joinLinkLabel"
                      onChange={(event) => setJoinLinkLabel(event.target.value)}
                      placeholder="Ej. Sucursal centro"
                      value={joinLinkLabel}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={expiryId}>Vigencia</Label>
                    <Select
                      disabled={createJoinLinkMutation.isPending}
                      onValueChange={setExpiresInDays}
                      value={expiresInDays}
                    >
                      <SelectTrigger
                        className="w-full border-zinc-800 bg-black/30"
                        id={expiryId}
                      >
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOIN_LINK_EXPIRY_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                  disabled={createJoinLinkMutation.isPending}
                  type="submit"
                >
                  {createJoinLinkMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creando…
                    </>
                  ) : (
                    "Crear Link"
                  )}
                </Button>
              </form>
            ) : (
              <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
                <AlertTitle>Acceso restringido</AlertTitle>
                <AlertDescription>
                  Solo owners y admins pueden crear o revocar enlaces de acceso.
                </AlertDescription>
              </Alert>
            )}

            {latestJoinUrl ? (
              <div className="space-y-2 rounded-xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 p-4">
                <p className="font-medium text-sm text-white">
                  Último enlace generado
                </p>
                <Input
                  className="border-[var(--color-voltage)]/20 bg-black/20 text-sm"
                  readOnly
                  value={latestJoinUrl}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
          <CardHeader>
            <CardTitle>Modo de Alta</CardTitle>
            <CardDescription className="text-zinc-400">
              Política vigente para organizaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge
              className={
                data.policy.allowOrganizationCreation
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400"
              }
              variant="outline"
            >
              {data.policy.allowOrganizationCreation
                ? "Creación habilitada"
                : "Creación controlada"}
            </Badge>
            <p className="text-sm text-zinc-400">
              {data.policy.contactMessage}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Links de Acceso</CardTitle>
            <Badge className="text-zinc-400" variant="outline">
              {data.joinLinks.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {data.joinLinks.length > 0 ? (
            <div className="space-y-3">
              {data.joinLinks.map((joinLink) => (
                <div
                  className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={joinLink.id}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-white">
                        {joinLink.label || "Sin referencia"}
                      </p>
                      <JoinLinkStatusBadge status={joinLink.status} />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {joinLink.lastUsedAt
                        ? `Último uso ${organizationDateTimeFormatter.format(joinLink.lastUsedAt)}`
                        : "Sin uso todavía"}
                      <span className="mx-2 text-zinc-700">•</span>
                      Expira:{" "}
                      {joinLink.expiresAt
                        ? organizationDateTimeFormatter.format(
                            joinLink.expiresAt
                          )
                        : "Sin límite"}
                      <span className="mx-2 text-zinc-700">•</span>
                      Uso: {joinLink.useCount}/{joinLink.maxUses}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                      disabled={!isJoinLinkActive(joinLink.status)}
                      onClick={() => {
                        copyJoinUrl(joinLink.joinPath).catch(() => undefined);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Copy className="mr-1.5 size-3.5" />
                      Copiar
                    </Button>
                    {data.viewer.canManageAccess ? (
                      <Button
                        className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
                        disabled={
                          joinLink.status === "revoked" ||
                          revokeJoinLinkMutation.isPending
                        }
                        onClick={() => {
                          handleRevokeJoinLink(joinLink.id).catch(
                            () => undefined
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <XCircle className="mr-1.5 size-3.5" />
                        Revocar
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 border-dashed bg-black/10 p-8 text-center">
              <p className="text-sm text-zinc-500">
                No hay links de acceso creados todavía.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <CardTitle>Salir de la Organización</CardTitle>
          <CardDescription className="text-zinc-400">
            Si ya no necesitas acceso, puedes salir en cualquier momento. No
            puedes salir si eres el único owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
            disabled={leaveMutation.isPending}
            onClick={() => setShowLeaveDialog(true)}
            size="sm"
            variant="outline"
          >
            {leaveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 size-4" />
            )}
            Salir de la Organización
          </Button>
        </CardContent>
      </Card>

      <OrganizationLeaveDialog
        onOpenChange={setShowLeaveDialog}
        open={showLeaveDialog}
      />
    </div>
  );
}
