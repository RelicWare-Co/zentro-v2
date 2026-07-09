import { describe, expect, test } from "bun:test";
import { buildOrganizationAccessPolicy } from "@/features/organization/organization-policy.shared";
import { serverMutators } from "@/zero/mutators.server";
import { queries } from "@/zero/queries";
import type { ZeroContext } from "@/zero/schema";
import { seedOrganizationWithMember } from "./helpers/seed";
import { createTestDb } from "./helpers/test-db";
import { createZeroTestDb } from "./helpers/zero-shifts";

describe("Zero customers", () => {
  test("customer search and CRUD run through Zero without oRPC", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = {
      id: userId,
      orgID: organizationId,
      email: "test@example.com",
      role: "owner",
      systemRole: null,
      organizationPolicy: buildOrganizationAccessPolicy(),
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

    // try/catch instead of expect().rejects: bun test on Windows deadlocks
    // when a transaction promise is passed to expect().rejects.
    let duplicateDocumentMessage = "";
    try {
      await zeroDb.transaction((tx) =>
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
      );
    } catch (error) {
      duplicateDocumentMessage = (error as Error).message;
    }
    expect(duplicateDocumentMessage).toBe(
      "Ya existe un cliente activo con ese documento"
    );

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

  test("document number can be reused after the prior holder is soft-deleted", async () => {
    const { db, cleanup } = await createTestDb();
    const { organizationId, userId } = await seedOrganizationWithMember(db);
    const zeroDb = createZeroTestDb(db);
    const ctx = {
      id: userId,
      orgID: organizationId,
      email: "test@example.com",
      role: "owner",
      systemRole: null,
      organizationPolicy: buildOrganizationAccessPolicy(),
    } satisfies ZeroContext;

    const firstCustomerId = crypto.randomUUID();
    await zeroDb.transaction((tx) =>
      serverMutators.customers.create.fn({
        args: {
          id: firstCustomerId,
          name: "Original Holder",
          type: null,
          documentType: "CC",
          documentNumber: "999",
          email: null,
          phone: null,
          address: null,
          city: null,
          taxRegime: null,
        },
        ctx,
        tx,
      })
    );

    // Soft-delete the original holder of document "999".
    await zeroDb.transaction((tx) =>
      serverMutators.customers.delete.fn({
        args: { id: firstCustomerId },
        ctx,
        tx,
      })
    );

    // Re-using "999" for a brand new customer must succeed: the partial unique
    // index ignores soft-deleted rows, matching the app-level validation.
    const secondCustomerId = crypto.randomUUID();
    await zeroDb.transaction((tx) =>
      serverMutators.customers.create.fn({
        args: {
          id: secondCustomerId,
          name: "New Holder",
          type: null,
          documentType: "CC",
          documentNumber: "999",
          email: null,
          phone: null,
          address: null,
          city: null,
          taxRegime: null,
        },
        ctx,
        tx,
      })
    );

    const activeRows = await zeroDb.run(
      queries.customers.search.fn({
        args: { limit: 50, searchQuery: "999" },
        ctx,
      })
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]).toMatchObject({
      id: secondCustomerId,
      documentNumber: "999",
      name: "New Holder",
    });

    // Uniqueness must still hold among active customers sharing the document.
    let duplicateMessage = "";
    try {
      await zeroDb.transaction((tx) =>
        serverMutators.customers.create.fn({
          args: {
            id: crypto.randomUUID(),
            name: "Third Holder",
            type: null,
            documentType: "CC",
            documentNumber: "999",
            email: null,
            phone: null,
            address: null,
            city: null,
            taxRegime: null,
          },
          ctx,
          tx,
        })
      );
    } catch (error) {
      duplicateMessage = (error as Error).message;
    }
    expect(duplicateMessage).toBe(
      "Ya existe un cliente activo con ese documento"
    );

    await cleanup();
  });
});
