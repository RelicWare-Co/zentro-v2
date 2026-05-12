import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import type {
	ThermalReceiptInfoLine,
	ThermalReceiptProps,
	ThermalReceiptTotal,
} from "@/features/pos/components/ThermalReceipt";
import type { PosPrinterLanguage } from "@/features/pos/printing/printer-settings.local.client";

type EncodablePrinterLanguage = Exclude<PosPrinterLanguage, "auto">;

function toSingleLine(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function toList(values: Array<string | null | undefined>) {
	return values.reduce<string[]>((acc, value) => {
		if (typeof value === "string") {
			const trimmed = toSingleLine(value);
			if (trimmed.length > 0) acc.push(trimmed);
		}
		return acc;
	}, []);
}

function addDivider(encoder: ReceiptPrinterEncoder) {
	encoder.rule({ style: "single" });
}

function addSectionTitle(encoder: ReceiptPrinterEncoder, title: string) {
	encoder.bold(true);
	encoder.line(toSingleLine(title).toUpperCase());
	encoder.bold(false);
}

function printKeyValue(
	encoder: ReceiptPrinterEncoder,
	label: string,
	value: string,
	emphasis = false,
) {
	const cleanLabel = toSingleLine(label);
	const cleanValue = toSingleLine(value);
	const columns = encoder.columns;
	const rightColumnWidth = Math.max(10, Math.floor(columns * 0.35));
	const leftColumnWidth = columns - rightColumnWidth;

	if (emphasis) {
		encoder.bold(true);
	}

	encoder.table(
		[
			{ width: leftColumnWidth, align: "left" },
			{ width: rightColumnWidth, align: "right" },
		],
		[[cleanLabel, cleanValue]],
	);

	if (emphasis) {
		encoder.bold(false);
	}
}

function printInfoLines(
	encoder: ReceiptPrinterEncoder,
	infoLines: ThermalReceiptInfoLine[] | undefined,
) {
	const visibleInfoLines = (infoLines ?? []).filter((line) =>
		Boolean(line.value),
	);

	if (visibleInfoLines.length === 0) {
		return;
	}

	for (const line of visibleInfoLines) {
		printKeyValue(encoder, line.label, line.value ?? "");
	}
}

function printItems(
	encoder: ReceiptPrinterEncoder,
	items: ThermalReceiptProps["items"],
) {
	if (!items || items.length === 0) {
		return;
	}

	addSectionTitle(encoder, "Detalle");

	for (const item of items) {
		const label =
			typeof item.quantity === "number"
				? `${item.quantity} x ${item.label}`
				: item.label;
		printKeyValue(encoder, label, item.totalLabel || "");

		if (item.unitPriceLabel) {
			encoder.line(`  ${toSingleLine(item.unitPriceLabel)}`);
		}

		for (const line of toList(item.secondaryLines ?? [])) {
			encoder.line(`  ${line}`);
		}
	}
}

function printPayments(
	encoder: ReceiptPrinterEncoder,
	payments: ThermalReceiptProps["payments"],
) {
	if (!payments || payments.length === 0) {
		return;
	}

	addSectionTitle(encoder, "Pagos");

	for (const payment of payments) {
		printKeyValue(encoder, payment.label, payment.amountLabel);
		for (const line of toList(payment.secondaryLines ?? [])) {
			encoder.line(`  ${line}`);
		}
	}
}

function printTotals(
	encoder: ReceiptPrinterEncoder,
	totals: ThermalReceiptTotal[],
) {
	addSectionTitle(encoder, "Totales");

	for (const total of totals) {
		printKeyValue(encoder, total.label, total.value, total.emphasis ?? false);
	}
}

export function encodeThermalReceipt(options: {
	receipt: ThermalReceiptProps;
	language: EncodablePrinterLanguage;
	codepageMapping?: string | null;
}) {
	const encoder = new ReceiptPrinterEncoder({
		language: options.language,
		codepageMapping: options.codepageMapping ?? "epson",
		errors: "relaxed",
	});

	const receipt = options.receipt;

	encoder.initialize();
	encoder.codepage("auto");
	encoder.align("center");
	encoder.bold(true);
	encoder.line(toSingleLine(receipt.businessName ?? "Zentro"));
	encoder.bold(false);
	encoder.bold(true);
	encoder.line(toSingleLine(receipt.title));
	encoder.bold(false);

	for (const line of toList([
		receipt.documentLabel,
		receipt.issuedAtLabel,
		receipt.statusLabel,
	])) {
		encoder.line(line);
	}

	encoder.align("left");
	addDivider(encoder);
	printInfoLines(encoder, receipt.infoLines);

	if ((receipt.infoLines ?? []).some((line) => Boolean(line.value))) {
		addDivider(encoder);
	}

	printItems(encoder, receipt.items);
	if ((receipt.items ?? []).length > 0) {
		addDivider(encoder);
	}

	printPayments(encoder, receipt.payments);
	if ((receipt.payments ?? []).length > 0) {
		addDivider(encoder);
	}

	printTotals(encoder, receipt.totals);
	addDivider(encoder);

	encoder.align("center");
	for (const line of toList(receipt.footerLines ?? ["Gracias por su compra"])) {
		encoder.line(line);
	}

	encoder.newline(5);
	encoder.cut("partial");

	return encoder.encode();
}

export function encodeDrawerPulse(options: {
	language: EncodablePrinterLanguage;
	codepageMapping?: string | null;
}) {
	const encoder = new ReceiptPrinterEncoder({
		language: options.language,
		codepageMapping: options.codepageMapping ?? "epson",
		errors: "relaxed",
	});

	encoder.initialize();
	encoder.pulse(0, 100, 500);

	return encoder.encode();
}
