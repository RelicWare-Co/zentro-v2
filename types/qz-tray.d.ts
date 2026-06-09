declare module "qz-tray" {
  interface QzConnectOptions {
    delay?: number;
    host?: string | string[];
    keepAlive?: number;
    port?: {
      secure?: number[];
      insecure?: number[];
    };
    retries?: number;
    usingSecure?: boolean;
  }

  interface QzPrinterConfigOptions {
    copies?: number;
    encoding?: string;
    jobName?: string | null;
    [key: string]: unknown;
  }

  interface QzPrinterConfig {
    getPrinter(): string | null;
    reconfigure(options: QzPrinterConfigOptions): void;
  }

  interface QzPrintData {
    data: string;
    flavor?: string;
    format?: string;
    options?: Record<string, unknown>;
    type?: string;
  }

  type QzCertificatePromiseHandler = (
    resolve: (certificate?: string) => void,
    reject: (error?: unknown) => void
  ) => void;

  type QzSignaturePromiseFactory = (
    toSign: string
  ) => (
    resolve: (signature?: string) => void,
    reject: (error?: unknown) => void
  ) => void;

  const qz: {
    websocket: {
      connect(options?: QzConnectOptions): Promise<void>;
      disconnect(): Promise<void>;
      isActive(): boolean;
      setClosedCallbacks(callback: ((event: unknown) => void) | null): void;
      setErrorCallbacks(callback: ((event: unknown) => void) | null): void;
    };
    printers: {
      find(query?: string): Promise<string | string[]>;
      getDefault(): Promise<string | null>;
    };
    configs: {
      create(
        printer: string | null,
        options?: QzPrinterConfigOptions
      ): QzPrinterConfig;
    };
    print(
      config: QzPrinterConfig,
      data: Array<QzPrintData | string>
    ): Promise<void>;
    security: {
      setCertificatePromise(handler: QzCertificatePromiseHandler): void;
      setSignaturePromise(factory: QzSignaturePromiseFactory): void;
      setSignatureAlgorithm(algorithm: string): void;
    };
    api: {
      getVersion(): Promise<string>;
    };
    version: string;
  };

  export default qz;
}
