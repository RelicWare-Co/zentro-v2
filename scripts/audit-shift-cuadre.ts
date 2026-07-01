/**
 * Script de auditoría del cuadre de caja.
 *
 * Ejecutar sin BD:
 *   bun run scripts/audit-shift-cuadre.ts
 *
 * Ejecutar con BD (auditar turnos reales):
 *   bun run scripts/audit-shift-cuadre.ts --db
 *   bun run scripts/audit-shift-cuadre.ts --db --shift <shiftId>
 *   bun run scripts/audit-shift-cuadre.ts --db --scan
 *
 * Partes:
 * 1. Pruebas de la matemática de buildExpectedAmountsByMethod (sin BD)
 * 2. Pruebas del pipeline completo (normalizeShiftPayments, buildShiftListItem, buildShiftCloseSummary)
 * 3. Fuzz test con escenarios aleatorios
 * 4. Auditoría de turnos reales en la BD (opcional, requiere DATABASE_URL)
 */

import { eq } from "drizzle-orm";
import {
  buildExpectedAmountsByMethod,
  buildShiftCloseSummary,
  buildShiftListItem,
  type ShiftWithRelations,
} from "@/features/shifts/shifts.shared";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface TestPayment {
  amount: number;
  method: string;
  saleId?: string | null;
  saleTotalAmount?: number | null;
}

interface TestMovement {
  amount: number;
  paymentMethod: string;
  type: string;
}

interface MathScenario {
  expected: Record<string, number>;
  movements: TestMovement[];
  name: string;
  payments: TestPayment[];
  startingCash: number;
}

// ---------------------------------------------------------------------------
// Computación independiente del efectivo esperado.
//
// Esta es una implementación deliberadamente distinta a la de
// buildExpectedAmountsByMethod: itera por venta en vez de por lote,
// y no usa Map. Si ambas implementaciones divergen, hay un bug.
// ---------------------------------------------------------------------------

type SaleStats = Record<
  string,
  { saleTotal: number; totalPaid: number; cashPaid: number }
>;

function buildSaleStatsAndMethodTotals(
  payments: TestPayment[],
  methodTotals: Record<string, number>
): SaleStats {
  const saleStats: SaleStats = {};

  for (const p of payments) {
    methodTotals[p.method] = (methodTotals[p.method] ?? 0) + p.amount;

    if (p.saleId && p.saleTotalAmount != null) {
      const key = p.saleId;
      if (!saleStats[key]) {
        saleStats[key] = {
          saleTotal: p.saleTotalAmount,
          totalPaid: 0,
          cashPaid: 0,
        };
      }
      saleStats[key].totalPaid += p.amount;
      if (p.method === "cash") {
        saleStats[key].cashPaid += p.amount;
      }
    }
  }

  return saleStats;
}

function computeTotalChange(saleStats: SaleStats): number {
  let totalChange = 0;
  for (const key of Object.keys(saleStats)) {
    const s = saleStats[key];
    const overpayment = Math.max(s.totalPaid - s.saleTotal, 0);
    if (overpayment > 0 && s.cashPaid > 0) {
      totalChange += Math.min(overpayment, s.cashPaid);
    }
  }
  return totalChange;
}

function applyMovements(
  movements: TestMovement[],
  methodTotals: Record<string, number>
): void {
  for (const m of movements) {
    const method = m.paymentMethod || "cash";
    if (m.type === "inflow") {
      methodTotals[method] = (methodTotals[method] ?? 0) + m.amount;
    } else if (m.type === "expense" || m.type === "payout") {
      methodTotals[method] = (methodTotals[method] ?? 0) - m.amount;
    }
  }
}

function computeExpectedIndependently(
  startingCash: number,
  payments: TestPayment[],
  movements: TestMovement[]
): Record<string, number> {
  const methodTotals: Record<string, number> = {};
  const saleStats = buildSaleStatsAndMethodTotals(payments, methodTotals);

  const totalChange = computeTotalChange(saleStats);
  if (totalChange > 0) {
    methodTotals.cash = Math.max((methodTotals.cash ?? 0) - totalChange, 0);
  }
  methodTotals.cash = (methodTotals.cash ?? 0) + startingCash;

  applyMovements(movements, methodTotals);

  return methodTotals;
}

function compareMaps(
  actual: Map<string, number>,
  expected: Record<string, number>
): { match: boolean; details: string } {
  const allKeys = new Set([...actual.keys(), ...Object.keys(expected)]);
  const diffs: string[] = [];

  for (const key of allKeys) {
    const actualVal = actual.get(key) ?? 0;
    const expectedVal = expected[key] ?? 0;
    if (actualVal !== expectedVal) {
      diffs.push(
        `  ${key}: sistema=${actualVal}, esperado=${expectedVal} (diff=${actualVal - expectedVal})`
      );
    }
  }

  if (diffs.length === 0) {
    return { match: true, details: "" };
  }
  return { match: false, details: diffs.join("\n") };
}

// ---------------------------------------------------------------------------
// Parte 1: Pruebas de la matemática de buildExpectedAmountsByMethod
// ---------------------------------------------------------------------------

function buildMathScenarios(): MathScenario[] {
  const scenarios: MathScenario[] = [];

  scenarios.push({
    name: "Turno vacío sin base",
    startingCash: 0,
    payments: [],
    movements: [],
    expected: {},
  });

  scenarios.push({
    name: "Turno vacío con base de efectivo",
    startingCash: 50_000,
    payments: [],
    movements: [],
    expected: { cash: 50_000 },
  });

  scenarios.push({
    name: "Una venta en efectivo, pago exacto",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 10_000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 60_000 },
  });

  scenarios.push({
    name: "Una venta en efectivo con cambio (sobra 5000)",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 15_000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 60_000 },
  });

  scenarios.push({
    name: "Una venta con tarjeta, pago exacto",
    startingCash: 50_000,
    payments: [
      { method: "card", amount: 10_000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 50_000, card: 10_000 },
  });

  scenarios.push({
    name: "Pago dividido efectivo+tarjeta, exacto",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 5000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 55_000, card: 5000 },
  });

  scenarios.push({
    name: "Pago dividido con sobrepago en efectivo (cambio 3000)",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 8000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 5000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 55_000, card: 5000 },
  });

  scenarios.push({
    name: "Pago dividido con sobrepago menor al efectivo recibido",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 8000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 4000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 56_000, card: 4000 },
  });

  scenarios.push({
    name: "Múltiples ventas en efectivo, todas exactas",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 5000 },
      { method: "cash", amount: 8000, saleId: "s2", saleTotalAmount: 8000 },
      { method: "cash", amount: 3000, saleId: "s3", saleTotalAmount: 3000 },
    ],
    movements: [],
    expected: { cash: 26_000 },
  });

  scenarios.push({
    name: "Múltiples ventas con cambio en algunas",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 15_000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "cash", amount: 8000, saleId: "s2", saleTotalAmount: 8000 },
      { method: "cash", amount: 10_000, saleId: "s3", saleTotalAmount: 5000 },
    ],
    movements: [],
    expected: { cash: 33_000 },
  });

  scenarios.push({
    name: "Ventas en múltiples métodos sin cambio",
    startingCash: 20_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 5000 },
      { method: "card", amount: 10_000, saleId: "s2", saleTotalAmount: 10_000 },
      { method: "cash", amount: 3000, saleId: "s3", saleTotalAmount: 3000 },
      { method: "nequi", amount: 7000, saleId: "s4", saleTotalAmount: 7000 },
    ],
    movements: [],
    expected: { cash: 28_000, card: 10_000, nequi: 7000 },
  });

  scenarios.push({
    name: "Movimiento inflow en efectivo",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 5000 },
    ],
    movements: [{ type: "inflow", paymentMethod: "cash", amount: 3000 }],
    expected: { cash: 18_000 },
  });

  scenarios.push({
    name: "Movimiento expense en efectivo",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 5000 },
    ],
    movements: [{ type: "expense", paymentMethod: "cash", amount: 2000 }],
    expected: { cash: 13_000 },
  });

  scenarios.push({
    name: "Movimiento payout en efectivo",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 5000, saleId: "s1", saleTotalAmount: 5000 },
    ],
    movements: [{ type: "payout", paymentMethod: "cash", amount: 4000 }],
    expected: { cash: 11_000 },
  });

  scenarios.push({
    name: "Movimiento en método no-efectivo (gasto con tarjeta)",
    startingCash: 10_000,
    payments: [
      { method: "card", amount: 10_000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [{ type: "expense", paymentMethod: "card", amount: 3000 }],
    expected: { cash: 10_000, card: 7000 },
  });

  scenarios.push({
    name: "Múltiples movimientos mixtos",
    startingCash: 20_000,
    payments: [
      { method: "cash", amount: 10_000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 8000, saleId: "s2", saleTotalAmount: 8000 },
    ],
    movements: [
      { type: "inflow", paymentMethod: "cash", amount: 2000 },
      { type: "expense", paymentMethod: "cash", amount: 1500 },
      { type: "payout", paymentMethod: "cash", amount: 3000 },
      { type: "expense", paymentMethod: "card", amount: 1000 },
    ],
    expected: { cash: 27_500, card: 7000 },
  });

  scenarios.push({
    name: "Pago con saleId null (abono general sin venta)",
    startingCash: 10_000,
    payments: [{ method: "cash", amount: 5000, saleId: null }],
    movements: [],
    expected: { cash: 15_000 },
  });

  scenarios.push({
    name: "Pago con saleTotalAmount null (relación no cargada)",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 15_000, saleId: "s1", saleTotalAmount: null },
    ],
    movements: [],
    expected: { cash: 25_000 },
  });

  scenarios.push({
    name: "Dos pagos para la misma venta, ambos efectivo, con sobrepago",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 6000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "cash", amount: 6000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 60_000 },
  });

  scenarios.push({
    name: "Dos pagos para la misma venta, efectivo+tarjeta, con sobrepago",
    startingCash: 50_000,
    payments: [
      { method: "cash", amount: 7000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 6000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 54_000, card: 6000 },
  });

  scenarios.push({
    name: "Base cero, una venta exacta en efectivo",
    startingCash: 0,
    payments: [
      { method: "cash", amount: 10_000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 10_000 },
  });

  scenarios.push({
    name: "Escenario complejo: 5 ventas + 3 movimientos",
    startingCash: 30_000,
    payments: [
      { method: "cash", amount: 15_000, saleId: "s1", saleTotalAmount: 12_000 },
      { method: "card", amount: 8000, saleId: "s2", saleTotalAmount: 8000 },
      { method: "cash", amount: 5000, saleId: "s3", saleTotalAmount: 5000 },
      {
        method: "nequi",
        amount: 10_000,
        saleId: "s4",
        saleTotalAmount: 10_000,
      },
      { method: "cash", amount: 12_000, saleId: "s5", saleTotalAmount: 10_000 },
    ],
    movements: [
      { type: "inflow", paymentMethod: "cash", amount: 2000 },
      { type: "expense", paymentMethod: "cash", amount: 3000 },
      { type: "payout", paymentMethod: "card", amount: 1000 },
    ],
    expected: { cash: 56_000, card: 7000, nequi: 10_000 },
  });

  scenarios.push({
    name: "Venta con descuento: total 9900, pago exacto en efectivo",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 9900, saleId: "s1", saleTotalAmount: 9900 },
    ],
    movements: [],
    expected: { cash: 19_900 },
  });

  scenarios.push({
    name: "Venta con descuento: total 9900, pago con sobrepago en efectivo",
    startingCash: 10_000,
    payments: [
      { method: "cash", amount: 15_000, saleId: "s1", saleTotalAmount: 9900 },
    ],
    movements: [],
    expected: { cash: 19_900 },
  });

  scenarios.push({
    name: "Pago exacto con tres métodos divididos",
    startingCash: 0,
    payments: [
      { method: "cash", amount: 3000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "card", amount: 4000, saleId: "s1", saleTotalAmount: 10_000 },
      { method: "nequi", amount: 3000, saleId: "s1", saleTotalAmount: 10_000 },
    ],
    movements: [],
    expected: { cash: 3000, card: 4000, nequi: 3000 },
  });

  return scenarios;
}

function runMathTests(): {
  passed: number;
  failed: number;
  failures: string[];
} {
  const scenarios = buildMathScenarios();
  let passed = 0;
  const failures: string[] = [];

  for (const scenario of scenarios) {
    const actual = buildExpectedAmountsByMethod(
      scenario.startingCash,
      scenario.payments,
      scenario.movements
    );
    const result = compareMaps(actual, scenario.expected);

    if (result.match) {
      passed++;
    } else {
      failures.push(`FALLO: ${scenario.name}\n${result.details}`);
    }
  }

  return { passed, failed: failures.length, failures };
}

// ---------------------------------------------------------------------------
// Parte 2: Pruebas del pipeline completo
// ---------------------------------------------------------------------------

function makeShiftWithRelations(
  overrides?: Partial<ShiftWithRelations>
): ShiftWithRelations {
  return {
    id: overrides?.id ?? "shift-1",
    organizationId: overrides?.organizationId ?? "org-1",
    userId: overrides?.userId ?? "user-1",
    openedAt: overrides?.openedAt ?? Date.now(),
    status: overrides?.status ?? "open",
    startingCash: overrides?.startingCash ?? 0,
    terminalId: overrides?.terminalId ?? null,
    terminalName: overrides?.terminalName ?? null,
    closedAt: overrides?.closedAt ?? null,
    notes: overrides?.notes ?? null,
    user: overrides?.user ?? { id: "user-1", name: "Cajero Test" },
    payments: overrides?.payments ?? [],
    cashMovements: overrides?.cashMovements ?? [],
    closures: overrides?.closures ?? [],
    sales: overrides?.sales ?? [],
  };
}

interface PipelineScenario {
  expectedCash: number;
  expectedTotalExpected: number;
  expectedTotalPayments: number;
  name: string;
  shift: ShiftWithRelations;
}

function buildPipelineScenarios(): PipelineScenario[] {
  const scenarios: PipelineScenario[] = [];

  scenarios.push({
    name: "Pipeline: venta simple + movimiento inflow",
    shift: makeShiftWithRelations({
      startingCash: 50_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
      ],
      cashMovements: [
        {
          id: "m1",
          type: "inflow",
          paymentMethod: "cash",
          amount: 2000,
          description: "Ajuste",
          createdAt: 2000,
        },
      ],
      sales: [{ status: "completed", totalAmount: 10_000 }],
    }),
    expectedCash: 62_000,
    expectedTotalPayments: 15_000,
    expectedTotalExpected: 62_000,
  });

  scenarios.push({
    name: "Pipeline: venta cancelada filtrada del cuadre",
    shift: makeShiftWithRelations({
      startingCash: 10_000,
      payments: [
        {
          method: "cash",
          amount: 10_000,
          saleId: "s1",
          createdAt: 1000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
        {
          method: "cash",
          amount: 5000,
          saleId: "s2",
          createdAt: 2000,
          sale: { totalAmount: 5000, status: "cancelled" },
        },
      ],
      cashMovements: [],
      sales: [
        { status: "completed", totalAmount: 10_000 },
        { status: "cancelled", totalAmount: 5000 },
      ],
    }),
    expectedCash: 20_000,
    expectedTotalPayments: 10_000,
    expectedTotalExpected: 20_000,
  });

  scenarios.push({
    name: "Pipeline: relación sale null → sin cálculo de cambio",
    shift: makeShiftWithRelations({
      startingCash: 10_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: null,
        },
      ],
      cashMovements: [],
      sales: [],
    }),
    expectedCash: 25_000,
    expectedTotalPayments: 15_000,
    expectedTotalExpected: 25_000,
  });

  scenarios.push({
    name: "Pipeline: pago sin saleId (abono general) se incluye",
    shift: makeShiftWithRelations({
      startingCash: 20_000,
      payments: [
        {
          method: "cash",
          amount: 5000,
          saleId: null,
          createdAt: 1000,
          sale: null,
        },
      ],
      cashMovements: [],
      sales: [],
    }),
    expectedCash: 25_000,
    expectedTotalPayments: 5000,
    expectedTotalExpected: 25_000,
  });

  scenarios.push({
    name: "Pipeline: split payment + cambio + movimiento",
    shift: makeShiftWithRelations({
      startingCash: 30_000,
      payments: [
        {
          method: "cash",
          amount: 8000,
          saleId: "s1",
          createdAt: 1000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
        {
          method: "card",
          amount: 5000,
          saleId: "s1",
          createdAt: 1100,
          sale: { totalAmount: 10_000, status: "completed" },
        },
        {
          method: "cash",
          amount: 10_000,
          saleId: "s2",
          createdAt: 2000,
          sale: { totalAmount: 7000, status: "completed" },
        },
      ],
      cashMovements: [
        {
          id: "m1",
          type: "expense",
          paymentMethod: "cash",
          amount: 2000,
          description: "Gasto",
          createdAt: 3000,
        },
      ],
      sales: [
        { status: "completed", totalAmount: 10_000 },
        { status: "completed", totalAmount: 7000 },
      ],
    }),
    expectedCash: 40_000,
    expectedTotalPayments: 23_000,
    expectedTotalExpected: 45_000,
  });

  return scenarios;
}

function runPipelineTests(): {
  passed: number;
  failed: number;
  failures: string[];
} {
  const scenarios = buildPipelineScenarios();
  let passed = 0;
  const failures: string[] = [];

  for (const scenario of scenarios) {
    const listItem = buildShiftListItem(scenario.shift);
    const issues: string[] = [];

    if (listItem.totals.expectedCash !== scenario.expectedCash) {
      issues.push(
        `  expectedCash: sistema=${listItem.totals.expectedCash}, esperado=${scenario.expectedCash} (diff=${listItem.totals.expectedCash - scenario.expectedCash})`
      );
    }
    if (listItem.totals.totalPayments !== scenario.expectedTotalPayments) {
      issues.push(
        `  totalPayments: sistema=${listItem.totals.totalPayments}, esperado=${scenario.expectedTotalPayments} (diff=${listItem.totals.totalPayments - scenario.expectedTotalPayments})`
      );
    }
    if (listItem.totals.totalExpected !== scenario.expectedTotalExpected) {
      issues.push(
        `  totalExpected: sistema=${listItem.totals.totalExpected}, esperado=${scenario.expectedTotalExpected} (diff=${listItem.totals.totalExpected - scenario.expectedTotalExpected})`
      );
    }

    if (issues.length === 0) {
      passed++;
    } else {
      failures.push(`FALLO: ${scenario.name}\n${issues.join("\n")}`);
    }

    const summary = buildShiftCloseSummary(scenario.shift, null);
    const summaryCash = summary.summaryByMethod.find(
      (row) => row.paymentMethod === "cash"
    );
    if (summaryCash && summaryCash.expectedAmount !== scenario.expectedCash) {
      failures.push(
        `FALLO (close-summary): ${scenario.name}\n  expectedCash: sistema=${summaryCash.expectedAmount}, esperado=${scenario.expectedCash}`
      );
    }
  }

  return { passed, failed: failures.length, failures };
}

// ---------------------------------------------------------------------------
// Parte 3: Fuzz test
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 0x1_00_00_00_00;
    return state / 0x1_00_00_00_00;
  };
}

function runFuzzTest(iterations: number): {
  passed: number;
  failed: number;
  failures: string[];
} {
  const rng = seededRandom(42);
  const methods = ["cash", "card", "nequi", "daviplata"];
  const movementTypes = ["inflow", "expense", "payout"];
  let passed = 0;
  const failures: string[] = [];

  for (let i = 0; i < iterations; i++) {
    const startingCash = Math.floor(rng() * 100_000);
    const numSales = Math.floor(rng() * 5) + 1;
    const numMovements = Math.floor(rng() * 3);
    const payments: TestPayment[] = [];

    for (let s = 0; s < numSales; s++) {
      const saleId = `fuzz-sale-${i}-${s}`;
      const saleTotal = Math.floor(rng() * 20_000) + 1000;
      const numPayments = Math.floor(rng() * 3) + 1;

      for (let p = 0; p < numPayments; p++) {
        const method = methods[Math.floor(rng() * methods.length)];
        const amount = Math.floor(rng() * 15_000) + 500;
        payments.push({ method, amount, saleId, saleTotalAmount: saleTotal });
      }
    }

    const movements: TestMovement[] = [];
    for (let m = 0; m < numMovements; m++) {
      movements.push({
        type: movementTypes[Math.floor(rng() * 3)],
        paymentMethod: methods[Math.floor(rng() * methods.length)],
        amount: Math.floor(rng() * 5000) + 100,
      });
    }

    const actual = buildExpectedAmountsByMethod(
      startingCash,
      payments,
      movements
    );
    const expected = computeExpectedIndependently(
      startingCash,
      payments,
      movements
    );
    const result = compareMaps(actual, expected);

    if (result.match) {
      passed++;
    } else {
      failures.push(
        `FALLO FUZZ #${i}: startingCash=${startingCash}, sales=${numSales}, payments=${payments.length}, movements=${numMovements}\n${result.details}`
      );
      if (failures.length >= 5) {
        failures.push("(más fallos omitidos)");
        break;
      }
    }
  }

  return { passed, failed: failures.length, failures };
}

// ---------------------------------------------------------------------------
// Parte 3b: Demostración de escenarios de descuadre
//
// Estos escenarios muestran cómo el sistema puede producir un cuadre
// incorrecto cuando los datos de la relación sale no están disponibles.
// ---------------------------------------------------------------------------

interface DescuadreScenario {
  description: string;
  name: string;
  shiftWithoutSaleRelation: ShiftWithRelations;
  shiftWithSaleRelation: ShiftWithRelations;
}

function buildDescuadreScenarios(): DescuadreScenario[] {
  const scenarios: DescuadreScenario[] = [];

  scenarios.push({
    name: "Venta con cambio: relación sale presente vs ausente",
    description:
      "Venta de 10000 pagada con 15000 en efectivo (cambio 5000). " +
      "Cuando la relación sale NO se carga, el sistema no resta el cambio " +
      "y el efectivo esperado se infla en 5000.",
    shiftWithSaleRelation: makeShiftWithRelations({
      startingCash: 50_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
      ],
      sales: [{ status: "completed", totalAmount: 10_000 }],
    }),
    shiftWithoutSaleRelation: makeShiftWithRelations({
      startingCash: 50_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: null,
        },
      ],
      sales: [],
    }),
  });

  scenarios.push({
    name: "Múltiples ventas con cambio: relación sale ausente",
    description:
      "3 ventas con cambio. Sin la relación sale, el sistema infla " +
      "el efectivo esperado por la suma de todos los cambios no restados.",
    shiftWithSaleRelation: makeShiftWithRelations({
      startingCash: 20_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
        {
          method: "cash",
          amount: 8000,
          saleId: "s2",
          createdAt: 2000,
          sale: { totalAmount: 5000, status: "completed" },
        },
        {
          method: "cash",
          amount: 12_000,
          saleId: "s3",
          createdAt: 3000,
          sale: { totalAmount: 10_000, status: "completed" },
        },
      ],
      sales: [
        { status: "completed", totalAmount: 10_000 },
        { status: "completed", totalAmount: 5000 },
        { status: "completed", totalAmount: 10_000 },
      ],
    }),
    shiftWithoutSaleRelation: makeShiftWithRelations({
      startingCash: 20_000,
      payments: [
        {
          method: "cash",
          amount: 15_000,
          saleId: "s1",
          createdAt: 1000,
          sale: null,
        },
        {
          method: "cash",
          amount: 8000,
          saleId: "s2",
          createdAt: 2000,
          sale: null,
        },
        {
          method: "cash",
          amount: 12_000,
          saleId: "s3",
          createdAt: 3000,
          sale: null,
        },
      ],
      sales: [],
    }),
  });

  return scenarios;
}

function runDescuadreDemos(): { count: number; allInflated: boolean } {
  const scenarios = buildDescuadreScenarios();
  let allInflated = true;

  console.log("\n  Escenarios de descuadre por relación sale faltante:\n");

  for (const scenario of scenarios) {
    const withRelation = buildShiftListItem(scenario.shiftWithSaleRelation);
    const withoutRelation = buildShiftListItem(
      scenario.shiftWithoutSaleRelation
    );

    const correctCash = withRelation.totals.expectedCash;
    const inflatedCash = withoutRelation.totals.expectedCash;
    const discrepancy = inflatedCash - correctCash;

    console.log(`  ${scenario.name}`);
    console.log(`  ${scenario.description}`);
    console.log(
      `    Efectivo esperado (correcto, con relación sale):  ${correctCash}`
    );
    console.log(
      `    Efectivo esperado (sin relación sale):            ${inflatedCash}`
    );
    console.log(
      `    Discrepancia (inflado):                           ${discrepancy}`
    );
    console.log(
      `    Si el cajero cuenta ${correctCash} y el sistema espera ${inflatedCash}:`
    );
    console.log(
      `    → Diferencia registrada: ${correctCash - inflatedCash} (FALTA)`
    );
    console.log("");

    if (discrepancy <= 0) {
      allInflated = false;
    }
  }

  return { count: scenarios.length, allInflated };
}

// ---------------------------------------------------------------------------
// Parte 4: Auditoría de turnos reales en la BD
// ---------------------------------------------------------------------------

async function auditShiftInDb(shiftId: string): Promise<void> {
  const { dbSqlite } = await import("@/database/drizzle/db");
  const { shift, payment, cashMovement, shiftClosure } = await import(
    "@/database/drizzle/schema/pos.schema"
  );
  const { sale: saleTable } = await import(
    "@/database/drizzle/schema/sales.schema"
  );

  const db = dbSqlite();

  const [targetShift] = await db
    .select()
    .from(shift)
    .where(eq(shift.id, shiftId))
    .limit(1);

  if (!targetShift) {
    console.log(`  Turno ${shiftId} no encontrado`);
    return;
  }

  console.log(`\n  Turno: ${targetShift.id}`);
  console.log(`  Estado: ${targetShift.status}`);
  console.log(`  Base inicial: ${targetShift.startingCash}`);
  console.log(`  Cajero: ${targetShift.userId}`);
  console.log(`  Abierto: ${targetShift.openedAt?.toISOString()}`);
  console.log(`  Cerrado: ${targetShift.closedAt?.toISOString() ?? "N/A"}`);

  const shiftPayments = await db
    .select({
      id: payment.id,
      method: payment.method,
      amount: payment.amount,
      saleId: payment.saleId,
      createdAt: payment.createdAt,
    })
    .from(payment)
    .where(eq(payment.shiftId, shiftId));

  console.log(`\n  Pagos en BD: ${shiftPayments.length}`);
  for (const p of shiftPayments) {
    console.log(`    ${p.method}: ${p.amount} (saleId=${p.saleId ?? "null"})`);
  }

  const shiftMovements = await db
    .select()
    .from(cashMovement)
    .where(eq(cashMovement.shiftId, shiftId));

  console.log(`\n  Movimientos: ${shiftMovements.length}`);
  for (const m of shiftMovements) {
    console.log(
      `    ${m.type} (${m.paymentMethod}): ${m.amount} - ${m.description}`
    );
  }

  const saleIds = shiftPayments
    .map((p) => p.saleId)
    .filter((id): id is string => id != null);

  const saleTotals = new Map<string, { totalAmount: number; status: string }>();
  if (saleIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    const sales = await db
      .select({
        id: saleTable.id,
        totalAmount: saleTable.totalAmount,
        status: saleTable.status,
      })
      .from(saleTable)
      .where(inArray(saleTable.id, saleIds));
    for (const s of sales) {
      saleTotals.set(s.id, { totalAmount: s.totalAmount, status: s.status });
    }
  }

  const filteredPayments = shiftPayments
    .filter((p) => {
      if (!p.saleId) {
        return true;
      }
      const saleInfo = saleTotals.get(p.saleId);
      return saleInfo?.status !== "cancelled";
    })
    .map((p) => {
      const saleInfo = p.saleId ? saleTotals.get(p.saleId) : undefined;
      return {
        method: p.method,
        amount: p.amount,
        saleId: p.saleId,
        saleTotalAmount: saleInfo?.totalAmount ?? null,
      };
    });

  const recomputed = buildExpectedAmountsByMethod(
    targetShift.startingCash,
    filteredPayments,
    shiftMovements.map((m) => ({
      type: m.type,
      paymentMethod: m.paymentMethod ?? "cash",
      amount: m.amount,
    }))
  );

  console.log("\n  Expected recomputado:");
  for (const [method, amount] of recomputed) {
    console.log(`    ${method}: ${amount}`);
  }

  const storedClosures = await db
    .select()
    .from(shiftClosure)
    .where(eq(shiftClosure.shiftId, shiftId));

  console.log(`\n  Cierres almacenados: ${storedClosures.length}`);
  let allMatch = true;
  for (const c of storedClosures) {
    const recomputedAmount = recomputed.get(c.paymentMethod) ?? 0;
    const match = recomputedAmount === c.expectedAmount;
    if (!match) {
      allMatch = false;
    }
    console.log(
      `    ${c.paymentMethod}: esperado_almacenado=${c.expectedAmount}, recomputado=${recomputedAmount}, actual=${c.actualAmount}, diff=${c.difference} ${match ? "OK" : "DESCUADRE"}`
    );
  }

  if (allMatch && storedClosures.length > 0) {
    console.log("\n  RESULTADO: Cierres coinciden con recomputación");
  } else if (storedClosures.length > 0) {
    console.log(
      "\n  RESULTADO: DESCUADRE detectado entre cierres almacenados y recomputación"
    );
  } else {
    console.log("\n  RESULTADO: Sin cierres almacenados");
  }
}

async function scanRecentShifts(): Promise<void> {
  const { dbSqlite } = await import("@/database/drizzle/db");
  const { shift } = await import("@/database/drizzle/schema/pos.schema");
  const { desc } = await import("drizzle-orm");

  const db = dbSqlite();
  const recentShifts = await db
    .select({ id: shift.id, status: shift.status, openedAt: shift.openedAt })
    .from(shift)
    .orderBy(desc(shift.openedAt))
    .limit(20);

  console.log(`\nEscaneando ${recentShifts.length} turnos recientes...\n`);

  for (const s of recentShifts) {
    console.log(
      `--- Turno ${s.id} (${s.status}, ${s.openedAt?.toISOString()}) ---`
    );
    await auditShiftInDb(s.id);
    console.log("");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const useDb = args.includes("--db");
  const scanMode = args.includes("--scan");
  const shiftIndex = args.indexOf("--shift");
  const shiftId = shiftIndex >= 0 ? args[shiftIndex + 1] : null;

  console.log("=".repeat(70));
  console.log("AUDITORÍA DEL CUADRE DE CAJA");
  console.log("=".repeat(70));

  if (!useDb) {
    console.log("\nModo: pruebas de matemática (sin BD)");
    console.log(
      "\nPara auditar turnos reales: bun run scripts/audit-shift-cuadre.ts --db --scan"
    );
  }

  console.log(`\n${"-".repeat(70)}`);
  console.log("PARTE 1: Pruebas de buildExpectedAmountsByMethod");
  console.log("-".repeat(70));
  const mathResult = runMathTests();
  console.log(
    `  Pasaron: ${mathResult.passed}/${mathResult.passed + mathResult.failed}`
  );
  if (mathResult.failures.length > 0) {
    console.log("\n  FALLOS:");
    for (const f of mathResult.failures) {
      console.log(`\n  ${f}`);
    }
  }

  console.log(`\n${"-".repeat(70)}`);
  console.log(
    "PARTE 2: Pruebas del pipeline (normalizeShiftPayments + buildShiftListItem)"
  );
  console.log("-".repeat(70));
  const pipelineResult = runPipelineTests();
  console.log(
    `  Pasaron: ${pipelineResult.passed}/${pipelineResult.passed + pipelineResult.failed}`
  );
  if (pipelineResult.failures.length > 0) {
    console.log("\n  FALLOS:");
    for (const f of pipelineResult.failures) {
      console.log(`\n  ${f}`);
    }
  }

  console.log(`\n${"-".repeat(70)}`);
  console.log("PARTE 3: Fuzz test (1000 escenarios aleatorios)");
  console.log("-".repeat(70));
  const fuzzResult = runFuzzTest(1000);
  console.log(
    `  Pasaron: ${fuzzResult.passed}/${fuzzResult.passed + fuzzResult.failed}`
  );
  if (fuzzResult.failures.length > 0) {
    console.log("\n  FALLOS:");
    for (const f of fuzzResult.failures) {
      console.log(`\n  ${f}`);
    }
  }

  console.log(`\n${"-".repeat(70)}`);
  console.log("PARTE 3b: Demostración de escenarios de descuadre");
  console.log("-".repeat(70));
  runDescuadreDemos();

  const totalPassed =
    mathResult.passed + pipelineResult.passed + fuzzResult.passed;
  const totalFailed =
    mathResult.failed + pipelineResult.failed + fuzzResult.failed;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`RESUMEN: ${totalPassed} pasaron, ${totalFailed} fallaron`);
  console.log("=".repeat(70));

  if (useDb) {
    console.log(`\n${"-".repeat(70)}`);
    console.log("PARTE 4: Auditoría de turnos en BD");
    console.log("-".repeat(70));

    if (shiftId) {
      await auditShiftInDb(shiftId);
    } else if (scanMode) {
      await scanRecentShifts();
    } else {
      console.log(
        "\n  Usa --shift <shiftId> o --scan para especificar qué auditar"
      );
    }
  }

  if (totalFailed > 0) {
    console.log("\n*** SE DETECTARON FALLOS ***");
    process.exit(1);
  } else {
    console.log(
      "\nTodas las pruebas pasaron. La matemática del cuadre es correcta."
    );
    console.log(
      "\nCAUSA RAÍZ IDENTIFICADA: Cuando la relación payment→sale no se carga"
    );
    console.log(
      "(cache de Zero incompleto, timing de sincronización, o query parcial),"
    );
    console.log(
      "el sistema NO resta el cambio entregado en efectivo, inflando el"
    );
    console.log(
      "efectivo esperado y produciendo una FALTA ficticia en el cuadre."
    );
    console.log("");
    console.log(
      "Para auditar turnos reales: bun run scripts/audit-shift-cuadre.ts --db --scan"
    );
  }
}

main().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
