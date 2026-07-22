# Prevent duplicate organization memberships

## Symptom

Opening `/shifts` for an affected organization crashed Mantine `Select` with
`Duplicate options are not supported`. The repeated option value was the
affected user's ID.

Production data confirmed two `member` rows with the same
`(organization_id, user_id)`. Both rows had the `member` role and were created
seconds apart through different enrollment paths.

## Root cause

The `member` table had separate indexes for `organization_id` and `user_id`,
but no compound uniqueness constraint. A user could redeem a Zentro join link
and then accept an existing Better Auth invitation for the same organization;
both paths inserted a membership.

Shift and sales filter builders mapped every membership row directly to a
Mantine option. Mantine correctly rejected the repeated user ID and prevented
the page from rendering.

## Solution

- Add a unique index for `member (organization_id, user_id)`.
- Make join-link membership insertion conflict-safe.
- Resolve a matching pending invitation during join-link redemption and use
  its role for the resulting membership.
- Build cashier filter options through a shared helper that deduplicates by
  `userId`, so anomalous replicated data cannot crash `/shifts` or `/sales`.

The migration intentionally does not delete existing duplicates. Environments
must clean conflicting data before applying the unique index so role conflicts
are reviewed instead of resolved silently.

## Verification

- `bun test tests/member-filter-options.test.ts`
- `bun test tests/organization.test.ts --timeout 30000`
- `bun run zero:schema:gen`
- `bunx tsc --noEmit`
- `bun run check`

The organization integration tests verify that join-link redemption consumes a
matching invitation, creates only one membership, and that PostgreSQL rejects a
second membership for the same organization and user.
