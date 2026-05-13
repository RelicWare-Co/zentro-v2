import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import type { ListShiftsInputSchema } from "@/schemas/shifts";
import { orpcQuery } from "@/server/orpc/client/query";

export type ShiftsListParams = z.infer<typeof ListShiftsInputSchema>;

export function useShiftsList(params: ShiftsListParams = {}) {
  return useQuery({
    ...orpcQuery.shifts.list.queryOptions({ input: params }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}


