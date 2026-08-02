export type AdminTab =
  | "overview"
  | "organizations"
  | "users"
  | "sales"
  | "imports";

const ADMIN_QUERY_KEYS = new Set([
  "adminTab",
  "period",
  "startDate",
  "endDate",
  "organizationId",
  "search",
  "searchField",
  "role",
  "banned",
  "emailVerified",
  "hasSales",
  "moduleKey",
  "moduleStatus",
  "sellerId",
  "terminalName",
  "status",
  "paymentMethod",
  "balanceStatus",
  "totalMin",
  "totalMax",
  "paidMin",
  "paidMax",
  "importerKey",
  "createdByUserId",
  "totalRowsMin",
  "totalRowsMax",
  "invalidRowsMin",
  "invalidRowsMax",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
  "u_period",
  "u_startDate",
  "u_endDate",
  "u_organizationId",
  "u_search",
  "u_searchField",
  "u_role",
  "u_banned",
  "u_emailVerified",
  "u_hasSales",
  "u_paidMin",
  "u_paidMax",
  "u_sortBy",
  "u_sortDirection",
  "u_page",
  "o_period",
  "o_startDate",
  "o_endDate",
  "o_search",
  "o_moduleKey",
  "o_moduleStatus",
  "o_hasSales",
  "o_paidMin",
  "o_paidMax",
  "o_sortBy",
  "o_sortDirection",
  "o_page",
  "s_period",
  "s_startDate",
  "s_endDate",
  "s_search",
  "s_organizationId",
  "s_sellerId",
  "s_terminalName",
  "s_status",
  "s_paymentMethod",
  "s_balanceStatus",
  "s_totalMin",
  "s_totalMax",
  "s_paidMin",
  "s_paidMax",
  "s_sortBy",
  "s_sortDirection",
  "s_page",
  "i_search",
  "i_organizationId",
  "i_importerKey",
  "i_status",
  "i_createdByUserId",
  "i_startDate",
  "i_endDate",
  "i_totalRowsMin",
  "i_totalRowsMax",
  "i_invalidRowsMin",
  "i_invalidRowsMax",
  "i_sortBy",
  "i_sortDirection",
  "i_page",
  "i_pageSize",
  "v_period",
  "v_startDate",
  "v_endDate",
  "v_organizationId",
]);

export function getAdminUrlParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function getAdminUrlTab(): AdminTab {
  const value = getAdminUrlParams().get("adminTab");
  return value === "organizations" ||
    value === "users" ||
    value === "sales" ||
    value === "imports"
    ? value
    : "overview";
}

export function replaceAdminUrlParams(
  updates: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === "undefined") {
    return;
  }
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }
  for (const [key, value] of Object.entries(updates)) {
    if (!ADMIN_QUERY_KEYS.has(key)) {
      continue;
    }
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  const search = url.searchParams.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${search ? `?${search}` : ""}${url.hash}`
  );
}

export function clearAdminUrlParams(keys: string[]) {
  replaceAdminUrlParams(Object.fromEntries(keys.map((key) => [key, null])));
}

export function serializeAdminParams(
  values: Record<string, string | number | boolean | null | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params;
}
