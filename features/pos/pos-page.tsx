import type { ReactNode } from "react";
import { PosModals } from "@/features/pos/components/pos-modals";
import { PosV1Layout } from "@/features/pos/components/pos-v1-layout";
import {
  PosPageProvider,
  type PosPageVariant,
} from "@/features/pos/pos-page-context";
import { PosV2Layout } from "@/features/posv2/components/pos-v2-layout";

function PosPageRoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function PosV1PageLayout() {
  return (
    <>
      <PosV1Layout />
      <PosModals />
    </>
  );
}

function PosV2PageLayout() {
  return (
    <>
      <PosV2Layout />
      <PosModals />
    </>
  );
}

export function PosPage({ variant }: { variant: PosPageVariant }) {
  return (
    <PosPageProvider variant={variant}>
      {variant === "v1" ? <PosV1PageLayout /> : <PosV2PageLayout />}
    </PosPageProvider>
  );
}

export const PosPageCompound = {
  Provider: PosPageProvider,
  Root: PosPageRoot,
  V1Layout: PosV1PageLayout,
  V2Layout: PosV2PageLayout,
  Modals: PosModals,
};
