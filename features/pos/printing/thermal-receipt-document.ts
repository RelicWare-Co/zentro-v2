import type { ReactNode } from "react";
import type { ThermalReceiptProps } from "@/features/pos/components/ThermalReceipt";

export type ThermalReceiptDocument = {
	title: string;
	content: ReactNode;
	receipt: ThermalReceiptProps;
};
