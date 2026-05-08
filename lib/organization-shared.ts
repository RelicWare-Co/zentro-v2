export const JOIN_LINK_EXPIRY_OPTIONS = [
	{ value: 1, label: "24 horas" },
	{ value: 7, label: "7 días" },
	{ value: 30, label: "30 días" },
] as const;

export type OrganizationJoinLinkStatus =
	| "active"
	| "expired"
	| "used"
	| "revoked";

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

export function formatJoinLinkStatusLabel(status: OrganizationJoinLinkStatus) {
	switch (status) {
		case "active":
			return "Activo";
		case "expired":
			return "Expirado";
		case "used":
			return "Usado";
		case "revoked":
			return "Revocado";
		default:
			return "Desconocido";
	}
}

export function isJoinLinkActive(status: OrganizationJoinLinkStatus) {
	return status === "active";
}
