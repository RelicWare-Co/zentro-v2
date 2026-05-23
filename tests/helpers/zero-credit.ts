import {
  buildCreditAccountListItem,
  buildCreditTransactionListItem,
  type CreditAccountWithCustomer,
  filterCreditAccountRows,
  paginateCreditAccounts,
  paginateCreditTransactions,
} from "@/features/credit/credit.shared";
import { serverMutators } from "@/src/zero/mutators.server";
import { queries } from "@/src/zero/queries";
import type { ZeroContext } from "@/src/zero/schema";
import type { createZeroTestDb } from "./zero-shifts";

type ZeroTestDb = ReturnType<typeof createZeroTestDb>;

export async function searchCreditAccountsViaZero({
  zeroDb,
  ctx,
  input = {},
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input?: {
    searchQuery?: string | null;
    limit?: number;
    cursor?: number;
  };
}) {
  const rows = await zeroDb.run(
    queries.credit.accounts.fn({ args: undefined, ctx })
  );
  const filteredRows = filterCreditAccountRows(
    rows as CreditAccountWithCustomer[],
    {
      searchQuery: input.searchQuery ?? null,
    }
  );
  const accounts = filteredRows
    .map((row) => buildCreditAccountListItem(row))
    .filter((account) => account !== null);

  return paginateCreditAccounts(accounts, {
    searchQuery: input.searchQuery ?? null,
    limit: input.limit,
    cursor: input.cursor,
  });
}

export async function listCreditTransactionsViaZero({
  zeroDb,
  ctx,
  creditAccountId,
  input = {},
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  creditAccountId: string;
  input?: {
    limit?: number;
    cursor?: number;
  };
}) {
  const rows = await zeroDb.run(
    queries.credit.transactions.fn({
      args: { creditAccountId },
      ctx,
    })
  );
  const transactions = rows.map(buildCreditTransactionListItem);

  return paginateCreditTransactions(transactions, {
    limit: input.limit,
    cursor: input.cursor,
  });
}

export async function registerCreditPaymentViaZero({
  zeroDb,
  ctx,
  input,
}: {
  zeroDb: ZeroTestDb;
  ctx: ZeroContext;
  input: {
    shiftId: string;
    creditAccountId: string;
    saleId?: string | null;
    amount: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    createdAt?: number;
  };
}) {
  const paymentId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();

  await zeroDb.transaction((tx) =>
    serverMutators.credit.registerPayment.fn({
      args: {
        ...input,
        paymentId,
        transactionId,
      },
      ctx,
      tx,
    })
  );

  const accountRows = await zeroDb.run(
    queries.credit.accounts.fn({ args: undefined, ctx })
  );
  const account = accountRows.find((row) => row.id === input.creditAccountId);

  return {
    creditAccountId: input.creditAccountId,
    saleId: input.saleId ?? null,
    paymentId,
    transactionId,
    amount: input.amount,
    newBalance: account?.balance ?? 0,
  };
}
