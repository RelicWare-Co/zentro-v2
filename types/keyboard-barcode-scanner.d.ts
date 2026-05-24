declare module "@point-of-sale/keyboard-barcode-scanner" {
  export interface KeyboardBarcodeScannerOptions {
    allowedSymbologies?: string[];
    debug?: boolean;
    guessSymbology?: boolean;
    timing?: "auto" | number;
  }

  export interface KeyboardBarcodeScannerGs1Element {
    ai: string;
    label: string;
    value: string;
  }

  export interface KeyboardBarcodeScannerGs1Data {
    elements?: KeyboardBarcodeScannerGs1Element[];
    gtin?: string;
  }

  export interface KeyboardBarcodeScannerEvent {
    aim?: string;
    bytes?: Uint8Array[];
    data?: KeyboardBarcodeScannerGs1Data;
    guess?: boolean;
    symbology?: string;
    value: string;
  }

  export interface KeyboardBarcodeScannerConnection {
    type: "keyboard";
  }

  export default class KeyboardBarcodeScanner {
    constructor(options?: KeyboardBarcodeScannerOptions);
    addEventListener(
      event: "barcode",
      listener: (detail: KeyboardBarcodeScannerEvent) => void
    ): void;
    addEventListener(
      event: "connected",
      listener: (detail: KeyboardBarcodeScannerConnection) => void
    ): void;
    addEventListener(
      event: "debug",
      listener: (detail: { events: unknown[] }) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;
  }
}
