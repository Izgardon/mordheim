import { useCallback, useEffect, useState } from "react";

type UseCampaignDataParams<T> = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
  fetchFn: (options: { campaignId: number }) => Promise<T[]>;
  label: string;
};

export function useCampaignData<T>({
  campaignId,
  hasCampaignId,
  enabled = true,
  auto = true,
  fetchFn,
  label,
}: UseCampaignDataParams<T>) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsLoading(true);
    setError("");

    try {
      const result = await fetchFn({ campaignId });
      setData(result);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || `Unable to load ${label}`);
      } else {
        setError(`Unable to load ${label}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, enabled, fetchFn, hasCampaignId, label]);

  useEffect(() => {
    if (!enabled || !auto) {
      return;
    }
    reload();
  }, [auto, enabled, reload]);

  return { data, setData, error, isLoading, reload };
}
