import type {
  SessionWithImpersonatedBy,
  UserWithRole,
} from "better-auth/plugins/admin";

export type AdminPanelUser = UserWithRole;
export type AdminPanelSession = SessionWithImpersonatedBy;

export function parseUserRoles(role: string | null | undefined): string[] {
  return (
    role?.split(",").flatMap((value) => {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }) ?? []
  );
}

export function isAdminUser(
  user: { role?: string | null } | null | undefined
): boolean {
  return parseUserRoles(user?.role).includes("admin");
}

export function getImpersonatedBy(
  session: { impersonatedBy?: string | null } | null | undefined
): string | null {
  return session?.impersonatedBy ?? null;
}

export const ADMIN_ROLE_OPTIONS = [
  { value: "user", label: "Usuario" },
  { value: "admin", label: "Administrador" },
] as const;

export type AdminRoleValue = (typeof ADMIN_ROLE_OPTIONS)[number]["value"];

export function formatUserRoleLabel(role: string | null | undefined): string {
  return isAdminUser({ role }) ? "Administrador" : "Usuario";
}

const SECONDS_PER_DAY = 60 * 60 * 24;

export const ADMIN_BAN_DURATION_OPTIONS = [
  { value: "permanent", label: "Permanente", seconds: null },
  { value: "1d", label: "1 día", seconds: SECONDS_PER_DAY },
  { value: "7d", label: "7 días", seconds: SECONDS_PER_DAY * 7 },
  { value: "30d", label: "30 días", seconds: SECONDS_PER_DAY * 30 },
] as const;

export type AdminBanDurationValue =
  (typeof ADMIN_BAN_DURATION_OPTIONS)[number]["value"];

export function getBanDurationSeconds(
  value: AdminBanDurationValue
): number | null {
  return (
    ADMIN_BAN_DURATION_OPTIONS.find((option) => option.value === value)
      ?.seconds ?? null
  );
}

const adminDateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAdminDateTime(
  value: Date | number | string | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : adminDateTimeFormatter.format(date);
}

const ORGANIZATION_ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
};

export function formatOrganizationRoleLabel(
  role: string | null | undefined
): string {
  if (!role) {
    return "Miembro";
  }
  return ORGANIZATION_ROLE_LABELS[role] ?? role;
}

const SALE_STATUS_LABELS: Record<string, string> = {
  completed: "Completada",
  credit: "Fiado",
  cancelled: "Cancelada",
};

export function formatSaleStatusLabel(status: string): string {
  return SALE_STATUS_LABELS[status] ?? status;
}

const ACTIVATION_POLICY_LABELS: Record<string, string> = {
  self_service: "Autogestionado",
  entitled_self_service: "Autogestionado con permiso",
  platform_admin_only: "Solo administrador de la app",
};

export function formatActivationPolicyLabel(policy: string): string {
  return ACTIVATION_POLICY_LABELS[policy] ?? policy;
}

export function isUserCurrentlyBanned(user: AdminPanelUser): boolean {
  if (!user.banned) {
    return false;
  }
  if (!user.banExpires) {
    return true;
  }
  const expires = new Date(user.banExpires);
  return Number.isNaN(expires.getTime()) || expires.getTime() > Date.now();
}
