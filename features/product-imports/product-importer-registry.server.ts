import type { ProductImporter } from "./product-importer.server";
import { zentroStandardXlsxImporter } from "./zentro-standard-xlsx.server";

const importers = [zentroStandardXlsxImporter] as const;
const importerByKey = new Map<string, ProductImporter>(
  importers.map((importer) => [importer.key, importer])
);

export function getProductImporter(key: string) {
  return importerByKey.get(key) ?? null;
}

export function listProductImporters() {
  return importers.map(
    ({
      key,
      label,
      description,
      acceptedExtensions,
      acceptedMimeTypes,
      template,
    }) => ({
      key,
      label,
      description,
      acceptedExtensions: [...acceptedExtensions],
      acceptedMimeTypes: [...acceptedMimeTypes],
      template: template
        ? { fileName: template.fileName, mimeType: template.mimeType }
        : null,
    })
  );
}
