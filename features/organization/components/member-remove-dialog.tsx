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
import { useRemoveMemberMutation } from "@/features/organization/hooks/use-organization";
import { useOrganizationPage } from "@/features/organization/organization-page-context";
import { getErrorMessage } from "@/lib/utils";

interface MemberRemoveDialogProps {
  member: { memberId: string; name: string } | null;
  onOpenChange: () => void;
  open: boolean;
}

export function MemberRemoveDialog({
  open,
  onOpenChange,
  member,
}: MemberRemoveDialogProps) {
  const { actions } = useOrganizationPage();
  const removeMutation = useRemoveMemberMutation();

  const handleRemove = async () => {
    if (!member) {
      return;
    }
    const target = member.memberId;
    onOpenChange();
    actions.setFeedback(null);
    try {
      await removeMutation.mutateAsync({ memberIdOrEmail: target });
      await actions.refetchManagement();
      actions.setFeedback("Miembro removido.");
    } catch (error) {
      actions.setFeedback(
        getErrorMessage(error, "No se pudo remover al miembro."),
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
            Remover miembro
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            ¿Seguro que deseas remover a <strong>{member?.name}</strong> de la
            organización?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-white/5">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleRemove}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
