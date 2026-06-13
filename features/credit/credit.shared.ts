import type { z } from "zod";
import type {
  CreditAccountSchema,
  CreditTransactionSchema,
  SearchCreditAccountsSchema,
} from "@/features/credit/credit.schema";
import type {
  CreditAccount as ZeroCreditAccount,
  CreditTransaction as ZeroCreditTransaction,
  Customer as ZeroCustomer,
} from "@/zero/schema";

export type CreditAccount = z.infer<typeof CreditAccountSchema>;
export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;
export type CreditAccountsSearchParams = z.infer<
  typeof SearchCreditAccountsSchema
>;

export type CreditAccountWithCustomer = ZeroCreditAccount & {
  readonly customer?: ZeroCustomer | null;
};

export interface PaginatedCreditAccounts {
  data: CreditAccount[];
  hasMore: boolean;
  nextCursor: number | null;
  total: number;
}

export interface PaginatedCreditTransactions {
  data: CreditTransaction[];
  hasMore: boolean;
  nextCursor: number | null;
  total: number;
}

function normalizeLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 100);
}

function normalizeCursor(cursor?: number) {
  return Math.max(cursor ?? 0, 0);
}

function normalizeSearchQuery(searchQuery?: string | null) {
  return searchQuery?.trim().toLowerCase() ?? "";
}

export function buildCreditAccountListItem(
  row: CreditAccountWithCustomer
): CreditAccount | null {
  if (row.customer?.deletedAt != null) {
    return null;
  }

  return {
    id: row.id,
    customerId: row.customerId,
    balance: row.balance ?? 0,
    interestRate: row.interestRate ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? row.createdAt,
    customerName: row.customer?.name ?? "Cliente",
    customerDocument: row.customer?.documentNumber ?? null,
    customerPhone: row.customer?.phone ?? null,
  };
}

function matchesCreditAccountRow(
  row: CreditAccountWithCustomer,
  normalizedSearch: string
) {
  if (row.customer?.deletedAt != null) {
    return false;
  }

  if (!normalizedSearch) {
    return true;
  }

  const haystack = [
    row.customer?.name ?? "",
    row.customer?.documentNumber ?? "",
    row.customer?.phone ?? "",
    row.customer?.email ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

export function filterCreditAccountRows(
  rows: CreditAccountWithCustomer[],
  input: Pick<CreditAccountsSearchParams, "searchQuery"> = {}
): CreditAccountWithCustomer[] {
  const normalizedSearch = normalizeSearchQuery(input.searchQuery);

  return rows
    .filter((row) => matchesCreditAccountRow(row, normalizedSearch))
    .toSorted((left, right) => {
      const leftName = left.customer?.name ?? "";
      const rightName = right.customer?.name ?? "";
      const nameComparison = leftName.localeCompare(rightName, "es-CO");
      if (nameComparison !== 0) {
        return nameComparison;
      }
      return left.id.localeCompare(right.id);
    });
}

export function paginateCreditAccounts(
  accounts: CreditAccount[],
  input: CreditAccountsSearchParams = {}
): PaginatedCreditAccounts {
  const limit = normalizeLimit(input.limit);
  const cursor = normalizeCursor(input.cursor);
  const pageRows = accounts.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < accounts.length;
  const nextCursor = hasMore ? cursor + limit : null;

  return {
    data: pageRows,
    total: accounts.length,
    hasMore,
    nextCursor,
  };
}

export function buildCreditTransactionListItem(
  row: ZeroCreditTransaction
): CreditTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount ?? 0,
    notes: row.notes ?? null,
    saleId: row.saleId ?? null,
    paymentId: row.paymentId ?? null,
    createdAt: row.createdAt,
  };
}

export function paginateCreditTransactions(
  transactions: CreditTransaction[],
  input: { cursor?: number; limit?: number } = {}
): PaginatedCreditTransactions {
  const limit = normalizeLimit(input.limit);
  const cursor = normalizeCursor(input.cursor);
  const pageRows = transactions.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < transactions.length;
  const nextCursor = hasMore ? cursor + limit : null;

  return {
    data: pageRows,
    total: transactions.length,
    hasMore,
    nextCursor,
  };
}
