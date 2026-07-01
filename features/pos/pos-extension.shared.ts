import type { ComponentType } from "react";
import type { PosTableSessionState } from "@/features/pos/sale-modes/types";

export type PosExtensionSlot = "catalog-overlay" | "header-action" | "modal";

export interface PosExtensionSaleModeInfo {
  enterMode: ((payload: unknown) => void) | null;
  modeId: string;
  sessionState: PosTableSessionState | null;
  tableId: string | null;
}

export interface PosExtensionRenderProps {
  activeModal: string | null;
  onCloseModal: () => void;
  onOpenModal: (id: string) => void;
  saleMode: PosExtensionSaleModeInfo | null;
}

export interface PosExtension {
  Component: ComponentType<PosExtensionRenderProps>;
  id: string;
  slot: PosExtensionSlot;
}
