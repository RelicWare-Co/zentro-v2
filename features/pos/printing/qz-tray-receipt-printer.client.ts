import qz from "qz-tray";
import type { PosPrinterQzConfig } from "@/features/pos/printing/printer-settings.local.client";

/**
 * QZ Tray driver that mirrors the small event/print surface the rest of the POS
 * printer manager expects from the @point-of-sale receipt printer drivers
 * (connect / reconnect / disconnect / print / addEventListener). Instead of
 * talking to a browser device API (WebUSB / WebSerial / WebBluetooth), it talks
 * to the locally installed QZ Tray companion app over its websocket and prints
 * raw ESC/POS bytes by printer name.
 */

interface QzConnectedDevicePayload {
  codepageMapping: null;
  language: null;
  name: string;
  type: "qz";
}

type ConnectedListener = (device: QzConnectedDevicePayload) => void;
type DisconnectedListener = () => void;
type DataListener = (data: DataView | Uint8Array) => void;

const HOST_PROTOCOL_PATTERN = /^(?:\w+:)?\/\/([^/]+).*/i;

let securityConfigured = false;

function ensureSecurityConfigured() {
  if (securityConfigured) {
    return;
  }
  securityConfigured = true;

  // Unsigned / anonymous mode: we do not ship a private key in the browser, so
  // QZ Tray will prompt the operator to allow the request the first time (they
  // can tick "Remember this decision"). This avoids needing a backend signing
  // endpoint while keeping printing functional.
  qz.security.setCertificatePromise((resolve) => {
    resolve();
  });
  qz.security.setSignaturePromise(() => (resolve) => {
    resolve();
  });
}

function normalizeHost(host: string): string | undefined {
  const trimmed = host.trim();
  if (trimmed.length === 0) {
    return;
  }

  // Accept pasted values like "wss://host:8181" by stripping the protocol.
  return trimmed.replace(HOST_PROTOCOL_PATTERN, "$1");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x80_00;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function ensureWebsocketConnected(config: PosPrinterQzConfig) {
  ensureSecurityConfigured();

  if (qz.websocket.isActive()) {
    return;
  }

  const host = normalizeHost(config.host);
  const connectOptions: Parameters<typeof qz.websocket.connect>[0] = {};
  if (host) {
    connectOptions.host = host;
  }
  if (config.usingSecure) {
    connectOptions.usingSecure = true;
  }

  await qz.websocket.connect(connectOptions);
}

/**
 * Lists the printers QZ Tray can see. Used by the settings UI to let the
 * operator pick a target printer.
 */
export async function listQzPrinters(
  config: PosPrinterQzConfig
): Promise<string[]> {
  await ensureWebsocketConnected(config);
  const found = await qz.printers.find();
  if (Array.isArray(found)) {
    return found;
  }
  return found ? [found] : [];
}

export default class QzTrayReceiptPrinter {
  private readonly config: PosPrinterQzConfig;
  private printerName: string | null = null;
  private closedCallbackBound = false;
  private readonly connectedListeners = new Set<ConnectedListener>();
  private readonly disconnectedListeners = new Set<DisconnectedListener>();
  private readonly dataListeners = new Set<DataListener>();

  constructor(config: PosPrinterQzConfig) {
    this.config = config;
  }

  addEventListener(event: "connected", listener: ConnectedListener): void;
  addEventListener(event: "disconnected", listener: DisconnectedListener): void;
  addEventListener(event: "data", listener: DataListener): void;
  addEventListener(
    event: "connected" | "disconnected" | "data",
    listener: ConnectedListener | DisconnectedListener | DataListener
  ): void {
    if (event === "connected") {
      this.connectedListeners.add(listener as ConnectedListener);
      return;
    }
    if (event === "disconnected") {
      this.disconnectedListeners.add(listener as DisconnectedListener);
      return;
    }
    this.dataListeners.add(listener as DataListener);
  }

  async connect(): Promise<void> {
    await ensureWebsocketConnected(this.config);
    this.bindClosedCallback();
    const printerName = await this.resolvePrinterName(this.config.printerName);
    this.emitConnected(printerName);
  }

  async reconnect(device: unknown): Promise<void> {
    const preferred = this.readPrinterNameFromDevice(device);
    await ensureWebsocketConnected(this.config);
    this.bindClosedCallback();
    const printerName = await this.resolvePrinterName(
      preferred ?? this.config.printerName
    );
    this.emitConnected(printerName);
  }

  async disconnect(): Promise<void> {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } finally {
      this.emitDisconnected();
    }
  }

  async print(data: Uint8Array | ArrayLike<number>): Promise<void> {
    if (!this.printerName) {
      throw new Error(
        "No hay impresora QZ seleccionada. Conéctala desde Ajustes."
      );
    }

    await ensureWebsocketConnected(this.config);

    const bytes = data instanceof Uint8Array ? data : Uint8Array.from(data);
    const base64Data = bytesToBase64(bytes);
    const printerConfig = qz.configs.create(this.printerName);

    await qz.print(printerConfig, [
      {
        type: "raw",
        format: "command",
        flavor: "base64",
        data: base64Data,
      },
    ]);
  }

  private bindClosedCallback() {
    if (this.closedCallbackBound) {
      return;
    }
    this.closedCallbackBound = true;
    qz.websocket.setClosedCallbacks(() => {
      this.emitDisconnected();
    });
  }

  private readPrinterNameFromDevice(device: unknown): string | null {
    if (
      device &&
      typeof device === "object" &&
      "printerName" in device &&
      typeof (device as { printerName: unknown }).printerName === "string"
    ) {
      const value = (device as { printerName: string }).printerName.trim();
      return value.length > 0 ? value : null;
    }
    return null;
  }

  private async resolvePrinterName(preferred: string | null): Promise<string> {
    const configured = preferred?.trim();
    if (configured && configured.length > 0) {
      const found = await qz.printers.find(configured);
      if (typeof found === "string" && found.length > 0) {
        return found;
      }
      if (Array.isArray(found) && found.length > 0) {
        return found[0];
      }
      return configured;
    }

    const defaultPrinter = await qz.printers.getDefault();
    if (!defaultPrinter) {
      throw new Error(
        "No hay impresora predeterminada en QZ Tray. Selecciona una en Ajustes."
      );
    }
    return defaultPrinter;
  }

  private emitConnected(printerName: string) {
    this.printerName = printerName;
    const payload: QzConnectedDevicePayload = {
      type: "qz",
      name: printerName,
      language: null,
      codepageMapping: null,
    };
    for (const listener of this.connectedListeners) {
      listener(payload);
    }
  }

  private emitDisconnected() {
    this.printerName = null;
    for (const listener of this.disconnectedListeners) {
      listener();
    }
  }
}
