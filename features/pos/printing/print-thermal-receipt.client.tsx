import { notifications } from "@mantine/notifications";
import { ThermalReceipt } from "@/features/pos/components/thermal-receipt";
import { printReceiptAsPdf } from "@/features/pos/printing/print-receipt-as-pdf.client";
import { getPosPrinterManager } from "@/features/pos/printing/printer-manager.client";
import { readPosLocalPrinterSettings } from "@/features/pos/printing/printer-settings.local.client";
import type { ThermalReceiptDocument } from "@/features/pos/printing/thermal-receipt-document";

function isBrowserEnvironment() {
  return typeof window !== "undefined";
}

export async function printThermalReceipt(
  document: ThermalReceiptDocument,
  organizationId?: string | null
) {
  if (!isBrowserEnvironment()) {
    return false;
  }

  const settings = readPosLocalPrinterSettings(organizationId);
  if (settings.outputMode === "pdf") {
    return printReceiptAsPdf(document, settings);
  }

  try {
    await getPosPrinterManager().printReceipt(document, organizationId);
    return true;
  } catch (error) {
    notifications.show({
      title: "Impresora térmica no disponible",
      message:
        error instanceof Error
          ? error.message
          : "Se generará un PDF como respaldo.",
      color: "yellow",
    });
    return printReceiptAsPdf(document, settings);
  }
}

export async function connectPosPrinter(organizationId?: string | null) {
  if (!isBrowserEnvironment()) {
    return false;
  }

  await getPosPrinterManager().connectWithPrompt(
    readPosLocalPrinterSettings(organizationId),
    organizationId
  );
  return true;
}

export async function reconnectPosPrinter(
  options?: { silent?: boolean },
  organizationId?: string | null
) {
  if (!isBrowserEnvironment()) {
    return false;
  }

  return await getPosPrinterManager().reconnectSaved(
    readPosLocalPrinterSettings(organizationId),
    {
      silent: options?.silent,
    },
    organizationId
  );
}

export async function disconnectPosPrinter() {
  if (!isBrowserEnvironment()) {
    return false;
  }

  await getPosPrinterManager().disconnect();
  return true;
}

export async function openPosCashDrawer(organizationId?: string | null) {
  if (!isBrowserEnvironment()) {
    return false;
  }

  await getPosPrinterManager().openCashDrawer(organizationId);
  return true;
}

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function buildPosPrinterTestDocument(): ThermalReceiptDocument {
  const issuedAt = dateFormatter.format(new Date());

  const receipt = {
    title: "Prueba de impresión",
    documentLabel: "Ticket de validación",
    issuedAtLabel: issuedAt,
    statusLabel: "Estado: Conectado",
    infoLines: [
      { label: "Sistema", value: "Zentro POS" },
      { label: "Canal", value: "Ajustes > Impresión local" },
    ],
    items: [
      {
        label: "Item de prueba",
        quantity: 1,
        unitPriceLabel: "$ 1.000 c/u",
        totalLabel: "$ 1.000",
        secondaryLines: ["Verifica texto, acentos y alineación"],
      },
    ],
    payments: [
      {
        label: "Efectivo",
        amountLabel: "$ 1.000",
      },
    ],
    totals: [
      {
        label: "Total",
        value: "$ 1.000",
        emphasis: true,
      },
    ],
    footerLines: ["Si ves este mensaje, la impresora responde correctamente."],
  };

  return {
    title: "Prueba impresora POS",
    receipt,
    content: <ThermalReceipt {...receipt} />,
  };
}

export function printPosPrinterTestDocument(organizationId?: string | null) {
  return printThermalReceipt(buildPosPrinterTestDocument(), organizationId);
}
