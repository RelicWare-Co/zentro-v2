import { useModuleCapabilities } from "@/features/modules/hooks/use-module-capabilities";
import { usePosExtensions } from "@/features/modules/hooks/use-pos-extensions";
import { CashMovementModal } from "@/features/pos/components/modals/cash-movement-modal";
import { CheckoutModal } from "@/features/pos/components/modals/checkout-modal";
import { CloseShiftModal } from "@/features/pos/components/modals/close-shift-modal";
import { CreateCustomerModal } from "@/features/pos/components/modals/create-customer-modal";
import { ModifierModal } from "@/features/pos/components/modals/modifier-modal";
import { OpenShiftModal } from "@/features/pos/components/modals/open-shift-modal";
import { ShiftRequiredDialog } from "@/features/pos/components/modals/shift-required-dialog";
import type { PosExtensionRenderProps } from "@/features/pos/pos-extension.shared";
import { usePosPage } from "@/features/pos/pos-page-context";
import { CheckoutDetailsModal } from "@/features/posv2/components/checkout-details-modal";

export function PosModals() {
  const { state, actions, meta } = usePosPage();
  const moduleCapabilities = useModuleCapabilities();
  const extensions = usePosExtensions(moduleCapabilities.data?.modules);

  const extensionRenderProps: PosExtensionRenderProps = {
    activeModal: state.activeModal,
    onCloseModal: actions.closeActiveModal,
    onOpenModal: actions.openActiveModal,
    saleMode: {
      enterMode: (payload: unknown) =>
        actions.enterTableMode(payload as string),
      modeId: state.tableSession ? "table" : "counter",
      sessionState: state.tableSession,
      tableId: state.tableSession?.tableId ?? null,
    },
  };

  const modalExtensions = extensions.filter((ext) => ext.slot === "modal");

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
      {modalExtensions.map(({ Component, id }) => (
        <Component key={id} {...extensionRenderProps} />
      ))}
    </>
  );
}
