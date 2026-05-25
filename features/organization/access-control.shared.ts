export function parseRoleList(role: string | null | undefined) {
  return (role ?? "").split(",").flatMap((value) => {
    const trimmed = value.trim().toLowerCase();
    return trimmed ? [trimmed] : [];
  });
}

export function isOrganizationManagerRole(role: string | null | undefined) {
  const roles = parseRoleList(role);
  return roles.includes("owner") || roles.includes("admin");
}

export function isPlatformAdminRole(role: string | null | undefined) {
  return parseRoleList(role).includes("admin");
}
