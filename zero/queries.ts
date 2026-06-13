// Shared Zero queries — composition root.
//
// Domain query definitions live in `features/<domain>/<domain>.queries.ts`.
// This file only assembles them for `/api/zero/query` dispatch by name.

import { defineQueries } from "@rocicorp/zero";
import { creditQueries } from "@/features/credit/credit.queries";
import { customersQueries } from "@/features/customers/customers.queries";
import { modulesQueries } from "@/features/modules/modules.queries";
import { organizationQueries } from "@/features/organization/organization.queries";
import { productsQueries } from "@/features/products/products.queries";
import { restaurantsQueries } from "@/features/restaurants/restaurants.queries";
import { salesQueries } from "@/features/sales/sales.queries";
import { shiftsQueries } from "@/features/shifts/shifts.queries";
import "./context";

export const queries = defineQueries({
  ...organizationQueries,
  ...customersQueries,
  ...productsQueries,
  ...creditQueries,
  ...shiftsQueries,
  ...salesQueries,
  ...modulesQueries,
  ...restaurantsQueries,
});

export type Queries = typeof queries;
