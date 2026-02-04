import { useCallback, useEffect, useState } from "react";

import { listSpells } from "../../spells/api/spells-api";

import type { Spell } from "../../spells/types/spell-types";

type UseCampaignSpellsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSpells({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignSpellsParams) {
  const [availableSpells, setAvailableSpells] = useState<Spell[]>([]);
  const [spellsError, setSpellsError] = useState("");
  const [isSpellsLoading, setIsSpellsLoading] = useState(false);

  const loadSpells = useCallback(async () => {
    if (!enabled || !hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsSpellsLoading(true);
    setSpellsError("");

    try {
      const data = await listSpells({ campaignId });
      setAvailableSpells(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSpellsError(errorResponse.message || "Unable to load spells");
      } else {
        setSpellsError("Unable to load spells");
      }
    } finally {
      setIsSpellsLoading(false);
    }
  }, [campaignId, enabled, hasCampaignId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadSpells();
  }, [enabled, loadSpells]);

  return {
    availableSpells,
    setAvailableSpells,
    spellsError,
    isSpellsLoading,
    loadSpells,
  };
}

