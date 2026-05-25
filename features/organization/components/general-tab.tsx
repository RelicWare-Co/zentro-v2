import { Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { parseRoleList } from "@/features/organization/access-control.shared";
import { OrganizationDeleteDialog } from "@/features/organization/components/organization-delete-dialog";
import { Detail } from "@/features/organization/components/organization-ui-primitives";
import {
  useDeleteOrganizationMutation,
  useUpdateOrganizationMutation,
} from "@/features/organization/hooks/use-organization";
import { organizationDateFormatter } from "@/features/organization/organization-formatters.shared";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
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
      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Información General</CardTitle>
              <CardDescription className="text-zinc-400">
                Detalles básicos de la organización activa.
              </CardDescription>
            </div>
            {data.viewer.canManageAccess && !isEditing && (
              <Button
                className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
                onClick={() => setIsEditing(true)}
                size="sm"
                variant="outline"
              >
                <Pencil className="mr-1.5 size-3.5" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form className="space-y-4" onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    className="border-zinc-800 bg-black/30"
                    disabled={updateMutation.isPending}
                    onChange={(e) => setEditName(e.target.value)}
                    value={editName}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    className="border-zinc-800 bg-black/30"
                    disabled={updateMutation.isPending}
                    onChange={(e) =>
                      setEditSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    value={editSlug}
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5"
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
                  className="bg-[var(--color-voltage)] text-black hover:bg-[#d9f15c]"
                  disabled={updateMutation.isPending}
                  type="submit"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      Guardar
                    </>
                  )}
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
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-[var(--color-carbon)] shadow-none">
        <CardHeader>
          <CardTitle>Permisos Actuales</CardTitle>
          <CardDescription className="text-zinc-400">
            Tu rol determina qué acciones puedes realizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge className="border-zinc-700 text-zinc-300" variant="outline">
            {formatOrganizationRoleLabel(data.viewer.role)}
          </Badge>
          <Badge
            className={
              data.viewer.canManageAccess
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }
            variant="outline"
          >
            {data.viewer.canManageAccess
              ? "Puede gestionar acceso"
              : "Acceso de lectura"}
          </Badge>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-red-500/20 bg-red-500/5 shadow-none">
          <CardHeader>
            <CardTitle className="text-red-200">Zona de Peligro</CardTitle>
            <CardDescription className="text-red-200/60">
              Eliminar la organización es irreversible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="border-red-500/30 bg-transparent text-red-200 hover:bg-red-500/10"
              disabled={deleteMutation.isPending}
              onClick={() => setShowDeleteDialog(true)}
              size="sm"
              variant="outline"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Eliminar Organización
            </Button>
          </CardContent>
        </Card>
      )}

      <OrganizationDeleteDialog
        onOpenChange={setShowDeleteDialog}
        open={showDeleteDialog}
      />
    </div>
  );
}
