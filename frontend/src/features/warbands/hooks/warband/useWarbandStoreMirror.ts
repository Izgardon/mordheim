import { useEffect, useRef } from "react";

import type {
  HenchmenGroup,
  Warband,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";

type UseWarbandStoreMirrorOptions = {
  campaignId: number;
  isViewingOtherWarband: boolean;
  warband: Warband | null;
  roster: {
    heroes: WarbandHero[];
    hiredSwords: WarbandHiredSword[];
    henchmenGroups: HenchmenGroup[];
  };
  storeWarband: Warband | null;
  setStoreWarband: (warband: Warband | null) => void;
};

/** Copies your own warband and its roster into the app store (until F7 moves it to the cache). */
export function useWarbandStoreMirror({
  campaignId,
  isViewingOtherWarband,
  warband,
  roster: { heroes, hiredSwords, henchmenGroups },
  storeWarband,
  setStoreWarband,
}: UseWarbandStoreMirrorOptions) {
  // Read, not watched: the mirror runs when the page's data changes, as before.
  const storeWarbandRef = useRef(storeWarband);
  storeWarbandRef.current = storeWarband;
  const storeCampaignId = storeWarband?.campaign_id;

  useEffect(() => {
    if (isViewingOtherWarband) {
      return;
    }
    const current = storeWarbandRef.current;

    if (!warband) {
      if (current?.campaign_id === campaignId) {
        setStoreWarband(null);
      }
      return;
    }

    if (
      current &&
      current.id === warband.id &&
      current.name === warband.name &&
      current.faction === warband.faction &&
      current.gold === warband.gold &&
      current.rating === warband.rating &&
      current.resources === warband.resources &&
      current.heroes === heroes &&
      current.hired_swords === hiredSwords &&
      current.henchmen_groups === henchmenGroups
    ) {
      return;
    }

    setStoreWarband({
      ...warband,
      heroes,
      hired_swords: hiredSwords,
      henchmen_groups: henchmenGroups,
    });
  }, [
    campaignId,
    henchmenGroups,
    heroes,
    hiredSwords,
    isViewingOtherWarband,
    setStoreWarband,
    storeCampaignId,
    warband,
  ]);
}
