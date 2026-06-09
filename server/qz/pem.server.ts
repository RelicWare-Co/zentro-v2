const WRAPPING_QUOTES = new Map([
  ['"', '"'],
  ["'", "'"],
  ["`", "`"],
]);

const PRIVATE_KEY_BEGIN_PATTERN = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/;
const PRIVATE_KEY_END_PATTERN = /-----END (?:[A-Z ]+ )?PRIVATE KEY-----/;

export function normalizePemSource(value: string): string | null {
  let normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const first = normalized.at(0);
  const last = normalized.at(-1);
  if (first && last && WRAPPING_QUOTES.get(first) === last) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replace(/\r\n?/g, "\n")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

export function isPrivateKeyPem(value: string): boolean {
  return (
    PRIVATE_KEY_BEGIN_PATTERN.test(value) && PRIVATE_KEY_END_PATTERN.test(value)
  );
}
