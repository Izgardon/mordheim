import { useCallback, useMemo, useState } from "react";

import type { Race } from "@/features/races/types/race-types";
import type { HiredSwordFormEntry } from "@/features/warbands/types/warband-types";
import {
  skillFields,
  statFields,
  type NewHiredSwordForm,
} from "@/features/warbands/utils/warband-utils";

type UseHiredSwordCreationFormParams = {
  hiredSwordFormsCount: number;
  maxHiredSwords: number;
  availableRaces: Race[];
  appendHiredSwordForm: (entry: HiredSwordFormEntry) => void;
};

const initialHiredSwordForm: NewHiredSwordForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  price: "0",
  upkeep_price: "0",
  rating: "0",
  xp: "0",
};

export function useHiredSwordCreationForm({
  hiredSwordFormsCount,
  maxHiredSwords,
  availableRaces,
  appendHiredSwordForm,
}: UseHiredSwordCreationFormParams) {
  const [newHiredSwordForm, setNewHiredSwordForm] = useState<NewHiredSwordForm>(initialHiredSwordForm);
  const [isAddingHiredSwordForm, setIsAddingHiredSwordForm] = useState(false);
  const [newHiredSwordError, setNewHiredSwordError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  const isHiredSwordLimitReached = hiredSwordFormsCount >= maxHiredSwords;

  const matchingRaces = useMemo(() => {
    const query = raceQuery.trim().toLowerCase();
    const base = availableRaces.filter((race) => race.id !== newHiredSwordForm.race_id);
    if (!query) {
      return base;
    }
    return base.filter((race) => race.name.toLowerCase().includes(query));
  }, [availableRaces, newHiredSwordForm.race_id, raceQuery]);

  const resetHiredSwordCreationForm = useCallback(() => {
    setNewHiredSwordForm(initialHiredSwordForm);
    setIsAddingHiredSwordForm(false);
    setNewHiredSwordError("");
    setRaceQuery("");
  }, []);

  const handleAddHiredSword = useCallback(() => {
    if (isHiredSwordLimitReached) {
      setNewHiredSwordError("Hired sword limit reached.");
      return;
    }

    const name = newHiredSwordForm.name.trim();
    const unitType = newHiredSwordForm.unit_type.trim();
    if (!name || !unitType || !newHiredSwordForm.race_id) {
      setNewHiredSwordError("Name, type, and race are required.");
      return;
    }

    appendHiredSwordForm({
      name,
      unit_type: unitType,
      race_id: newHiredSwordForm.race_id,
      race_name: newHiredSwordForm.race_name,
      stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
      xp: newHiredSwordForm.xp.trim() || "0",
      price: newHiredSwordForm.price.trim() || "0",
      upkeep_price: newHiredSwordForm.upkeep_price.trim() || "0",
      rating: newHiredSwordForm.rating.trim() || "0",
      armour_save: "",
      deeds: "",
      large: false,
      caster: "No",
      half_rate: false,
      blood_pacted: false,
      available_skills: skillFields.reduce(
        (acc, field) => ({ ...acc, [field.key]: false }),
        {}
      ),
      items: [],
      skills: [],
      spells: [],
      specials: [],
    });

    setNewHiredSwordForm(initialHiredSwordForm);
    setRaceQuery("");
    setNewHiredSwordError("");
    setIsAddingHiredSwordForm(false);
  }, [appendHiredSwordForm, isHiredSwordLimitReached, newHiredSwordForm]);

  return {
    newHiredSwordForm,
    setNewHiredSwordForm,
    isAddingHiredSwordForm,
    setIsAddingHiredSwordForm,
    newHiredSwordError,
    setNewHiredSwordError,
    raceQuery,
    setRaceQuery,
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    isHiredSwordLimitReached,
    handleAddHiredSword,
    resetHiredSwordCreationForm,
  };
}
