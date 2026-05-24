import { CashMovementModal } from "@/features/pos/components/modals/cash-movement-modal";
import { CheckoutModal } from "@/features/pos/components/modals/checkout-modal";
import { CloseShiftModal } from "@/features/pos/components/modals/close-shift-modal";
import { CreateCustomerModal } from "@/features/pos/components/modals/create-customer-modal";
import { ModifierModal } from "@/features/pos/components/modals/modifier-modal";
import { OpenShiftModal } from "@/features/pos/components/modals/open-shift-modal";
import { ShiftRequiredDialog } from "@/features/pos/components/modals/shift-required-dialog";
import { usePosPage } from "@/features/pos/pos-page-context";
import { CheckoutDetailsModal } from "@/features/posv2/components/checkout-details-modal";

export function PosModals() {
  const { meta } = usePosPage();

  return (
    <>
      <OpenShiftModal />
      <CashMovementModal />
      <CloseShiftModal />
      <CreateCustomerModal />
      <ModifierModal />
      <ShiftRequiredDialog />
      {meta.variant === "v1" ? <CheckoutModal /> : null}
      {meta.variant === "v2" ? <CheckoutDetailsModal /> : null}
    </>
  );
}
