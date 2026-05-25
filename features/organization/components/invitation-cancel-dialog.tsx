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
import { useCancelInvitationMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { getErrorMessage } from "@/lib/utils";

interface InvitationCancelDialogProps {
  invitationId: string | null;
  onOpenChange: () => void;
  open: boolean;
}

export function InvitationCancelDialog({
  open,
  onOpenChange,
  invitationId,
}: InvitationCancelDialogProps) {
  const { actions } = useOrganizationPage();
  const cancelMutation = useCancelInvitationMutation();

  const handleCancel = async () => {
    if (!invitationId) {
      return;
    }
    const id = invitationId;
    onOpenChange();
    actions.setFeedback(null);
    try {
      await cancelMutation.mutateAsync({ invitationId: id });
      await actions.refetchManagement();
      actions.setFeedback("Invitación cancelada.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo cancelar la invitación."),
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
            Cancelar invitación
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            La invitación será cancelada y el destinatario no podrá aceptarla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Volver
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleCancel}
          >
            Cancelar Invitación
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
