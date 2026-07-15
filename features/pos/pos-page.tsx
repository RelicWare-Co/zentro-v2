import { PosLayout } from "@/features/pos/components/pos-layout";
import { PosModals } from "@/features/pos/components/pos-modals";
import { PosPageProvider } from "@/features/pos/pos-page-context";

function PosPageLayout() {
  return (
    <>
      <PosLayout />
      <PosModals />
    </>
  );
}

export function PosPage() {
  return (
    <PosPageProvider>
      <PosPageLayout />
    </PosPageProvider>
  );
}
