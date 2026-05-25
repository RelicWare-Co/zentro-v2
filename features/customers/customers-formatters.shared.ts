export function formatCustomerDocumentLabel(
  documentType?: string | null,
  documentNumber?: string | null
) {
  if (documentType && documentNumber) {
    return `${documentType} ${documentNumber}`;
  }
  if (documentNumber) {
    return documentNumber;
  }
  return null;
}
