export function formatOrganizationRoleLabel(role: string | null | undefined) {
	const normalizedRoles = (role ?? "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);

	if (normalizedRoles.includes("owner")) {
		return "Owner";
	}

	if (normalizedRoles.includes("admin")) {
		return "Admin";
	}

	if (normalizedRoles.includes("member")) {
		return "Miembro";
	}

	return role?.trim() || "Sin rol";
}
