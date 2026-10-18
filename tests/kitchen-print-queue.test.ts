import { describe, expect, test } from "bun:test";
import {
  isKitchenPrintAttemptable,
  type KitchenPrintRow,
  PRINT_CLAIM_TTL_MS,
  PRINT_RETRY_COOLDOWN_MS,
  waitForClaimConfirmation,
} from "@/features/restaurants/kitchen-print-queue.shared";

const TICKET_ID = "ticket_1";
const TOKEN = "token-a";

/**
 * Reloj falso: `waitForClaimConfirmation` es un bucle con espera, así que sin
 * inyección de tiempo estos tests dependerían de timers reales.
 */
function createClock() {
  let current = 1_000_000;
  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
  };
}

function runConfirmation(
  rows: () => readonly KitchenPrintRow[],
  overrides?: {
    claimToken?: string;
    clock?: ReturnType<typeof createClock>;
    sleep?: (milliseconds: number) => Promise<void>;
  }
) {
  const clock = overrides?.clock ?? createClock();
  return waitForClaimConfirmation({
    claimToken: overrides?.claimToken ?? TOKEN,
    getCurrentRows: rows,
    ticketId: TICKET_ID,
    now: clock.now,
    // Sin espera real: el reloj solo avanza cuando el test lo dice.
    sleep: overrides?.sleep ?? (() => Promise.resolve()),
    timeoutMs: 5000,
  });
}

describe("waitForClaimConfirmation", () => {
  test("confirms when the replicated row shows printing with our token", async () => {
    const rows: KitchenPrintRow[] = [
      { id: TICKET_ID, printClaimedBy: null, printStatus: "pending" },
    ];

    const result = runConfirmation(() => rows, {
      sleep: () => {
        rows[0] = {
          id: TICKET_ID,
          printClaimedBy: TOKEN,
          printStatus: "printing",
        };
        return Promise.resolve();
      },
    });

    expect(await result).toBe(true);
  });

  test("reads live rows instead of a frozen snapshot", async () => {
    // Regresión del bug de la bandeja "Salón": el getter leía el array
    // capturado en el closure del render, así que la confirmación nunca veía
    // el `printing` y la comanda nunca se imprimía.
    const liveRows: KitchenPrintRow[] = [
      { id: TICKET_ID, printClaimedBy: null, printStatus: "pending" },
    ];
    // El snapshot que habría capturado el closure del render.
    const frozenSnapshot: KitchenPrintRow[] = [
      { id: TICKET_ID, printClaimedBy: null, printStatus: "pending" },
    ];
    let polls = 0;

    const result = runConfirmation(() => liveRows, {
      sleep: () => {
        polls += 1;
        if (polls === 2) {
          liveRows[0] = {
            id: TICKET_ID,
            printClaimedBy: TOKEN,
            printStatus: "printing",
          };
        }
        return Promise.resolve();
      },
    });

    expect(await result).toBe(true);
    expect(frozenSnapshot[0].printStatus === "printing").toBe(false);
  });

  test("gives up when another caja owns the claim", async () => {
    const rows: KitchenPrintRow[] = [
      { id: TICKET_ID, printClaimedBy: "token-b", printStatus: "printing" },
    ];

    expect(await runConfirmation(() => rows)).toBe(false);
  });

  test.each(["printed", "skipped", "failed"] as const)(
    "gives up when the ticket is already %s",
    async (printStatus) => {
      const rows: KitchenPrintRow[] = [
        { id: TICKET_ID, printClaimedBy: null, printStatus },
      ];

      expect(await runConfirmation(() => rows)).toBe(false);
    }
  );

  test("gives up when the ticket leaves the result set", async () => {
    expect(await runConfirmation(() => [])).toBe(false);
  });

  test("times out when the claim is never confirmed", async () => {
    const clock = createClock();
    const rows: KitchenPrintRow[] = [
      { id: TICKET_ID, printClaimedBy: null, printStatus: "pending" },
    ];

    const result = runConfirmation(() => rows, {
      clock,
      // El reloj avanza solo: nunca se llega a la confirmación.
      sleep: () => {
        clock.advance(1000);
        return Promise.resolve();
      },
    });

    expect(await result).toBe(false);
  });
});

describe("isKitchenPrintAttemptable", () => {
  const now = 10_000_000;

  test("attempts pending tickets", () => {
    expect(
      isKitchenPrintAttemptable(
        { id: TICKET_ID, printStatus: "pending" },
        undefined,
        now
      )
    ).toBe(true);
  });

  test("respects the retry cooldown", () => {
    expect(
      isKitchenPrintAttemptable(
        { id: TICKET_ID, printStatus: "pending" },
        now - PRINT_RETRY_COOLDOWN_MS + 1,
        now
      )
    ).toBe(false);
    expect(
      isKitchenPrintAttemptable(
        { id: TICKET_ID, printStatus: "pending" },
        now - PRINT_RETRY_COOLDOWN_MS,
        now
      )
    ).toBe(true);
  });

  test("reclaims printing tickets older than the TTL", () => {
    expect(
      isKitchenPrintAttemptable(
        {
          id: TICKET_ID,
          printClaimedAt: now - PRINT_CLAIM_TTL_MS - 1,
          printStatus: "printing",
        },
        undefined,
        now
      )
    ).toBe(true);
  });

  test("leaves fresh printing claims to their owner", () => {
    expect(
      isKitchenPrintAttemptable(
        {
          id: TICKET_ID,
          printClaimedAt: now - 1000,
          printStatus: "printing",
        },
        undefined,
        now
      )
    ).toBe(false);
  });

  test("reclaims orphaned printing claims with no timestamp", () => {
    // Sin esto la comanda queda en `printing` para siempre: el servidor
    // tampoco puede reclamarla porque `print_claimed_at < x` es NULL en SQL.
    for (const printClaimedAt of [null, undefined]) {
      expect(
        isKitchenPrintAttemptable(
          { id: TICKET_ID, printClaimedAt, printStatus: "printing" },
          undefined,
          now
        )
      ).toBe(true);
    }
  });

  test.each(["printed", "skipped", "failed", null, undefined] as const)(
    "never attempts tickets in state %s",
    (printStatus) => {
      expect(
        isKitchenPrintAttemptable(
          { id: TICKET_ID, printStatus },
          undefined,
          now
        )
      ).toBe(false);
    }
  );
});
