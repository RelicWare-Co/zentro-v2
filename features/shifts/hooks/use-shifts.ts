import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { orpcQuery } from "@/server/orpc/client/query";
import type { z } from "zod";
import type { ListShiftsInputSchema } from "@/schemas/shifts";

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

export function useShiftDetail(shiftId: string | null) {
	return useQuery({
		...orpcQuery.shifts.detail.queryOptions(
			shiftId ? { input: { shiftId } } : { input: { shiftId: "" } },
		),
		enabled: Boolean(shiftId),
	});
}
