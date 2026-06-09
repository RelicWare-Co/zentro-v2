declare module "@point-of-sale/receipt-printer-encoder" {
  export default class ReceiptPrinterEncoder {
    constructor(options?: {
      language?: string;
      codepageMapping?: string;
      columns?: number;
      errors?: string;
    });
    get columns(): number;
    initialize(): this;
    codepage(value: string): this;
    align(value: string): this;
    bold(value: boolean): this;
    size(width?: number | string, height?: number): this;
    line(value: string): this;
    newline(count?: number): this;
    cut(value?: string): this;
    rule(options?: { style?: string }): this;
    pulse(pin?: number, on?: number, off?: number): this;
    table(
      columns: Array<{ width: number; align: string }>,
      rows: string[][]
    ): this;
    encode(): Uint8Array;
  }
}

declare module "@point-of-sale/receipt-printer-status" {
  interface ReceiptPrinterStatusDriver {
    addEventListener(
      event: "disconnected" | ("unsupported" | "connected"),
      listener: () => void
    ): void;
    addEventListener(event: "update", listener: (state: unknown) => void): void;
    cashDrawer: {
      open: () => void;
      opened: boolean;
      addEventListener(
        event: "update",
        listener: (state: unknown) => void
      ): void;
      addEventListener(event: "close" | "open", listener: () => void): void;
    };
    connected: boolean;
    language: string;
    status: {
      online: boolean;
      coverOpened: boolean;
      paperLoaded: boolean;
      paperLow: boolean;
    };
  }

  export default class ReceiptPrinterStatus {
    constructor(options: {
      printer: {
        print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
      };
      language?: string;
    });
  }
}

declare module "@point-of-sale/webusb-receipt-printer" {
  interface ReceiptPrinterDriver {
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
    connect: () => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
  }

  export default class WebUSBReceiptPrinter {
    constructor();
    connect: () => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
  }
}

declare module "@point-of-sale/webserial-receipt-printer" {
  interface ReceiptPrinterDriver {
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
    connect: () => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
  }

  export default class WebSerialReceiptPrinter {
    constructor(options?: {
      baudRate?: number;
      bufferSize?: number;
      dataBits?: number;
      flowControl?: string;
      parity?: string;
      stopBits?: number;
    });
    connect: () => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
  }
}

declare module "@point-of-sale/webbluetooth-receipt-printer" {
  interface ReceiptPrinterDriver {
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
    connect: () => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
  }

  export default class WebBluetoothReceiptPrinter {
    constructor();
    connect: () => Promise<void> | void;
    reconnect: (device: unknown) => Promise<void> | void;
    disconnect?: () => Promise<void> | void;
    listen?: () => Promise<boolean> | boolean;
    print: (data: Uint8Array | ArrayLike<number>) => Promise<void> | void;
    addEventListener(
      event: "connected",
      listener: (device: unknown) => void
    ): void;
    addEventListener(event: "disconnected", listener: () => void): void;
    addEventListener(
      event: "data",
      listener: (data: DataView | Uint8Array) => void
    ): void;
  }
}
