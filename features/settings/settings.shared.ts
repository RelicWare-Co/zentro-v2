import type {
  RestaurantModuleSettings,
  RestaurantModuleToggleSettings,
} from "@/features/restaurants/restaurants.module";
import {
  DEFAULT_RESTAURANT_MODULE_SETTINGS,
  DEFAULT_RESTAURANT_MODULE_TOGGLE_SETTINGS,
} from "@/features/restaurants/restaurants.module";

const PAYMENT_METHOD_CATALOG = [
  {
    id: "cash",
    label: "Efectivo",
    defaultEnabled: true,
    defaultRequiresReference: false,
  },
  {
    id: "card",
    label: "Tarjeta",
    defaultEnabled: true,
    defaultRequiresReference: true,
  },
  {
    id: "transfer_nequi",
    label: "Nequi",
    defaultEnabled: true,
    defaultRequiresReference: true,
  },
  {
    id: "transfer_bancolombia",
    label: "Bancolombia",
    defaultEnabled: true,
    defaultRequiresReference: true,
  },
] as const;

const _PAYMENT_METHOD_IDS = PAYMENT_METHOD_CATALOG.map((method) => method.id);
export const PAYMENT_METHOD_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

type PaymentMethodCatalogId = (typeof PAYMENT_METHOD_CATALOG)[number]["id"];

export interface OrganizationPaymentMethodSettings {
  enabled: boolean;
  id: string;
  label: string;
  requiresReference: boolean;
}

export interface OrganizationSettings {
  credit: {
    allowCreditSales: boolean;
    defaultInterestRate: number;
  };
  inventory: {
    defaultTaxRate: number;
    trackInventoryByDefault: boolean;
    modifiersEnabledByDefault: boolean;
    lowStockThreshold: number;
  };
  modules: {
    restaurants: RestaurantModuleToggleSettings;
  };
  pos: {
    defaultTerminalName: string;
    defaultStartingCash: number;
    paymentMethods: OrganizationPaymentMethodSettings[];
  };
  restaurants: RestaurantModuleSettings;
}

const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  modules: {
    restaurants: DEFAULT_RESTAURANT_MODULE_TOGGLE_SETTINGS,
  },
  restaurants: DEFAULT_RESTAURANT_MODULE_SETTINGS,
  pos: {
    defaultTerminalName: "Caja Principal",
    defaultStartingCash: 0,
    paymentMethods: PAYMENT_METHOD_CATALOG.map((method) => ({
      id: method.id,
      label: method.label,
      enabled: method.defaultEnabled,
      requiresReference: method.defaultRequiresReference,
    })),
  },
  credit: {
    allowCreditSales: true,
    defaultInterestRate: 0,
  },
  inventory: {
    defaultTaxRate: 0,
    trackInventoryByDefault: true,
    modifiersEnabledByDefault: true,
    lowStockThreshold: 5,
  },
};

const PAYMENT_METHOD_CATALOG_BY_ID: ReadonlyMap<
  string,
  (typeof PAYMENT_METHOD_CATALOG)[number]
> = new Map(PAYMENT_METHOD_CATALOG.map((method) => [method.id, method]));

function toSafeString(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : fallback;
}

function toNonNegativeInteger(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value));
}

function toIntegerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizePaymentMethodId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

export function formatPaymentMethodIdLabel(methodId: string) {
  const normalizedMethodId = normalizePaymentMethodId(methodId);
  const catalogMethod = PAYMENT_METHOD_CATALOG_BY_ID.get(normalizedMethodId);
  if (catalogMethod) {
    return catalogMethod.label;
  }

  const source = normalizedMethodId || methodId.trim().toLowerCase();
  if (!source) {
    return "Metodo de pago";
  }

  return source
    .split("_")
    .reduce<string[]>((acc, segment) => {
      if (segment) {
        acc.push(segment.charAt(0).toUpperCase() + segment.slice(1));
      }
      return acc;
    }, [])
    .join(" ");
}

export function comparePaymentMethodIds(left: string, right: string) {
  const leftId = normalizePaymentMethodId(left);
  const rightId = normalizePaymentMethodId(right);

  if (leftId === "cash") {
    return -1;
  }
  if (rightId === "cash") {
    return 1;
  }

  return leftId.localeCompare(rightId, "es-CO");
}

export function buildPaymentMethodLabelMap(
  paymentMethods: Array<{ id: string; label: string }>
) {
  return Object.fromEntries(
    paymentMethods.map((paymentMethod) => [
      normalizePaymentMethodId(paymentMethod.id),
      paymentMethod.label,
    ])
  );
}

export function buildPaymentMethodOptions(
  configuredPaymentMethods: Array<{ id: string; label: string }>,
  extraMethodIds: Iterable<string> = []
) {
  const options: Array<{ id: string; label: string }> = [];
  const seenMethodIds = new Set<string>();

  const addOption = (methodId: string, label?: string) => {
    const normalizedMethodId = normalizePaymentMethodId(methodId);
    if (!normalizedMethodId || seenMethodIds.has(normalizedMethodId)) {
      return;
    }

    options.push({
      id: normalizedMethodId,
      label: toSafeString(
        label,
        formatPaymentMethodIdLabel(normalizedMethodId)
      ),
    });
    seenMethodIds.add(normalizedMethodId);
  };

  for (const paymentMethod of configuredPaymentMethods) {
    addOption(paymentMethod.id, paymentMethod.label);
  }

  const extraOptions = [...extraMethodIds]
    .reduce<string[]>((acc, methodId) => {
      const normalized = normalizePaymentMethodId(methodId);
      if (
        normalized.length > 0 &&
        !seenMethodIds.has(normalized) &&
        !acc.includes(normalized)
      ) {
        acc.push(normalized);
      }
      return acc;
    }, [])
    .sort(comparePaymentMethodIds);

  for (const paymentMethodId of extraOptions) {
    addOption(paymentMethodId);
  }

  return options;
}

function normalizePaymentMethods(
  value: unknown
): OrganizationPaymentMethodSettings[] {
  const rawMethodsById = new Map<string, Record<string, unknown>>();
  const customMethodIds: string[] = [];

  if (Array.isArray(value)) {
    for (const rawMethod of value) {
      if (!rawMethod || typeof rawMethod !== "object") {
        continue;
      }

      const methodId = normalizePaymentMethodId(
        "id" in rawMethod ? rawMethod.id : null
      );
      if (!methodId) {
        continue;
      }

      if (
        !(
          rawMethodsById.has(methodId) ||
          PAYMENT_METHOD_CATALOG_BY_ID.has(methodId)
        )
      ) {
        customMethodIds.push(methodId);
      }

      rawMethodsById.set(methodId, rawMethod as Record<string, unknown>);
    }
  }

  const methods = [
    ...PAYMENT_METHOD_CATALOG.map((catalogMethod) => {
      const rawMethod = rawMethodsById.get(catalogMethod.id);

      return {
        id: catalogMethod.id,
        label: toSafeString(rawMethod?.label, catalogMethod.label),
        enabled:
          catalogMethod.id === "cash"
            ? true
            : toBoolean(rawMethod?.enabled, catalogMethod.defaultEnabled),
        requiresReference:
          catalogMethod.id === "cash"
            ? false
            : toBoolean(
                rawMethod?.requiresReference,
                catalogMethod.defaultRequiresReference
              ),
      };
    }),
    ...customMethodIds.map((methodId) => {
      const rawMethod = rawMethodsById.get(methodId);
      return {
        id: methodId,
        label: toSafeString(
          rawMethod?.label,
          formatPaymentMethodIdLabel(methodId)
        ),
        enabled: toBoolean(rawMethod?.enabled, true),
        requiresReference:
          methodId === "cash"
            ? false
            : toBoolean(rawMethod?.requiresReference, true),
      };
    }),
  ];

  if (methods.some((method) => method.enabled)) {
    return methods;
  }

  return methods.map((method) =>
    method.id === "cash" ? { ...method, enabled: true } : method
  );
}

export function normalizeOrganizationSettings(
  value: unknown
): OrganizationSettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const posSource =
    source.pos && typeof source.pos === "object"
      ? (source.pos as Record<string, unknown>)
      : {};
  const modulesSource =
    source.modules && typeof source.modules === "object"
      ? (source.modules as Record<string, unknown>)
      : {};
  const restaurantsSource =
    source.restaurants && typeof source.restaurants === "object"
      ? (source.restaurants as Record<string, unknown>)
      : {};
  const restaurantKitchenSource =
    restaurantsSource.kitchen && typeof restaurantsSource.kitchen === "object"
      ? (restaurantsSource.kitchen as Record<string, unknown>)
      : {};
  const creditSource =
    source.credit && typeof source.credit === "object"
      ? (source.credit as Record<string, unknown>)
      : {};
  const inventorySource =
    source.inventory && typeof source.inventory === "object"
      ? (source.inventory as Record<string, unknown>)
      : {};

  return {
    modules: {
      restaurants: {
        enabled: toBoolean(
          (modulesSource.restaurants as Record<string, unknown> | undefined)
            ?.enabled,
          DEFAULT_RESTAURANT_MODULE_TOGGLE_SETTINGS.enabled
        ),
      },
    },
    restaurants: {
      kitchen: {
        displayEnabled: toBoolean(
          restaurantKitchenSource.displayEnabled,
          DEFAULT_RESTAURANT_MODULE_SETTINGS.kitchen.displayEnabled
        ),
        printTicketsEnabled: toBoolean(
          restaurantKitchenSource.printTicketsEnabled,
          DEFAULT_RESTAURANT_MODULE_SETTINGS.kitchen.printTicketsEnabled
        ),
        autoPrintOnSend: toBoolean(
          restaurantKitchenSource.autoPrintOnSend,
          DEFAULT_RESTAURANT_MODULE_SETTINGS.kitchen.autoPrintOnSend
        ),
      },
    },
    pos: {
      defaultTerminalName: toSafeString(
        posSource.defaultTerminalName,
        DEFAULT_ORGANIZATION_SETTINGS.pos.defaultTerminalName
      ),
      defaultStartingCash: toNonNegativeInteger(
        posSource.defaultStartingCash,
        DEFAULT_ORGANIZATION_SETTINGS.pos.defaultStartingCash
      ),
      paymentMethods: normalizePaymentMethods(posSource.paymentMethods),
    },
    credit: {
      allowCreditSales: toBoolean(
        creditSource.allowCreditSales,
        DEFAULT_ORGANIZATION_SETTINGS.credit.allowCreditSales
      ),
      defaultInterestRate: toIntegerInRange(
        creditSource.defaultInterestRate,
        DEFAULT_ORGANIZATION_SETTINGS.credit.defaultInterestRate,
        0,
        100
      ),
    },
    inventory: {
      defaultTaxRate: toIntegerInRange(
        inventorySource.defaultTaxRate,
        DEFAULT_ORGANIZATION_SETTINGS.inventory.defaultTaxRate,
        0,
        100
      ),
      trackInventoryByDefault: toBoolean(
        inventorySource.trackInventoryByDefault,
        DEFAULT_ORGANIZATION_SETTINGS.inventory.trackInventoryByDefault
      ),
      modifiersEnabledByDefault: toBoolean(
        inventorySource.modifiersEnabledByDefault,
        DEFAULT_ORGANIZATION_SETTINGS.inventory.modifiersEnabledByDefault
      ),
      lowStockThreshold: toNonNegativeInteger(
        inventorySource.lowStockThreshold,
        DEFAULT_ORGANIZATION_SETTINGS.inventory.lowStockThreshold
      ),
    },
  };
}

export function parseOrganizationSettingsMetadata(
  metadata: string | null | undefined
): OrganizationSettings {
  if (!metadata) {
    return normalizeOrganizationSettings(DEFAULT_ORGANIZATION_SETTINGS);
  }

  try {
    return normalizeOrganizationSettings(JSON.parse(metadata));
  } catch {
    return normalizeOrganizationSettings(DEFAULT_ORGANIZATION_SETTINGS);
  }
}

export function serializeOrganizationSettingsMetadata(
  settings: OrganizationSettings
) {
  return JSON.stringify(normalizeOrganizationSettings(settings));
}

export function getAllPaymentMethods(settings: OrganizationSettings) {
  return settings.pos.paymentMethods;
}

export function getEnabledPaymentMethods(settings: OrganizationSettings) {
  return settings.pos.paymentMethods.filter((method) => method.enabled);
}
