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
import { useLeaveOrganizationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { useOrganizationTransition } from "@/features/organization/organization-transition-context";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";

interface OrganizationLeaveDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function OrganizationLeaveDialog({
  open,
  onOpenChange,
}: OrganizationLeaveDialogProps) {
  const { state, actions } = useOrganizationPage();
  const data = state.data;
  const leaveMutation = useLeaveOrganizationMutation();
  const { runOrganizationTransition } = useOrganizationTransition();

  const handleLeave = async () => {
    if (!data) {
      return;
    }
    onOpenChange(false);
    actions.setFeedback(null);
    try {
      await leaveMutation.mutateAsync({
        organizationId: data.organization.id,
      });
      await runOrganizationTransition({
        destination: "/organization",
        message: "Saliste de la organización. Abriendo selector...",
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
        getErrorMessage(error, "No se pudo salir de la organización."),
        "error"
      );
    }
  };

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="border-amber-500/20 bg-[var(--color-carbon)] text-[var(--color-photon)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="size-5" />
            ¿Salir de la organización?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Perderás acceso a todos los datos de{" "}
            <strong>{data?.organization.name}</strong>. Esta acción no se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-500 text-black hover:bg-amber-600"
            onClick={handleLeave}
          >
            Salir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
