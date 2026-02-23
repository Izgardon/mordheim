import { useEffect, useState } from "react";

import type { BattleParticipant } from "@/features/battles/types/battle-types";
import { listWarbandHeroDetails } from "@/features/warbands/api/warbands-heroes";
import { listWarbandHenchmenGroupDetails } from "@/features/warbands/api/warbands-henchmen";
import { listWarbandHiredSwordDetails } from "@/features/warbands/api/warbands-hiredswords";

import type { ParticipantRoster } from "./prebattle-types";
import { extractSingleUseItems, getUnitStats } from "./prebattle-utils";

async function loadParticipantRoster(warbandId: number): Promise<ParticipantRoster> {
  const [heroes, hiredSwords, henchmenGroups] = await Promise.all([
    listWarbandHeroDetails(warbandId),
    listWarbandHiredSwordDetails(warbandId),
    listWarbandHenchmenGroupDetails(warbandId),
  ]);

  return {
    heroes: heroes.map((hero) => ({
      key: `hero:${hero.id}`,
      id: hero.id,
      kind: "hero",
      displayName: hero.name || `Hero ${hero.id}`,
      unitType: hero.unit_type || "Hero",
      stats: getUnitStats(hero as unknown as Record<string, unknown>),
      singleUseItems: extractSingleUseItems((hero as { items?: unknown }).items),
    })),
    hiredSwords: hiredSwords.map((hiredSword) => ({
      key: `hired_sword:${hiredSword.id}`,
      id: hiredSword.id,
      kind: "hired_sword",
      displayName: hiredSword.name || `Hired Sword ${hiredSword.id}`,
      unitType: hiredSword.unit_type || "Hired Sword",
      stats: getUnitStats(hiredSword as unknown as Record<string, unknown>),
      singleUseItems: extractSingleUseItems((hiredSword as { items?: unknown }).items),
    })),
    henchmenGroups: henchmenGroups.map((group) => {
      const groupStats = getUnitStats(group as unknown as Record<string, unknown>);
      const groupSingleUseItems = extractSingleUseItems((group as { items?: unknown }).items);
      const groupName = group.name || `Henchmen Group ${group.id}`;
      return {
        id: group.id,
        name: groupName,
        unitType: group.unit_type || "Henchmen",
        members: (group.henchmen || []).map((henchman) => ({
          key: `henchman:${henchman.id}`,
          id: henchman.id,
          kind: "henchman",
          displayName: henchman.name || `Henchman ${henchman.id}`,
          unitType: group.unit_type || "Henchman",
          stats: groupStats,
          singleUseItems: groupSingleUseItems,
        })),
      };
    }),
  };
}

export function usePrebattleRosters(participants: BattleParticipant[] | undefined) {
  const [rosters, setRosters] = useState<Record<number, ParticipantRoster>>({});
  const [rosterLoading, setRosterLoading] = useState<Record<number, boolean>>({});
  const [rosterErrors, setRosterErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const rosterParticipants = participants ?? [];
    rosterParticipants.forEach((participant) => {
      const userId = participant.user.id;
      if (rosters[userId] || rosterLoading[userId]) {
        return;
      }

      setRosterLoading((prev) => ({ ...prev, [userId]: true }));
      setRosterErrors((prev) => ({ ...prev, [userId]: "" }));

      void loadParticipantRoster(participant.warband.id)
        .then((roster) => {
          setRosters((prev) => ({ ...prev, [userId]: roster }));
        })
        .catch((errorResponse) => {
          if (errorResponse instanceof Error) {
            setRosterErrors((prev) => ({
              ...prev,
              [userId]: errorResponse.message || "Unable to load roster",
            }));
          } else {
            setRosterErrors((prev) => ({ ...prev, [userId]: "Unable to load roster" }));
          }
        })
        .finally(() => {
          setRosterLoading((prev) => ({ ...prev, [userId]: false }));
        });
    });
  }, [participants, rosterLoading, rosters]);

  return {
    rosters,
    rosterLoading,
    rosterErrors,
  };
}

