import { useCallback, useMemo, useState } from "react";

import type { Race } from "../../races/types/race-types";
import type { HeroFormEntry } from "../types/warband-types";
import { skillFields, statFields, type NewHeroForm } from "../utils/warband-utils";

type UseHeroCreationFormParams = {
  heroFormsCount: number;
  maxHeroes: number;
  availableRaces: Race[];
  appendHeroForm: (hero: HeroFormEntry) => void;
};

const initialHeroForm: NewHeroForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  price: "0",
  xp: "0",
};

export function useHeroCreationForm({
  heroFormsCount,
  maxHeroes,
  availableRaces,
  appendHeroForm,
}: UseHeroCreationFormParams) {
  const [newHeroForm, setNewHeroForm] = useState<NewHeroForm>(initialHeroForm);
  const [isAddingHeroForm, setIsAddingHeroForm] = useState(false);
  const [newHeroError, setNewHeroError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  const isHeroLimitReached = heroFormsCount >= maxHeroes;

  const matchingRaces = useMemo(() => {
    const query = raceQuery.trim().toLowerCase();
    const base = availableRaces.filter((race) => race.id !== newHeroForm.race_id);
    if (!query) {
      return base;
    }
    return base.filter((race) => race.name.toLowerCase().includes(query));
  }, [availableRaces, newHeroForm.race_id, raceQuery]);

  const resetHeroCreationForm = useCallback(() => {
    setNewHeroForm(initialHeroForm);
    setIsAddingHeroForm(false);
    setNewHeroError("");
    setRaceQuery("");
  }, []);

  const handleAddHero = useCallback(() => {
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

    appendHeroForm({
      name,
      unit_type: unitType,
      race_id: newHeroForm.race_id,
      race_name: newHeroForm.race_name,
      stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
      xp: newHeroForm.xp.trim() || "0",
      price: newHeroForm.price.trim() || "0",
      armour_save: "",
      deeds: "",
      large: false,
      caster: "No",
      half_rate: false,
      available_skills: skillFields.reduce(
        (acc, field) => ({ ...acc, [field.key]: false }),
        {}
      ),
      items: [],
      skills: [],
      spells: [],
      specials: [],
    });

    setNewHeroForm(initialHeroForm);
    setRaceQuery("");
    setNewHeroError("");
    setIsAddingHeroForm(false);
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
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    isHeroLimitReached,
    handleAddHero,
    resetHeroCreationForm,
  };
}

