export const SEO_SITE_NAME = "Zentro";
export const SEO_LOCALE = "es_CO";
export const SEO_DEFAULT_TITLE = "Zentro | Sistema POS inteligente";
export const SEO_DEFAULT_DESCRIPTION =
  "Sistema POS inteligente para ventas, inventario, turnos, cocina, clientes y crédito en negocios en crecimiento.";
export const SEO_OG_IMAGE_PATH = "/og-image.svg";

const INDEX_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow, noarchive";
const LOCAL_ORIGIN = "http://localhost:3000";
const PATH_QUERY_HASH_PATTERN = /[?#]/;
const TRAILING_SLASH_PATTERN = /\/+$/;

interface SeoPageContext {
  headers?: Record<string, string> | null;
  headersOriginal?: unknown;
  is404?: boolean | null;
  urlOriginal?: string;
  urlPathname?: string;
}

interface RouteSeoConfig {
  canonicalPath?: string;
  description: string;
  indexable: boolean;
  title: string;
}

export interface SeoMetadata {
  canonicalPath: string;
  description: string;
  robots: string;
  title: string;
}

const ROUTE_SEO: Record<string, RouteSeoConfig> = {
  "/": {
    canonicalPath: "/",
    description: SEO_DEFAULT_DESCRIPTION,
    indexable: true,
    title: SEO_DEFAULT_TITLE,
  },
  "/login": {
    canonicalPath: "/login",
    description:
      "Accede a Zentro para administrar ventas, inventario, turnos, clientes, crédito y operaciones de punto de venta.",
    indexable: true,
    title: "Iniciar sesión | Zentro",
  },
  "/join": {
    canonicalPath: "/login",
    description:
      "Acepta una invitación segura para unirte a una organización en Zentro.",
    indexable: false,
    title: "Invitación de organización | Zentro",
  },
  "/organization": {
    description:
      "Selecciona, crea o administra la organización activa de tu cuenta Zentro.",
    indexable: false,
    title: "Organización | Zentro",
  },
  "/dashboard": {
    description:
      "Panel operativo de Zentro con ventas, alertas, productos destacados y actividad reciente.",
    indexable: false,
    title: "Dashboard | Zentro",
  },
  "/pos": {
    description:
      "Punto de venta de Zentro para registrar ventas, pagos, clientes y tickets.",
    indexable: false,
    title: "POS | Zentro",
  },
  "/posv2": {
    description:
      "Punto de venta de Zentro optimizado para catálogo, carrito, pagos y cobro rápido.",
    indexable: false,
    title: "POS | Zentro",
  },
  "/restaurants": {
    description:
      "Operación de restaurante en Zentro para mesas, órdenes, servicio y cocina.",
    indexable: false,
    title: "Restaurante | Zentro",
  },
  "/kitchen": {
    description:
      "Vista de cocina de Zentro para preparar, seguir y completar comandas.",
    indexable: false,
    title: "Cocina | Zentro",
  },
  "/sales": {
    description:
      "Historial de ventas de Zentro con filtros, detalles, estados y cancelaciones.",
    indexable: false,
    title: "Ventas | Zentro",
  },
  "/shifts": {
    description:
      "Control de turnos de Zentro para apertura, cierre y movimientos de caja.",
    indexable: false,
    title: "Turnos | Zentro",
  },
  "/products": {
    description:
      "Catálogo e inventario de Zentro para productos, categorías, stock y kardex.",
    indexable: false,
    title: "Productos e inventario | Zentro",
  },
  "/customers": {
    description:
      "Gestión de clientes de Zentro para perfiles, historial y cuentas asociadas.",
    indexable: false,
    title: "Clientes | Zentro",
  },
  "/credit": {
    description:
      "Crédito de clientes en Zentro con saldos, pagos, ledger y cuentas por cobrar.",
    indexable: false,
    title: "Crédito | Zentro",
  },
  "/settings": {
    description:
      "Configuración de Zentro para inventario, POS, restaurantes, crédito e impresoras.",
    indexable: false,
    title: "Configuración | Zentro",
  },
  "/admin": {
    description:
      "Administración de plataforma de Zentro para usuarios, organizaciones y módulos.",
    indexable: false,
    title: "Administración | Zentro",
  },
};

const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/credit",
  "/customers",
  "/dashboard",
  "/join",
  "/kitchen",
  "/organization",
  "/pos",
  "/posv2",
  "/products",
  "/restaurants",
  "/sales",
  "/settings",
  "/shifts",
] as const;

export function getSeoMetadata(pageContext: unknown): SeoMetadata {
  const seoPageContext = toSeoPageContext(pageContext);
  const pathname = getSeoPathname(seoPageContext);

  if (seoPageContext.is404) {
    return {
      canonicalPath: pathname,
      description: "La página solicitada no existe en Zentro.",
      robots: NOINDEX_ROBOTS,
      title: "Página no encontrada | Zentro",
    };
  }

  const routeSeo = ROUTE_SEO[pathname] ?? {
    canonicalPath: pathname,
    description: SEO_DEFAULT_DESCRIPTION,
    indexable: !isPrivatePath(pathname),
    title: SEO_DEFAULT_TITLE,
  };

  return {
    canonicalPath: routeSeo.canonicalPath ?? pathname,
    description: routeSeo.description,
    robots: routeSeo.indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS,
    title: routeSeo.title,
  };
}

export function getCanonicalUrl(
  pageContext: unknown,
  canonicalPath = getSeoMetadata(pageContext).canonicalPath
) {
  return toAbsoluteUrl(canonicalPath, toSeoPageContext(pageContext));
}

export function getSeoImageUrl(pageContext: unknown) {
  return toAbsoluteUrl(SEO_OG_IMAGE_PATH, toSeoPageContext(pageContext));
}

function toSeoPageContext(pageContext: unknown): SeoPageContext {
  return typeof pageContext === "object" && pageContext !== null
    ? (pageContext as SeoPageContext)
    : {};
}

function getSeoPathname(pageContext: SeoPageContext) {
  if (pageContext.urlPathname) {
    return normalizePathname(pageContext.urlPathname);
  }

  if (pageContext.urlOriginal) {
    try {
      return normalizePathname(
        new URL(pageContext.urlOriginal, LOCAL_ORIGIN).pathname
      );
    } catch {
      return "/";
    }
  }

  return "/";
}

function normalizePathname(pathname: string) {
  const pathOnly = pathname.split(PATH_QUERY_HASH_PATTERN, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  return withLeadingSlash === "/"
    ? withLeadingSlash
    : withLeadingSlash.replace(TRAILING_SLASH_PATTERN, "");
}

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function toAbsoluteUrl(pathOrUrl: string, pageContext: SeoPageContext) {
  try {
    return new URL(pathOrUrl).toString();
  } catch {
    return new URL(pathOrUrl, `${getSiteOrigin(pageContext)}/`).toString();
  }
}

function getSiteOrigin(pageContext: SeoPageContext) {
  return (
    getConfiguredOrigin([
      "PUBLIC_SITE_URL",
      "SITE_URL",
      "VITE_PUBLIC_SITE_URL",
    ]) ??
    getRequestOrigin(pageContext) ??
    getConfiguredOrigin(["BETTER_AUTH_URL", "SERVICE_URL_APP_3000"]) ??
    LOCAL_ORIGIN
  );
}

function getConfiguredOrigin(keys: string[]) {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  for (const key of keys) {
    const origin = normalizeOrigin(runtime.process?.env?.[key]);
    if (origin) {
      return origin;
    }
  }

  return null;
}

function getRequestOrigin(pageContext: SeoPageContext) {
  const forwardedHost =
    getHeader(pageContext, "x-forwarded-host") ??
    getHeader(pageContext, "x-original-host");
  const host = forwardedHost ?? getHeader(pageContext, "host");

  if (!host) {
    return null;
  }

  const forwardedProto = getHeader(pageContext, "x-forwarded-proto");
  const protocol =
    forwardedProto ??
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

function getHeader(pageContext: SeoPageContext, name: string) {
  return (
    getHeaderFrom(pageContext.headersOriginal, name) ??
    getHeaderFrom(pageContext.headers, name)
  );
}

function getHeaderFrom(headers: unknown, name: string) {
  if (!headers) {
    return null;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return firstHeaderValue(headers.get(name));
  }

  if (typeof headers !== "object") {
    return null;
  }

  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];

  if (Array.isArray(value)) {
    return firstHeaderValue(String(value[0] ?? ""));
  }

  if (typeof value === "string") {
    return firstHeaderValue(value);
  }

  return null;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}
