import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { SettingsDataSchema } from "@/schemas/settings";
import { orpcQuery } from "@/server/orpc/client/query";

export type SettingsPageData = z.infer<typeof SettingsDataSchema>;

export function useSettings() {
  return useQuery(orpcQuery.settings.get.queryOptions());
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    ...orpcQuery.settings.update.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpcQuery.settings.get.queryOptions().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpcQuery.modules.capabilities.queryOptions().queryKey,
        }),
      ]);
    },
  });
}
