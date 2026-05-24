import { PosModals } from "@/features/pos/components/pos-modals";
import { PosV1Layout } from "@/features/pos/components/pos-v1-layout";
import { PosPageProvider } from "@/features/pos/pos-page-context";

export default function PosPage() {
  return (
    <PosPageProvider variant="v1">
      <PosV1Layout />
      <PosModals />
    </PosPageProvider>
  );
}
