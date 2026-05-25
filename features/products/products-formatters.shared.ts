const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatProductCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
