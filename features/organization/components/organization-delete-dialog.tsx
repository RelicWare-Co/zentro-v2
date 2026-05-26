import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteOrganizationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

interface OrganizationDeleteDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function OrganizationDeleteDialog({
  open,
  onOpenChange,
}: OrganizationDeleteDialogProps) {
  const { state, actions } = useOrganizationPage();
  const data = state.data;
  const deleteMutation = useDeleteOrganizationMutation();
  const { runOrganizationTransition } = useOrganizationTransition();

  const handleDelete = async () => {
    if (!data) {
      return;
    }
    onOpenChange(false);
    actions.setFeedback(null);
    try {
      await deleteMutation.mutateAsync({
        organizationId: data.organization.id,
      });
      await runOrganizationTransition({
        destination: "/organization",
        message: "Organización eliminada. Abriendo selector...",
        prepare: async () => {
          const result = await authClient.organization.setActive({
            organizationId: null,
          });
          if (result?.error) {
            throw new Error(
              result.error.message ||
                "No se pudo abrir el selector de organización."
            );
          }
        },
      });
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo eliminar la organización."),
        "error"
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="border-red-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-200">
            <AlertTriangle className="size-5" />
            ¿Eliminar organización?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Esta acción no se puede deshacer. Todos los datos asociados
            (productos, ventas, miembros) serán eliminados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleDelete}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
