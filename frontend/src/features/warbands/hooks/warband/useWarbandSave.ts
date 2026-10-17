import { useState, type RefObject } from "react";

import {
  deleteWarbandHero,
  getWarbandSummary,
  updateWarband,
  updateWarbandHero,
} from "@/features/warbands/api/warbands-api";
import { heroKind } from "@/features/warbands/units/kinds/hero";
import {
  commitPendingPurchases,
  type PendingPurchase,
} from "@/features/warbands/utils/pending-purchases";

import type {
  HeroFormEntry,
  Warband,
  WarbandHero,
  WarbandUpdatePayload,
} from "@/features/warbands/types/warband-types";
import type { NewHeroForm } from "@/features/warbands/utils/warband-utils";

type UseWarbandSaveParams = {
  warband: Warband | null;
  canEdit: boolean;
  warbandForm: WarbandUpdatePayload;
  heroes: WarbandHero[];
  heroForms: HeroFormEntry[];
  removedHeroIds: number[];
  isAddingHeroForm: boolean;
  newHeroForm: NewHeroForm;
  raceQuery: string;
  originalHeroFormsRef: RefObject<Map<number, string>>;
  onSuccess: (updatedWarband: Warband, refreshedHeroes: WarbandHero[]) => void;
  pendingPurchases?: PendingPurchase[];
  onPendingCleared?: () => void;
};

export function useWarbandSave({
  warband,
  canEdit,
  warbandForm,
  heroes,
  heroForms,
  removedHeroIds,
  isAddingHeroForm,
  newHeroForm,
  raceQuery,
  originalHeroFormsRef,
  onSuccess,
  pendingPurchases = [],
  onPendingCleared,
}: UseWarbandSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const mergeHeroes = (current: WarbandHero[], updated: WarbandHero[], removedIds: number[]) => {
    const removed = new Set(removedIds);
    const next = current.filter((hero) => !removed.has(hero.id));
    const byId = new Map(next.map((hero) => [hero.id, hero]));
    for (const hero of updated) {
      byId.set(hero.id, hero);
    }
    return Array.from(byId.values());
  };

  const handleSaveChanges = async () => {
    if (!warband || !canEdit) {
      return;
    }

    const trimmedName = warbandForm.name.trim();
    const trimmedFaction = warbandForm.faction.trim();
    if (!trimmedName || !trimmedFaction) {
      setSaveError("Name and faction are required.");
      return;
    }

    const isHeroDraftDirty =
      isAddingHeroForm &&
      (newHeroForm.name.trim() ||
        newHeroForm.unit_type.trim() ||
        raceQuery.trim() ||
        (newHeroForm.price.trim() && newHeroForm.price.trim() !== "0") ||
        (newHeroForm.xp.trim() && newHeroForm.xp.trim() !== "0"));
    if (isHeroDraftDirty) {
      setSaveError("Finish creating the new hero or cancel it before saving.");
      return;
    }

    const currentHeroErrors = heroForms.map((hero) => heroKind.validate(hero));
    const hasHeroErrors = currentHeroErrors.some(Boolean);
    if (hasHeroErrors) {
      setHasAttemptedSave(true);
      setSaveError("Fix hero details before saving.");
      return;
    }
    const hasLeader = heroForms.some((hero) => hero.is_leader);
    if (!hasLeader) {
      setHasAttemptedSave(true);
      setSaveError("Select a leader before saving.");
      return;
    }
    setHasAttemptedSave(false);

    setIsSaving(true);
    setSaveError("");

    try {
      const shouldUpdateWarband =
        trimmedName !== warband.name || trimmedFaction !== warband.faction;
      const updatedWarband = shouldUpdateWarband
        ? await updateWarband(
            warband.id,
            {
              name: trimmedName,
              faction: trimmedFaction,
            },
            { emitUpdate: false }
          )
        : warband;

      const updatePromises = heroForms
        .filter((hero) => {
          if (!hero.id) return false;
          const original = originalHeroFormsRef.current?.get(hero.id);
          return !original || original !== JSON.stringify(hero);
        })
        .map((hero) =>
          updateWarbandHero(
            warband.id,
            hero.id as number,
            heroKind.buildPayload(hero, { isSessionCreated: false })
          )
        );

      const deletePromises = removedHeroIds.map((heroId) =>
        deleteWarbandHero(warband.id, heroId, { emitUpdate: false })
      );

      const updatedHeroes = await Promise.all(updatePromises);
      await Promise.all(deletePromises);

      const heroPurchases = pendingPurchases.filter(
        (entry) => entry.unitType === "heroes" && !removedHeroIds.includes(Number(entry.unitId))
      );

      if (heroPurchases.length > 0) {
        await commitPendingPurchases(warband.id, heroPurchases, (entry) => {
          const match = heroForms.find((hero) => String(hero.id) === entry.unitId);
          return match?.name?.trim() || "Unknown Hero";
        });
      }

      const refreshedHeroes = mergeHeroes(heroes, updatedHeroes, removedHeroIds);
      const shouldRefreshSummary =
        updatedHeroes.length > 0 || removedHeroIds.length > 0 || heroPurchases.length > 0;
      const summary = shouldRefreshSummary ? await getWarbandSummary(warband.id) : null;

      onSuccess(summary ? { ...updatedWarband, ...summary } : updatedWarband, refreshedHeroes);
      if (pendingPurchases.length > 0) {
        onPendingCleared?.();
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSaveError(errorResponse.message || "Unable to update warband");
      } else {
        setSaveError("Unable to update warband");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    saveError,
    setSaveError,
    hasAttemptedSave,
    setHasAttemptedSave,
    handleSaveChanges,
  };
}
