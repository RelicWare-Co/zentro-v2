import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";

const PRINT_WINDOW_STYLES = `
	:root {
		color-scheme: light;
	}

	* {
		box-sizing: border-box;
	}

	html, body {
		margin: 0;
		padding: 0;
		background: #fff;
	}

	@page {
		size: 80mm auto;
		margin: 6mm;
	}

	@media print {
		body {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
`;

export function printReceiptAsPdf(document: ThermalReceiptDocument) {
	if (typeof window === "undefined") {
		return false;
	}

	const printWindow = window.open("", "_blank", "width=520,height=900");
	if (!printWindow) {
		return printReceiptInCurrentWindow(document);
	}

	printWindow.document.open();
	printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${escapeHtml(document.title)}</title>
		<style>${PRINT_WINDOW_STYLES}</style>
	</head>
	<body>
		<div id="print-root"></div>
	</body>
</html>`);
	printWindow.document.close();

	const rootElement = printWindow.document.getElementById("print-root");
	if (!rootElement) {
		printWindow.close();
		return false;
	}

	const root = createRoot(rootElement);
	let isCleanedUp = false;

	const cleanup = () => {
		if (isCleanedUp) {
			return;
		}

		isCleanedUp = true;
		root.unmount();
		if (!printWindow.closed) {
			printWindow.close();
		}
	};

	printWindow.onafterprint = cleanup;
	printWindow.onbeforeunload = cleanup;

	root.render(
		<PrintLifecycle
			onReady={() => {
				printWindow.focus();
				printWindow.print();

				window.setTimeout(() => {
					cleanup();
				}, 1_500);
			}}
		>
			{document.content}
		</PrintLifecycle>,
	);

	return true;
}

function printReceiptInCurrentWindow(document: ThermalReceiptDocument) {
	const existingRoot = window.document.getElementById("zentro-print-root");
	if (existingRoot) {
		existingRoot.remove();
	}

	const existingStyle = window.document.querySelector(
		"style[data-zentro-print='true']",
	);
	existingStyle?.remove();

	const styleElement = window.document.createElement("style");
	styleElement.setAttribute("data-zentro-print", "true");
	styleElement.textContent = `
${PRINT_WINDOW_STYLES}
#zentro-print-root {
	position: fixed;
	inset: 0;
	overflow: auto;
	z-index: 2147483647;
	background: #fff;
	padding: 6mm;
}

@media print {
	body > *:not(#zentro-print-root):not(style[data-zentro-print='true']) {
		display: none !important;
	}

	#zentro-print-root {
		position: static;
		inset: auto;
		overflow: visible;
		padding: 0;
	}
}
`;
	window.document.head.appendChild(styleElement);

	const hostElement = window.document.createElement("div");
	hostElement.id = "zentro-print-root";
	window.document.body.appendChild(hostElement);

	const root = createRoot(hostElement);
	let isCleanedUp = false;

	const cleanup = () => {
		if (isCleanedUp) {
			return;
		}

		isCleanedUp = true;
		root.unmount();
		hostElement.remove();
		styleElement.remove();
	};

	window.addEventListener("afterprint", cleanup, { once: true });

	root.render(
		<PrintLifecycle
			onReady={() => {
				window.focus();
				window.print();

				window.setTimeout(() => {
					cleanup();
				}, 1_500);
			}}
		>
			{document.content}
		</PrintLifecycle>,
	);

	return true;
}

function PrintLifecycle({
	children,
	onReady,
}: {
	children: React.ReactNode;
	onReady: () => void;
}) {
	useEffect(() => {
		const timeoutId = window.setTimeout(onReady, 60);
		return () => window.clearTimeout(timeoutId);
	}, [onReady]);

	return <>{children}</>;
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
