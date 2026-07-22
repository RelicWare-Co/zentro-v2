export interface MemberFilterOptionSource {
  user?: { name?: string | null } | null;
  userId: string;
}

export function buildUniqueCashierFilterOptions(
  members: MemberFilterOptionSource[]
) {
  const cashiersByUserId = new Map<string, { id: string; name: string }>();

  for (const memberRow of members) {
    if (!cashiersByUserId.has(memberRow.userId)) {
      cashiersByUserId.set(memberRow.userId, {
        id: memberRow.userId,
        name: memberRow.user?.name ?? "Cajero",
      });
    }
  }

  return [...cashiersByUserId.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, "es-CO")
  );
}
