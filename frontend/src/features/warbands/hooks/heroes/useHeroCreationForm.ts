import { useCallback, useState } from "react";

import type { HeroFormEntry } from "@/features/warbands/types/warband-types";
import { skillFields, statFields, type NewHeroForm } from "@/features/warbands/utils/warband-utils";

type UseHeroCreationFormParams = {
  heroFormsCount: number;
  maxHeroes: number;
  appendHeroForm: (hero: HeroFormEntry) => Promise<void> | void;
};

const initialHeroForm: NewHeroForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  price: "0",
  xp: "0",
  is_leader: false,
};

export function useHeroCreationForm({
  heroFormsCount,
  maxHeroes,
  appendHeroForm,
}: UseHeroCreationFormParams) {
  const [newHeroForm, setNewHeroForm] = useState<NewHeroForm>(initialHeroForm);
  const [isAddingHeroForm, setIsAddingHeroForm] = useState(false);
  const [newHeroError, setNewHeroError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");

  const isHeroLimitReached = heroFormsCount >= maxHeroes;

  const resetHeroCreationForm = useCallback(() => {
    setNewHeroForm(initialHeroForm);
    setIsAddingHeroForm(false);
    setNewHeroError("");
    setRaceQuery("");
  }, []);

  const handleAddHero = useCallback(async () => {
    if (isHeroLimitReached) {
      setNewHeroError("Hero limit reached.");
      return;
    }

    const name = newHeroForm.name.trim();
    const unitType = newHeroForm.unit_type.trim();
    if (!name || !unitType || !newHeroForm.race_id) {
      setNewHeroError("Name, type, and race are required.");
      return;
    }

    setNewHeroError("");

    try {
      await appendHeroForm({
        name,
        unit_type: unitType,
        race_id: newHeroForm.race_id,
        race_name: newHeroForm.race_name,
        stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
        xp: newHeroForm.xp.trim() || "0",
        price: newHeroForm.price.trim() || "0",
        armour_save: "",
        deeds: "",
        is_leader: newHeroForm.is_leader,
        trading_action: true,
        large: false,
        caster: "No",
        half_rate: false,
        available_skills: skillFields.reduce((acc, field) => ({ ...acc, [field.key]: false }), {}),
        items: [],
        skills: [],
        spells: [],
        specials: [],
      });

      setNewHeroForm(initialHeroForm);
      setRaceQuery("");
      setIsAddingHeroForm(false);
    } catch (err) {
      setNewHeroError(
        err instanceof Error ? err.message || "Failed to create hero." : "Failed to create hero."
      );
    }
  }, [appendHeroForm, isHeroLimitReached, newHeroForm]);

  return {
    newHeroForm,
    setNewHeroForm,
    isAddingHeroForm,
    setIsAddingHeroForm,
    newHeroError,
    setNewHeroError,
    raceQuery,
    setRaceQuery,
    isHeroLimitReached,
    handleAddHero,
    resetHeroCreationForm,
  };
}
