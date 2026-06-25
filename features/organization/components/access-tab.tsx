import { Alert, Badge, Button, Select, TextInput } from "@mantine/core";
import { Copy, LogOut, XCircle } from "lucide-react";
import { useState } from "react";
import { OrganizationLeaveDialog } from "@/features/organization/components/organization-leave-dialog";
import {
  JoinLinkStatusBadge,
  OrgCard,
} from "@/features/organization/components/organization-ui-primitives";
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
        <OrgCard
          className="lg:col-span-2"
          description="Genera un enlace de un solo uso para sumar miembros."
          title="Crear Link de Acceso"
        >
          {data.viewer.canManageAccess ? (
            <form className="space-y-4" onSubmit={handleCreateJoinLink}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  autoComplete="off"
                  disabled={createJoinLinkMutation.isPending}
                  label="Referencia"
                  name="joinLinkLabel"
                  onChange={(event) => setJoinLinkLabel(event.target.value)}
                  placeholder="Ej. Sucursal centro"
                  value={joinLinkLabel}
                />
                <Select
                  allowDeselect={false}
                  data={JOIN_LINK_EXPIRY_OPTIONS.map((option) => ({
                    value: String(option.value),
                    label: option.label,
                  }))}
                  disabled={createJoinLinkMutation.isPending}
                  label="Vigencia"
                  onChange={(value) => setExpiresInDays(value ?? "7")}
                  placeholder="Selecciona"
                  value={expiresInDays}
                />
              </div>
              <Button
                c="black"
                color="voltage.5"
                loading={createJoinLinkMutation.isPending}
                type="submit"
              >
                Crear Link
              </Button>
            </form>
          ) : (
            <Alert color="yellow" title="Acceso restringido" variant="light">
              Solo owners y admins pueden crear o revocar enlaces de acceso.
            </Alert>
          )}

          {latestJoinUrl ? (
            <div className="space-y-2 rounded-xl border border-[var(--color-voltage)]/20 bg-[var(--color-voltage)]/10 p-4">
              <p className="font-medium text-sm text-white">
                Último enlace generado
              </p>
              <TextInput readOnly value={latestJoinUrl} />
            </div>
          ) : null}
        </OrgCard>

        <OrgCard
          description="Política vigente para organizaciones."
          title="Modo de Alta"
        >
          <Badge
            className={
              data.policy.allowOrganizationCreation
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }
            tt="none"
            variant="outline"
          >
            {data.policy.allowOrganizationCreation
              ? "Creación habilitada"
              : "Creación controlada"}
          </Badge>
          <p className="text-sm text-zinc-400">{data.policy.contactMessage}</p>
        </OrgCard>
      </div>

      <OrgCard
        title={
          <div className="flex w-full items-center justify-between gap-4">
            <span>Links de Acceso</span>
            <Badge color="gray" tt="none" variant="outline">
              {data.joinLinks.length} total
            </Badge>
          </div>
        }
      >
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
                      ? organizationDateTimeFormatter.format(joinLink.expiresAt)
                      : "Sin límite"}
                    <span className="mx-2 text-zinc-700">•</span>
                    Uso: {joinLink.useCount}/{joinLink.maxUses}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    color="gray"
                    disabled={!isJoinLinkActive(joinLink.status)}
                    leftSection={<Copy className="size-3.5" />}
                    onClick={() => {
                      copyJoinUrl(joinLink.joinPath).catch(() => undefined);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Copiar
                  </Button>
                  {data.viewer.canManageAccess ? (
                    <Button
                      color="red"
                      disabled={
                        joinLink.status === "revoked" ||
                        revokeJoinLinkMutation.isPending
                      }
                      leftSection={<XCircle className="size-3.5" />}
                      onClick={() => {
                        handleRevokeJoinLink(joinLink.id).catch(
                          () => undefined
                        );
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
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
      </OrgCard>

      <OrgCard
        description="Si ya no necesitas acceso, puedes salir en cualquier momento. No puedes salir si eres el único owner."
        title="Salir de la Organización"
      >
        <Button
          color="gray"
          leftSection={<LogOut className="size-4" />}
          loading={leaveMutation.isPending}
          onClick={() => setShowLeaveDialog(true)}
          size="sm"
          variant="outline"
        >
          Salir de la Organización
        </Button>
      </OrgCard>

      <OrganizationLeaveDialog
        onOpenChange={setShowLeaveDialog}
        open={showLeaveDialog}
      />
    </div>
  );
}
