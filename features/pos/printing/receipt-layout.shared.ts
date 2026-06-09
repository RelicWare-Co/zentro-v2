export const POS_RECEIPT_PAPER_WIDTHS = ["80mm", "58mm"] as const;
export type PosReceiptPaperWidth = (typeof POS_RECEIPT_PAPER_WIDTHS)[number];

export const POS_RECEIPT_FONT_SCALES = ["normal", "large"] as const;
export type PosReceiptFontScale = (typeof POS_RECEIPT_FONT_SCALES)[number];

export interface PosReceiptLayoutSettings {
  receiptFontScale: PosReceiptFontScale;
  receiptPaperWidth: PosReceiptPaperWidth;
}

export const DEFAULT_POS_RECEIPT_LAYOUT_SETTINGS: PosReceiptLayoutSettings = {
  receiptPaperWidth: "80mm",
  receiptFontScale: "normal",
};

const RECEIPT_CSS_LAYOUTS: Record<
  PosReceiptPaperWidth,
  {
    contentWidthMm: number;
    pageMarginMm: number;
    paperWidthMm: number;
  }
> = {
  "80mm": {
    paperWidthMm: 80,
    pageMarginMm: 6,
    contentWidthMm: 72,
  },
  "58mm": {
    paperWidthMm: 58,
    pageMarginMm: 3,
    contentWidthMm: 52,
  },
};

const RECEIPT_FONT_METRICS: Record<
  PosReceiptFontScale,
  {
    bodyFontPx: number;
    businessNameFontPx: number;
    encoderHeight: 1 | 2;
    lineHeight: number;
    titleFontPx: number;
  }
> = {
  normal: {
    bodyFontPx: 11,
    businessNameFontPx: 16,
    titleFontPx: 13,
    lineHeight: 1.35,
    encoderHeight: 1,
  },
  large: {
    bodyFontPx: 13,
    businessNameFontPx: 18,
    titleFontPx: 15,
    lineHeight: 1.28,
    encoderHeight: 2,
  },
};

export function isPosReceiptPaperWidth(
  value: unknown
): value is PosReceiptPaperWidth {
  return (
    typeof value === "string" &&
    POS_RECEIPT_PAPER_WIDTHS.includes(value as PosReceiptPaperWidth)
  );
}

export function isPosReceiptFontScale(
  value: unknown
): value is PosReceiptFontScale {
  return (
    typeof value === "string" &&
    POS_RECEIPT_FONT_SCALES.includes(value as PosReceiptFontScale)
  );
}

export function getThermalReceiptCssMetrics(
  settings?: Partial<PosReceiptLayoutSettings> | null
) {
  const paperWidth =
    settings?.receiptPaperWidth ??
    DEFAULT_POS_RECEIPT_LAYOUT_SETTINGS.receiptPaperWidth;
  const fontScale =
    settings?.receiptFontScale ??
    DEFAULT_POS_RECEIPT_LAYOUT_SETTINGS.receiptFontScale;

  return {
    ...RECEIPT_CSS_LAYOUTS[paperWidth],
    ...RECEIPT_FONT_METRICS[fontScale],
  };
}

export function getThermalReceiptEncoderColumns(
  settings?: Partial<PosReceiptLayoutSettings> | null
) {
  return settings?.receiptPaperWidth === "58mm" ? 32 : 42;
}

export function getThermalReceiptEncoderHeight(
  settings?: Partial<PosReceiptLayoutSettings> | null
) {
  const fontScale =
    settings?.receiptFontScale ??
    DEFAULT_POS_RECEIPT_LAYOUT_SETTINGS.receiptFontScale;
  return RECEIPT_FONT_METRICS[fontScale].encoderHeight;
}
