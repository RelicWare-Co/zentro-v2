export function parseRoleList(role: string | null | undefined) {
	return (role ?? "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

export function isOrganizationManagerRole(role: string | null | undefined) {
	const roles = parseRoleList(role);
	return roles.includes("owner") || roles.includes("admin");
}

export function isPlatformAdminRole(role: string | null | undefined) {
	return parseRoleList(role).includes("admin");
}
