import { describe, expect, test } from "bun:test";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { serverMutators } from "@/src/zero/mutators.server";
import { queries } from "@/src/zero/queries";
import { type ZeroContext, schema as zeroSchema } from "@/src/zero/schema";
import { seedOrganizationWithMember } from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";

describe("Zero customers", () => {
  test("customer search and CRUD run through Zero without oRPC", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = zeroDrizzle(zeroSchema, db);
    const ctx = {
      id: userId,
      orgID: organizationId,
      email: "test@example.com",
      role: "owner",
      systemRole: null,
    } satisfies ZeroContext;

    const customerId = crypto.randomUUID();

    await zeroDb.transaction((tx) =>
      serverMutators.customers.create.fn({
        args: {
          id: customerId,
          name: "  Ada Lovelace  ",
          type: null,
          documentType: " CC ",
          documentNumber: " 123 ",
          email: " ada@example.com ",
          phone: " 300 ",
          address: null,
          city: null,
          taxRegime: null,
        },
        ctx,
        tx,
      })
    );

    const createdRows = await zeroDb.run(
      queries.customers.search.fn({
        args: { limit: 50, searchQuery: "ada" },
        ctx,
      })
    );
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0]).toMatchObject({
      documentNumber: "123",
      name: "Ada Lovelace",
      organizationId,
      type: "natural",
    });

    await expect(
      zeroDb.transaction((tx) =>
        serverMutators.customers.create.fn({
          args: {
            id: crypto.randomUUID(),
            name: "Duplicate Document",
            type: null,
            documentType: "CC",
            documentNumber: "123",
            email: null,
            phone: null,
            address: null,
            city: null,
            taxRegime: null,
          },
          ctx,
          tx,
        })
      )
    ).rejects.toThrow("Ya existe un cliente activo con ese documento");

    await zeroDb.transaction((tx) =>
      serverMutators.customers.update.fn({
        args: {
          id: customerId,
          name: "Ada Byron",
          phone: "301",
        },
        ctx,
        tx,
      })
    );

    const updatedRows = await zeroDb.run(
      queries.customers.search.fn({
        args: { limit: 50, searchQuery: "byron" },
        ctx,
      })
    );
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]).toMatchObject({
      id: customerId,
      name: "Ada Byron",
      phone: "301",
    });

    await zeroDb.transaction((tx) =>
      serverMutators.customers.delete.fn({
        args: { id: customerId },
        ctx,
        tx,
      })
    );

    const deletedRows = await zeroDb.run(
      queries.customers.search.fn({
        args: { limit: 50, searchQuery: "byron" },
        ctx,
      })
    );
    expect(deletedRows).toHaveLength(0);

    await cleanup();
  });
});
