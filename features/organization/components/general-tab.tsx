import { Badge, Button, TextInput } from "@mantine/core";
import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { parseRoleList } from "@/features/organization/access-control.shared";
import { OrganizationDeleteDialog } from "@/features/organization/components/organization-delete-dialog";
import {
  Detail,
  OrgCard,
} from "@/features/organization/components/organization-ui-primitives";
import {
  useDeleteOrganizationMutation,
  useUpdateOrganizationMutation,
} from "@/features/organization/hooks/use-organization";
import { organizationDateFormatter } from "@/features/organization/organization-formatters.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { darkInputStyles } from "@/lib/mantine-dark";
import { formatOrganizationRoleLabel } from "@/lib/organization-shared";
import { getErrorMessage } from "@/lib/utils";

export function GeneralTab() {
  const { state, actions } = useOrganizationPage();
  const data = state.data;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(data?.organization.name ?? "");
  const [editSlug, setEditSlug] = useState(data?.organization.slug ?? "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateMutation = useUpdateOrganizationMutation();
  const deleteMutation = useDeleteOrganizationMutation();

  if (!data) {
    return null;
  }

  const isOwner = parseRoleList(data.viewer.role).includes("owner");

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    actions.setFeedback(null);
    try {
      await updateMutation.mutateAsync({
        name: editName || undefined,
        slug: editSlug || undefined,
      });
      await actions.refetchManagement();
      setIsEditing(false);
      actions.setFeedback("Organización actualizada.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo actualizar la organización."),
        "error"
      );
    }
  };

  return (
    <div className="space-y-6">
      <OrgCard
        description="Detalles básicos de la organización activa."
        title={
          <div className="flex w-full items-center justify-between gap-4">
            <span>Información General</span>
            {data.viewer.canManageAccess && !isEditing && (
              <Button
                color="gray"
                leftSection={<Pencil className="size-3.5" />}
                onClick={() => setIsEditing(true)}
                size="sm"
                variant="outline"
              >
                Editar
              </Button>
            )}
          </div>
        }
      >
        {isEditing ? (
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                disabled={updateMutation.isPending}
                label="Nombre"
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ej. Tienda Principal"
                styles={darkInputStyles}
                value={editName}
              />
              <TextInput
                disabled={updateMutation.isPending}
                label="Slug"
                onChange={(e) =>
                  setEditSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="tienda-principal"
                styles={darkInputStyles}
                value={editSlug}
              />
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                color="gray"
                disabled={updateMutation.isPending}
                onClick={() => {
                  setIsEditing(false);
                  setEditName(data.organization.name);
                  setEditSlug(data.organization.slug);
                }}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                c="black"
                color="voltage.5"
                leftSection={<Check className="size-4" />}
                loading={updateMutation.isPending}
                type="submit"
              >
                Guardar
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Nombre" value={data.organization.name} />
            <Detail label="Slug" value={`/${data.organization.slug}`} />
            <Detail label="ID" mono value={data.organization.id} />
            <Detail
              label="Creada"
              value={
                data.organization.createdAt
                  ? organizationDateFormatter.format(
                      data.organization.createdAt
                    )
                  : "N/A"
              }
            />
          </div>
        )}
      </OrgCard>

      <OrgCard
        description="Tu rol determina qué acciones puedes realizar."
        title="Permisos Actuales"
      >
        <div className="flex flex-wrap gap-2">
          <Badge color="gray" tt="none" variant="outline">
            {formatOrganizationRoleLabel(data.viewer.role)}
          </Badge>
          <Badge
            className={
              data.viewer.canManageAccess
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }
            tt="none"
            variant="outline"
          >
            {data.viewer.canManageAccess
              ? "Puede gestionar acceso"
              : "Acceso de lectura"}
          </Badge>
        </div>
      </OrgCard>

      {isOwner && (
        <OrgCard
          className="border-red-500/20 bg-red-500/5"
          description={
            <span className="text-red-200/60">
              Eliminar la organización es irreversible.
            </span>
          }
          title={<span className="text-red-200">Zona de Peligro</span>}
        >
          <Button
            color="red"
            leftSection={<Trash2 className="size-4" />}
            loading={deleteMutation.isPending}
            onClick={() => setShowDeleteDialog(true)}
            size="sm"
            variant="outline"
          >
            Eliminar Organización
          </Button>
        </OrgCard>
      )}

      <OrganizationDeleteDialog
        onOpenChange={setShowDeleteDialog}
        open={showDeleteDialog}
      />
    </div>
  );
}
