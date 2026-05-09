import {
	ThermalReceipt,
	type ThermalReceiptItem,
} from "@/features/pos/components/ThermalReceipt";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";
import { formatCurrency, formatPaymentMethodLabel } from "@/features/pos/utils";

const receiptDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
	dateStyle: "medium",
	timeStyle: "short",
});

export function buildSaleReceiptDocument(input: {
	documentId: string;
	issuedAt: Date | number;
	status: string;
	customerName: string;
	customerMeta?: string | null;
	cashierName?: string | null;
	terminalName?: string | null;
	items: Array<{
		name: string;
		quantity: number;
		unitPrice: number;
		totalAmount: number;
		discountAmount?: number;
		modifiers?: Array<{
			name: string;
			quantity: number;
			unitPrice?: number;
		}>;
	}>;
	payments: Array<{
		method: string;
		amount: number;
		reference?: string | null;
	}>;
	subtotal: number;
	taxAmount: number;
	discountAmount: number;
	totalAmount: number;
	paidAmount: number;
	balanceDue: number;
	paymentMethodLabels?: Record<string, string>;
}): ThermalReceiptDocument {
	const items: ThermalReceiptItem[] = input.items.map((item) => {
		const secondaryLines = (item.modifiers ?? []).map(
			(modifier) =>
				`+ ${modifier.quantity} x ${modifier.name} (${formatCurrency(modifier.unitPrice ?? 0)})`,
		);

		if ((item.discountAmount ?? 0) > 0) {
			secondaryLines.push(
				`Descuento item: ${formatCurrency(item.discountAmount ?? 0)}`,
			);
		}

		return {
			label: item.name,
			quantity: item.quantity,
			unitPriceLabel: `${formatCurrency(item.unitPrice)} c/u`,
			totalLabel: formatCurrency(item.totalAmount),
			secondaryLines,
		};
	});

	const receipt = {
		title: "Factura de venta",
		documentLabel: `Documento #${input.documentId.slice(0, 8)}`,
		issuedAtLabel: receiptDateTimeFormatter.format(new Date(input.issuedAt)),
		statusLabel: `Estado: ${formatSaleStatus(input.status)}`,
		infoLines: [
			{
				label: "Cliente",
				value: input.customerName,
			},
			{
				label: "Contacto",
				value: input.customerMeta,
			},
			{
				label: "Cajero",
				value: input.cashierName,
			},
			{
				label: "Terminal",
				value: input.terminalName,
			},
		],
		items,
		payments: input.payments.map((payment) => ({
			label: formatPaymentMethodLabel(
				payment.method,
				input.paymentMethodLabels,
			),
			amountLabel: formatCurrency(payment.amount),
			secondaryLines: payment.reference
				? [`Ref. ${payment.reference}`]
				: undefined,
		})),
		totals: [
			{
				label: "Subtotal",
				value: formatCurrency(input.subtotal),
			},
			{
				label: "Impuestos",
				value: formatCurrency(input.taxAmount),
			},
			{
				label: "Descuentos",
				value: formatCurrency(input.discountAmount),
			},
			{
				label: "Total",
				value: formatCurrency(input.totalAmount),
				emphasis: true,
			},
			{
				label: "Pagado",
				value: formatCurrency(input.paidAmount),
			},
			{
				label: "Saldo pendiente",
				value: formatCurrency(input.balanceDue),
				emphasis: input.balanceDue > 0,
			},
		],
		footerLines: [
			input.balanceDue > 0
				? `Saldo a crédito: ${formatCurrency(input.balanceDue)}`
				: "Pago recibido correctamente",
			"Gracias por su compra",
		],
	};

	return {
		title: `Venta ${input.documentId.slice(0, 8)}`,
		content: <ThermalReceipt {...receipt} />,
		receipt,
	};
}

export function buildPaymentReceiptDocument(input: {
	paymentId: string;
	saleId?: string | null;
	issuedAt: Date | number;
	customerName: string;
	cashierName?: string | null;
	terminalName?: string | null;
	method: string;
	amount: number;
	reference?: string | null;
	notes?: string | null;
	remainingSaleBalance?: number | null;
	remainingAccountBalance?: number | null;
	title?: string;
	paymentMethodLabels?: Record<string, string>;
}): ThermalReceiptDocument {
	const hasRemainingSaleBalance =
		typeof input.remainingSaleBalance === "number";
	const isSaleSettled = (input.remainingSaleBalance ?? 0) <= 0;

	const receipt = {
		title: input.title ?? "Comprobante de pago",
		documentLabel: `Pago #${input.paymentId.slice(0, 8)}`,
		issuedAtLabel: receiptDateTimeFormatter.format(new Date(input.issuedAt)),
		statusLabel: hasRemainingSaleBalance
			? `Venta ${isSaleSettled ? "saldada" : "con saldo"}`
			: undefined,
		infoLines: [
			{
				label: "Venta",
				value: input.saleId ? `#${input.saleId.slice(0, 8)}` : null,
			},
			{
				label: "Cliente",
				value: input.customerName,
			},
			{
				label: "Cajero",
				value: input.cashierName,
			},
			{
				label: "Terminal",
				value: input.terminalName,
			},
		],
		payments: [
			{
				label: formatPaymentMethodLabel(
					input.method,
					input.paymentMethodLabels,
				),
				amountLabel: formatCurrency(input.amount),
				secondaryLines: [
					...(input.reference ? [`Ref. ${input.reference}`] : []),
					...(input.notes ? [`Nota: ${input.notes}`] : []),
				],
			},
		],
		totals: [
			{
				label: "Pago aplicado",
				value: formatCurrency(input.amount),
				emphasis: true,
			},
			...(typeof input.remainingSaleBalance === "number"
				? [
						{
							label: "Saldo venta",
							value: formatCurrency(input.remainingSaleBalance),
							emphasis: input.remainingSaleBalance > 0,
						},
					]
				: []),
			...(typeof input.remainingAccountBalance === "number"
				? [
						{
							label: "Saldo cuenta",
							value: formatCurrency(input.remainingAccountBalance),
							emphasis: input.remainingAccountBalance > 0,
						},
					]
				: []),
		],
		footerLines: [
			...(hasRemainingSaleBalance
				? [
						isSaleSettled
							? "La venta quedó completamente pagada."
							: "El saldo restante sigue pendiente.",
					]
				: []),
			"Conserve este comprobante",
		],
	};

	return {
		title: `Pago ${input.paymentId.slice(0, 8)}`,
		content: <ThermalReceipt {...receipt} />,
		receipt,
	};
}

function formatSaleStatus(status: string) {
	if (status === "credit") {
		return "Crédito";
	}

	if (status === "completed") {
		return "Pagada";
	}

	if (status === "cancelled") {
		return "Cancelada";
	}

	return status;
}
