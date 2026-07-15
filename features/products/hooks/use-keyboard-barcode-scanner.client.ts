import type { KeyboardBarcodeScannerEvent } from "@point-of-sale/keyboard-barcode-scanner";
import KeyboardBarcodeScanner from "@point-of-sale/keyboard-barcode-scanner";
import { useEffect, useRef, useState } from "react";
import {
  isBarcodeScannerBlocked,
  KEYBOARD_BARCODE_SCANNER_OPTIONS,
} from "@/features/products/barcode.shared";

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
    if (!enabled || isBarcodeScannerBlocked()) {
      return;
    }

    const scanner = new KeyboardBarcodeScanner(
      KEYBOARD_BARCODE_SCANNER_OPTIONS
    );
    scannerRef.current = scanner;

    const handleBarcode = (event: KeyboardBarcodeScannerEvent) => {
      if (isBarcodeScannerBlocked()) {
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
