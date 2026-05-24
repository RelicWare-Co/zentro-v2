export const CUSTOMER_DOCUMENT_TYPE_OPTIONS = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "NIT", label: "NIT" },
  { value: "PP", label: "Pasaporte" },
  { value: "TI", label: "Tarjeta de identidad" },
] as const;

export const CUSTOMER_TYPE_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "juridica", label: "Jurídica" },
] as const;

export interface CustomerFormState {
  documentNumber: string;
  documentType: string;
  email: string;
  name: string;
  phone: string;
  type: string;
}

export const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  name: "",
  documentType: "",
  documentNumber: "",
  phone: "",
  email: "",
  type: "natural",
};

export function getCustomerFormInitialValue(
  customer: {
    name: string;
    documentType?: string | null;
    documentNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    type?: string | null;
  } | null
): CustomerFormState {
  if (!customer) {
    return EMPTY_CUSTOMER_FORM;
  }
  return {
    name: customer.name,
    documentType: customer.documentType ?? "",
    documentNumber: customer.documentNumber ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    type: customer.type ?? "natural",
  };
}

export interface CustomerSavePayload {
  documentNumber: string | null;
  documentType: string | null;
  email: string | null;
  id?: string;
  name: string;
  phone: string | null;
  type: string | null;
}
