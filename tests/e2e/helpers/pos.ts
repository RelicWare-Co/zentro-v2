import { expect, type Page } from "@playwright/test";

const posPageUrl = /\/pos(?:\/|$)/;
const openShiftButtonName = /^Abrir Turno$/;
const closeShiftButtonName = "Cerrar Turno Definitivamente";
const cashMovementButtonName = /Movimiento de Caja/;
const movementTypeLabels: Record<string, string> = {
  expense: "Gasto Operativo",
  inflow: "Ingreso (Entrada manual)",
  payout: "Pago a Proveedor",
};

export async function openPosPage(page: Page): Promise<void> {
  await page.goto("/pos");
  await page.waitForURL(posPageUrl, { timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByPlaceholder("Buscar productos, código de barras...")
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Orden Actual")).toBeVisible({
    timeout: 15_000,
  });
}

export async function closeOpenShiftIfPresent(page: Page): Promise<void> {
  const closeShiftButton = page.getByRole("button", { name: "Cerrar Turno" });
  if (
    !(await closeShiftButton.isVisible({ timeout: 3000 }).catch(() => false))
  ) {
    return;
  }

  await closeShiftButton.click({ noWaitAfter: true });

  const closeDialog = page.getByRole("dialog", { name: "Cierre de Turno" });
  await expect(closeDialog).toBeVisible({ timeout: 15_000 });

  const cashClosureInput = closeDialog.locator("#closure-cash");
  if (
    await cashClosureInput.isVisible({ timeout: 10_000 }).catch(() => false)
  ) {
    await cashClosureInput.fill("0");
  }

  await closeDialog
    .getByRole("button", { name: closeShiftButtonName })
    .click({ noWaitAfter: true });
  await expect(page.getByRole("button", { name: "Abrir Turno" })).toBeVisible({
    timeout: 30_000,
  });
}

export async function openShift(
  page: Page,
  startingCash = "50000"
): Promise<void> {
  await page.getByRole("button", { name: "Abrir Turno" }).click();
  await expect(
    page.getByRole("heading", { name: "Apertura de Turno" })
  ).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Base en Efectivo").fill(startingCash);
  await page.getByRole("button", { name: openShiftButtonName }).last().click();
  await expect(page.getByRole("button", { name: "Cerrar Turno" })).toBeVisible({
    timeout: 30_000,
  });
}

export async function searchAndAddProduct(
  page: Page,
  productName: string
): Promise<void> {
  await page
    .getByPlaceholder("Buscar productos, código de barras...")
    .fill(productName);
  await expect(page.getByRole("button", { name: productName })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: productName }).click();
  await expect(page.getByText(productName).and(page.locator("h4"))).toBeVisible(
    { timeout: 15_000 }
  );
}

export async function completeCashSale(
  page: Page,
  amount: string
): Promise<void> {
  await page.getByRole("button", { name: "Cobrar" }).click();
  await expect(page.getByRole("heading", { name: "Cobrar Orden" })).toBeVisible(
    { timeout: 15_000 }
  );
  await page.getByPlaceholder("Monto").first().fill(amount);
  await page.getByRole("button", { name: "Finalizar Venta" }).click();
  await expect(page.getByText("Escanea o selecciona un producto")).toBeVisible({
    timeout: 30_000,
  });
}

export async function completeSplitSale(
  page: Page,
  cashAmount: string,
  cardAmount: string
): Promise<void> {
  await page.getByRole("button", { name: "Cobrar" }).click();
  await expect(page.getByRole("heading", { name: "Cobrar Orden" })).toBeVisible(
    { timeout: 15_000 }
  );

  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByPlaceholder("Monto").first().fill(cashAmount);
  await page
    .getByRole("button", { name: "Dividir Pago (Otro método)" })
    .click();

  const checkoutDialog = page.getByRole("dialog", { name: "Cobrar Orden" });
  const paymentMethodComboboxes = checkoutDialog.getByRole("combobox");
  const secondPaymentMethodCombobox = paymentMethodComboboxes.nth(1);
  await secondPaymentMethodCombobox.click();
  await page.getByRole("option", { name: "Tarjeta" }).click();
  await page.getByPlaceholder("Monto").nth(1).fill(cardAmount);
  await page
    .getByPlaceholder("Referencia (Ej. últimos 4 dígitos o voucher)")
    .fill("4242");

  await page.getByRole("button", { name: "Finalizar Venta" }).click();
  await expect(page.getByText("Escanea o selecciona un producto")).toBeVisible({
    timeout: 30_000,
  });
}

export async function registerCashMovement(
  page: Page,
  options: {
    type?: "inflow" | "expense" | "payout";
    amount: string;
    description: string;
  }
): Promise<void> {
  await page.getByRole("button", { name: cashMovementButtonName }).click();
  const movementDialog = page.getByRole("dialog", {
    name: "Movimiento del Turno",
  });
  await expect(movementDialog).toBeVisible({ timeout: 15_000 });

  const movementType = options.type ?? "inflow";
  const typeLabel =
    movementTypeLabels[movementType] ?? movementTypeLabels.inflow;
  await movementDialog.getByLabel("Tipo de Movimiento").click();
  await page.getByRole("option", { name: typeLabel, exact: false }).click();

  await movementDialog.getByLabel("Monto").fill(options.amount);
  await movementDialog.getByLabel("Descripción").fill(options.description);

  await movementDialog
    .getByRole("button", { name: "Registrar Movimiento" })
    .click();
  await expect(movementDialog).not.toBeVisible({ timeout: 30_000 });
}

export async function completeCreditSale(
  page: Page,
  options: { customerName: string; partialPayment?: string }
): Promise<void> {
  await page.getByRole("button", { name: "Cobrar" }).click();
  await expect(page.getByRole("heading", { name: "Cobrar Orden" })).toBeVisible(
    {
      timeout: 15_000,
    }
  );

  const checkoutDialog = page.getByRole("dialog", { name: "Cobrar Orden" });
  await checkoutDialog
    .getByRole("button", { name: "Cliente Mostrador" })
    .click();
  await page
    .getByRole("option", { name: options.customerName, exact: false })
    .click();

  await checkoutDialog.getByLabel("Dejar saldo a crédito").check();
  if (options.partialPayment) {
    await checkoutDialog
      .getByPlaceholder("Monto")
      .first()
      .fill(options.partialPayment);
  }

  await checkoutDialog
    .getByRole("button", { name: "Registrar Venta con Saldo" })
    .click();
  await expect(page.getByText("Escanea o selecciona un producto")).toBeVisible({
    timeout: 30_000,
  });
}

export async function closeShiftWithExpectedCash(
  page: Page,
  expectedCash: string
): Promise<void> {
  await confirmCloseShift(page, async (dialog) => {
    await expect(dialog.getByText("Efectivo esperado")).toBeVisible({
      timeout: 15_000,
    });
    await dialog.locator("#closure-cash").fill(expectedCash);
  });
  await expect(page.getByRole("button", { name: "Abrir Turno" })).toBeVisible({
    timeout: 30_000,
  });
}

async function confirmCloseShift(
  page: Page,
  prepareDialog: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>
): Promise<void> {
  const closeDialog = page.getByRole("dialog", { name: "Cierre de Turno" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const closeShiftButton = page.getByRole("button", { name: "Cerrar Turno" });
    if (
      await closeShiftButton.isVisible({ timeout: 1000 }).catch(() => false)
    ) {
      await closeShiftButton.click({ noWaitAfter: true });
      if (await closeDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        break;
      }
      await closeShiftButton.dispatchEvent("click");
    }

    if (await closeDialog.isVisible({ timeout: 15_000 }).catch(() => false)) {
      break;
    }
  }

  await expect(closeDialog).toBeVisible({ timeout: 15_000 });
  await prepareDialog(closeDialog);

  const confirmButton = closeDialog.getByRole("button", {
    name: closeShiftButtonName,
  });
  await expect(confirmButton).toBeEnabled({ timeout: 15_000 });

  const clickError = await confirmButton
    .click({ noWaitAfter: true })
    .catch((error: unknown) => error);
  if (clickError) {
    const shiftClosed = await page
      .getByRole("button", { name: "Abrir Turno" })
      .isVisible({ timeout: 30_000 })
      .catch(() => false);
    if (!shiftClosed) {
      throw clickError;
    }
  }
}
