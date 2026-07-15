import { describe, expect, test } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildKitchenTicketDocument } from "@/features/restaurants/printing/kitchen-ticket-documents";
import { KitchenTicketCard } from "@/pages/(app)/kitchen/+Page";

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

  test("prints a comment correction as one modification", () => {
    const document = buildKitchenTicketDocument({
      ticketId: "ticket_123456789",
      kind: "correction",
      orderNumber: 42,
      sequenceNumber: 2,
      createdAt: new Date("2026-01-02T15:04:00-05:00"),
      tableName: "Mesa 4",
      areaName: "Terraza",
      items: [
        {
          productName: "Hamburguesa",
          quantity: 1,
          operation: "modify",
          previousNotes: "Sin cebolla",
          previousQuantity: 1,
          notes: "Sin tomate",
        },
      ],
    });

    expect(document.receipt.title).toBe("CORRECCIÓN DE COMANDA");
    expect(document.receipt.documentLabel).toBe("Comanda #42 • CORRECCIÓN #2");
    expect(document.receipt.items?.[0]?.label).toBe(
      "MODIFICACIÓN: Hamburguesa"
    );
    expect(document.receipt.items?.[0]?.secondaryLines).toContain(
      "Comentario: Sin cebolla → Sin tomate"
    );
  });

  test("prints explicit quantity changes", () => {
    const document = buildKitchenTicketDocument({
      ticketId: "ticket_123456789",
      kind: "correction",
      orderNumber: 42,
      sequenceNumber: 2,
      createdAt: new Date("2026-01-02T15:04:00-05:00"),
      tableName: "Mesa 4",
      areaName: "Terraza",
      items: [
        {
          productName: "Hamburguesa",
          quantity: 1,
          operation: "modify",
          previousQuantity: 2,
        },
        {
          productName: "Ensalada",
          quantity: 3,
          operation: "modify",
          previousQuantity: 2,
        },
      ],
    });

    expect(document.receipt.items?.[0]?.secondaryLines).toContain(
      "Cantidad reducida: 2 → 1"
    );
    expect(document.receipt.items?.[1]?.secondaryLines).toContain(
      "Cantidad aumentada: 2 → 3"
    );
  });

  test("renders correction KDS with a stable ticket identity and high contrast", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MantineProvider,
        null,
        createElement(KitchenTicketCard, {
          isUpdating: false,
          onUpdateStatus: () => undefined,
          ticket: {
            id: "ticket_123456789",
            orderId: "order_123",
            orderNumber: 42,
            kind: "correction",
            sequenceNumber: 2,
            status: "sent",
            createdAt: new Date("2026-01-02T15:04:00-05:00").getTime(),
            table: {
              id: "table_123",
              name: "Mesa 4",
              areaName: "Terraza",
            },
            lines: [
              {
                id: "line_modify",
                operation: "modify",
                productName: "Hamburguesa",
                quantity: 1,
                status: "sent",
                notes: "Sin tomate",
                previousNotes: "Sin cebolla",
                previousQuantity: 1,
                modifiers: [],
                previousModifiers: [],
              },
              {
                id: "line_prepare",
                operation: "prepare",
                productName: "Ensalada",
                quantity: 1,
                status: "sent",
                notes: null,
                previousNotes: null,
                previousQuantity: null,
                modifiers: [],
                previousModifiers: [],
              },
            ],
          },
        })
      )
    );

    expect(markup).toContain("border-4 border-black");
    expect(markup).toContain("Comanda #42 · Mesa 4");
    expect(markup).toContain("CORRECCIÓN #2");
    expect(markup).toContain("MODIFICACIÓN");
    expect(markup).toContain("Comentario: Sin cebolla → Sin tomate");
    expect(markup).toContain("Confirmar modificación");
    expect(markup).not.toContain("CANCELAR / NO PREPARAR");
    expect(markup).toContain("Marcar Listo");
    expect(markup).toContain("Despachar");
  });
});
