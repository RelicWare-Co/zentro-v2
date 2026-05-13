import type { ReactNode } from "react";
import type { ThermalReceiptProps } from "@/features/pos/components/ThermalReceipt";

export interface ThermalReceiptDocument {
  content: ReactNode;
  receipt: ThermalReceiptProps;
  title: string;
}
