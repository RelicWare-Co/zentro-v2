import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import KeyboardBarcodeScanner from "@point-of-sale/keyboard-barcode-scanner";
import { useEffect, useRef, useState } from "react";
import {
  isPosV2ScannerBlocked,
  POSV2_BARCODE_SCANNER_OPTIONS,
} from "@/features/posv2/posv2-barcode.shared";

interface UseKeyboardBarcodeScannerOptions {
  enabled?: boolean;
  onScan: (event: KeyboardBarcodeScannerEvent) => void;
}

export function useKeyboardBarcodeScanner({
  enabled = true,
  onScan,
}: UseKeyboardBarcodeScannerOptions) {
  const onScanRef = useRef(onScan);
  const [isConnected, setIsConnected] = useState(false);
  const scannerRef = useRef<KeyboardBarcodeScanner | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled || isPosV2ScannerBlocked()) {
      return;
    }

    const scanner = new KeyboardBarcodeScanner(POSV2_BARCODE_SCANNER_OPTIONS);
    scannerRef.current = scanner;

    const handleBarcode = (event: KeyboardBarcodeScannerEvent) => {
      if (isPosV2ScannerBlocked()) {
        return;
      }
      onScanRef.current(event);
    };

    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    scanner.addEventListener("barcode", handleBarcode);
    scanner.addEventListener("connected", handleConnected);
    scanner.addEventListener("disconnected", handleDisconnected);
    scanner.connect().catch(() => undefined);

    return () => {
      scanner.disconnect().catch(() => undefined);
      scannerRef.current = null;
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected };
}
