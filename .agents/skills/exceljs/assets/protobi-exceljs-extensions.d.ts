import "@protobi/exceljs";

declare module "@protobi/exceljs" {
  export interface ProtobiPivotTableOptions {
    sourceSheet: Worksheet;
    rows: string[];
    columns: string[];
    values: [string];
    pages?: string[];
    pageDefaults?: Record<string, string | number | boolean>;
    metric?: "sum" | "count";
    applyWidthHeightFormats?: "0" | "1";
  }

  export interface ProtobiPivotTable {
    sourceSheet: Worksheet;
    rows: number[];
    columns: number[];
    values: [number];
    pages: number[];
    metric?: "sum" | "count";
    cacheId: string;
    tableNumber: number;
    applyWidthHeightFormats: "0" | "1";
  }

  export interface ProtobiFormCheckboxOptions {
    link?: string;
    checked?: boolean;
    text?: string;
    noThreeD?: boolean;
    print?: boolean;
  }

  export interface ProtobiFormCheckboxAnchor {
    col: number;
    row: number;
    colOff?: number;
    rowOff?: number;
  }

  export type ProtobiFormCheckboxRange =
    | string
    | {
        startCol: number;
        startRow: number;
        endCol: number;
        endRow: number;
        startColOff?: number;
        startRowOff?: number;
        endColOff?: number;
        endRowOff?: number;
      }
    | {
        tl: string | ProtobiFormCheckboxAnchor;
        br?: string | ProtobiFormCheckboxAnchor;
      };

  export interface ProtobiFormCheckbox {
    checked: boolean;
    link?: string;
    text: string;
    getVmlAnchor(): string;
    getVmlStyle(): string;
    getVmlCheckedValue(): 0 | 1 | 2;
  }

  interface Workbook {
    readonly pivotTables: ProtobiPivotTable[];
  }

  interface Worksheet {
    readonly pivotTables: ProtobiPivotTable[];
    addPivotTable(options: ProtobiPivotTableOptions): ProtobiPivotTable;
    addFormCheckbox(
      range: ProtobiFormCheckboxRange,
      options?: ProtobiFormCheckboxOptions
    ): ProtobiFormCheckbox;
    getFormCheckboxes(): ProtobiFormCheckbox[];
  }
}
