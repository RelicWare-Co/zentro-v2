import { PosModals } from "@/features/pos/components/pos-modals";
import { PosPageProvider } from "@/features/pos/pos-page-context";
import { PosV2Layout } from "@/features/posv2/components/pos-v2-layout";

export default function PosV2Page() {
  return (
    <PosPageProvider variant="v2">
      <PosV2Layout />
      <PosModals />
    </PosPageProvider>
  );
}
