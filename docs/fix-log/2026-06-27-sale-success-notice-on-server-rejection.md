# Sale Success Notice on Server Rejection

## Symptom

When a sale failed server-side validation (for example, selling 2 units of a
product with only 1 in stock), the user saw both the error toast "El servidor
rechazó el cambio" **and** the success overlay "Venta registrada". The cart was
also cleared despite the sale never being committed.

## Root Cause

`waitForZeroMutation` (`lib/use-zero-mutation.ts`) only `await`ed the
**client-phase** result of a Zero mutation. The sale `create` and `cancel`
mutators are server-only: the client mutator is a no-op
(`features/sales/sales.mutators.ts`) so the client phase resolves immediately
and `waitForZeroMutation` returns success. TanStack Query then fired `onSuccess`
in `use-pos-checkout.ts`, which triggered the "Venta registrada" overlay
(`saleSuccessToken`) and cleared the cart.

The authoritative server validation (`runCreateSale` in
`features/sales/create-sale.server.ts`) ran later in the **server-phase**, which
`waitForZeroMutation` handled with a fire-and-forget `.then` that only showed
the rejection toast. Because the server phase was never awaited, the rejection
could not prevent `onSuccess` from running.

## Solution

- Add an `awaitServer` option to `waitForZeroMutation`. When `true`, the helper
  awaits the server result and throws on rejection (after showing the existing
  rejection toast) so the calling mutation fails and `onSuccess` does not fire.
- Pass `{ awaitServer: true }` from both `useCreateSaleMutation` and
  `useCancelSaleMutation` in `features/sales/hooks/use-sales.ts`, since both
  sales mutators are server-only with no optimistic client write.

This keeps the optimistic fire-and-forget behavior for all other mutators
(products, customers, shifts, etc.) unchanged.

## Verification

- `bunx tsc --noEmit` passes.
- `bun run check` (Ultracite) reports no fixes needed.
- A sale rejected by the server (insufficient stock) now surfaces only the
  rejection toast; the "Venta registrada" overlay no longer appears and the cart
  is not cleared.
