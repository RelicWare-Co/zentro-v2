import {
  normalizePaymentMethodId,
  type OrganizationPaymentMethodSettings,
  type OrganizationSettings,
} from "@/features/settings/settings.shared";

export function updatePaymentMethodInDraft(
  settings: OrganizationSettings,
  methodId: string,
  updates: Partial<OrganizationPaymentMethodSettings>
): OrganizationSettings {
  return {
    ...settings,
    pos: {
      ...settings.pos,
      paymentMethods: settings.pos.paymentMethods.map((method) =>
        method.id === methodId
          ? {
              ...method,
              ...updates,
              requiresReference:
                method.id === "cash"
                  ? false
                  : (updates.requiresReference ?? method.requiresReference),
            }
          : method
      ),
    },
  };
}

export type AddPaymentMethodResult =
  | { settings: OrganizationSettings; error?: undefined }
  | { settings?: undefined; error: string };

export function addPaymentMethodToDraft(
  settings: OrganizationSettings,
  label: string,
  slug: string
): AddPaymentMethodResult {
  const trimmedLabel = label.trim();
  if (!(trimmedLabel && slug)) {
    return {
      error: "Escribe un nombre válido para crear el método de pago.",
    };
  }

  if (
    settings.pos.paymentMethods.some(
      (paymentMethod) => paymentMethod.id === slug
    )
  ) {
    return {
      error: `Ya existe un método con el código ${slug}.`,
    };
  }

  return {
    settings: {
      ...settings,
      pos: {
        ...settings.pos,
        paymentMethods: [
          ...settings.pos.paymentMethods,
          {
            id: slug,
            label: trimmedLabel,
            enabled: true,
            requiresReference: true,
          },
        ],
      },
    },
  };
}

export function derivePaymentMethodSlug(label: string) {
  return normalizePaymentMethodId(label);
}
