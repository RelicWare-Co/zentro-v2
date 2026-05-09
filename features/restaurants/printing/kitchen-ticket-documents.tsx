import { ThermalReceipt } from "@/features/pos/components/ThermalReceipt";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";
import { formatCurrency } from "@/features/pos/utils";

const ticketDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	dateStyle: "short",
	timeStyle: "short",
});

export function buildKitchenTicketDocument(input: {
	ticketId: string;
	orderNumber: number;
	sequenceNumber: number;
	createdAt: number | Date;
	tableName: string;
	areaName: string | null;
	items: Array<{
		productName: string;
		quantity: number;
		notes?: string | null;
		modifiers?: Array<{
			name: string;
			quantity: number;
			unitPrice: number;
		}>;
		totalAmount?: number;
	}>;
}): ThermalReceiptDocument {
	const receipt = {
		title: "Comanda de cocina",
		documentLabel: `Orden #${input.orderNumber} • Ticket ${input.sequenceNumber}`,
		issuedAtLabel: ticketDateTimeFormatter.format(new Date(input.createdAt)),
		infoLines: [
			{
				label: "Mesa",
				value: input.tableName,
			},
			{
				label: "Zona",
				value: input.areaName,
			},
		],
		items: input.items.map((item) => ({
			label: item.productName,
			quantity: item.quantity,
			totalLabel:
				typeof item.totalAmount === "number"
					? formatCurrency(item.totalAmount)
					: "",
			secondaryLines: [
				...(item.notes ? [`Nota: ${item.notes}`] : []),
				...(item.modifiers ?? []).map(
					(modifier) => `+ ${modifier.quantity} x ${modifier.name}`,
				),
			],
		})),
		totals: [
			{
				label: "Items",
				value: `${input.items.reduce((sum, item) => sum + item.quantity, 0)}`,
				emphasis: true,
			},
		],
		footerLines: ["Preparar y pasar a servicio"],
	};

	return {
		title: `Cocina ${input.ticketId.slice(0, 8)}`,
		content: <ThermalReceipt {...receipt} />,
		receipt,
	};
}
