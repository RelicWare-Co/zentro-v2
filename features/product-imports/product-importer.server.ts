import type {
  ProductImportDocumentV1,
  ProductImporterDescriptor,
  ProductImportIssue,
} from "./product-imports.schema";

export interface ProductImportSourceRow {
  issues: ProductImportIssue[];
  productIndex: number | null;
  rowNumber: number;
  sourceData: Record<string, unknown>;
  sourceReference: string;
}

export interface ParsedProductImport {
  document: ProductImportDocumentV1;
  sourceRows: ProductImportSourceRow[];
}

export interface ProductImporter
  extends Omit<ProductImporterDescriptor, "template"> {
  parse: (bytes: Uint8Array) => Promise<ParsedProductImport>;
  template?: {
    build: () => Promise<Uint8Array>;
    fileName: string;
    mimeType: string;
  };
}

export class ProductImportFileError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProductImportFileError";
    this.code = code;
  }
}
