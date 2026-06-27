// Domain value normalization helpers — canonical, isomorphic, no DB imports.
//
// All feature modules should import these from here or via `@/zero/sdk`
// (which re-exports them). Server-only files can import directly from here.

export function normalizeOptionalString(value?: string | null) {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRequiredString(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`El campo "${fieldName}" es obligatorio`);
  }
  return normalized;
}

export function toNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor o igual a 0`
    );
  }
  return Math.round(value);
}

export function toInteger(value: number, fieldName: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`El campo "${fieldName}" debe ser un número válido`);
  }
  return Math.round(value);
}

export function toPositiveInteger(value: number, fieldName: string) {
  const normalized = toNonNegativeInteger(value, fieldName);
  if (normalized <= 0) {
    throw new Error(
      `El campo "${fieldName}" debe ser un número válido mayor a 0`
    );
  }
  return normalized;
}

export function resolveTimestamp(input?: number) {
  if (input === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(input) || input < 0) {
    throw new Error("La fecha indicada no es válida");
  }

  return Math.round(input);
}

export function resolveDate(input?: number, fieldName = "createdAt"): Date {
  if (input === undefined) {
    return new Date();
  }
  return new Date(toNonNegativeInteger(input, fieldName));
}

export function normalizeNumber(
  value: number | string | null | undefined
): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
