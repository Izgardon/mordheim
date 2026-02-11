import { useState } from "react";

import {
  createWarbandHero,
  deleteWarbandHero,
  listWarbandHeroes,
  updateWarband,
  updateWarbandHero,
} from "../api/warbands-api";
import {
  buildStatPayload,
  toNullableNumber,
  validateHeroForm,
} from "../utils/warband-utils";

import type {
  HeroFormEntry,
  Warband,
  WarbandHero,
  WarbandUpdatePayload,
} from "../types/warband-types";
import type { NewHeroForm } from "../utils/warband-utils";

type UseWarbandSaveParams = {
  warband: Warband | null;
  canEdit: boolean;
  warbandForm: WarbandUpdatePayload;
  heroForms: HeroFormEntry[];
  removedHeroIds: number[];
  isAddingHeroForm: boolean;
  newHeroForm: NewHeroForm;
  raceQuery: string;
  onSuccess: (updatedWarband: Warband, refreshedHeroes: WarbandHero[]) => void;
};

export function useWarbandSave({
  warband,
  canEdit,
  warbandForm,
  heroForms,
  removedHeroIds,
  isAddingHeroForm,
  newHeroForm,
  raceQuery,
  onSuccess,
}: UseWarbandSaveParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

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

    const currentHeroErrors = heroForms.map((hero) => validateHeroForm(hero));
    const hasHeroErrors = currentHeroErrors.some(Boolean);
    if (hasHeroErrors) {
      setHasAttemptedSave(true);
      setSaveError("Fix hero details before saving.");
      return;
    }
    setHasAttemptedSave(false);

    setIsSaving(true);
    setSaveError("");

    try {
      const updatedWarband = await updateWarband(warband.id, {
        name: trimmedName,
        faction: trimmedFaction,
      });

      const createPromises = heroForms
        .filter((hero) => !hero.id)
        .map((hero) =>
          createWarbandHero(warband.id, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            deeds: hero.deeds.trim() || null,
            armour_save: hero.armour_save.trim() || null,
            large: hero.large,
            caster: hero.caster,
            half_rate: hero.half_rate,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
            special_ids: hero.specials.map((entry) => entry.id),
            spell_ids: hero.spells.map((spell) => spell.id),
          })
        );

      const updatePromises = heroForms
        .filter((hero) => hero.id)
        .map((hero) =>
          updateWarbandHero(warband.id, hero.id as number, {
            name: hero.name.trim() || null,
            unit_type: hero.unit_type.trim() || null,
            race: hero.race_id ?? null,
            price: toNullableNumber(hero.price) ?? 0,
            xp: toNullableNumber(hero.xp) ?? 0,
            deeds: hero.deeds.trim() || null,
            armour_save: hero.armour_save.trim() || null,
            large: hero.large,
            caster: hero.caster,
            half_rate: hero.half_rate,
            ...buildStatPayload(hero),
            item_ids: hero.items.map((item) => item.id),
            skill_ids: hero.skills.map((skill) => skill.id),
            special_ids: hero.specials.map((entry) => entry.id),
            spell_ids: hero.spells.map((spell) => spell.id),
          })
        );

      const deletePromises = removedHeroIds.map((heroId) =>
        deleteWarbandHero(warband.id, heroId)
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);

      const refreshed = await listWarbandHeroes(warband.id);
      onSuccess(updatedWarband, refreshed);
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
