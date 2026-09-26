import { describe, expect, test } from "bun:test";
import { shouldOpenCashDrawer } from "@/features/pos/printing/receipt-layout.shared";

describe("shouldOpenCashDrawer", () => {
  test("follows the machine setting when the caller says nothing", () => {
    // Los recibos de venta del POS conservan el comportamiento del ajuste.
    expect(shouldOpenCashDrawer({ openDrawerAfterPrint: true })).toBe(true);
    expect(shouldOpenCashDrawer({ openDrawerAfterPrint: false })).toBe(false);
  });

  test("keeps the drawer closed for kitchen tickets even when the machine opens it", () => {
    // Regresión: la comanda de la caja heredaba `openDrawerAfterPrint` y
    // hacía saltar el cajón en cada pedido del mesero, incluso impresos de
    // forma desatendida.
    expect(
      shouldOpenCashDrawer(
        { openDrawerAfterPrint: true },
        { openCashDrawer: false }
      )
    ).toBe(false);
  });

  test("lets a caller force the drawer open regardless of the machine setting", () => {
    expect(
      shouldOpenCashDrawer(
        { openDrawerAfterPrint: false },
        { openCashDrawer: true }
      )
    ).toBe(true);
  });
});
