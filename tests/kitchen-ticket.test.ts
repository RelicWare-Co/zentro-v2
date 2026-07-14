import { describe, expect, test } from "bun:test";
import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";

describe("kitchen ticket document", () => {
  test("includes the item note in the thermal ticket", () => {
    const document = buildKitchenTicketDocument({
      ticketId: "ticket_123456789",
      orderNumber: 42,
      sequenceNumber: 1,
      createdAt: new Date("2026-01-02T15:04:00-05:00"),
      tableName: "Mesa 4",
      areaName: "Terraza",
      items: [
        {
          productName: "Hamburguesa",
          quantity: 1,
          notes: "Sin cebolla",
        },
      ],
    });

    expect(document.receipt.items?.[0]?.secondaryLines).toContain(
      "Nota: Sin cebolla"
    );
  });
});
