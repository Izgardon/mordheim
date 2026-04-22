import { useCallback, useMemo, useState } from "react";

import type { Race } from "@/features/races/types/race-types";
import type { HiredSwordFormEntry } from "@/features/warbands/types/warband-types";
import {
  skillFields,
  statFields,
  type NewHiredSwordForm,
} from "@/features/warbands/utils/warband-utils";

type UseHiredSwordCreationFormParams = {
  hiredSwordLimitCount: number;
  maxHiredSwords: number;
  availableRaces: Race[];
  appendHiredSwordForm: (entry: HiredSwordFormEntry) => Promise<void> | void;
};

const initialHiredSwordForm: NewHiredSwordForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
  price: "0",
  upkeep_price: "0",
  rating: "0",
  xp: "0",
  armour_save: "",
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
};

export function useHiredSwordCreationForm({
  hiredSwordLimitCount,
  maxHiredSwords,
  availableRaces,
  appendHiredSwordForm,
}: UseHiredSwordCreationFormParams) {
  const [newHiredSwordForm, setNewHiredSwordForm] = useState<NewHiredSwordForm>(initialHiredSwordForm);
  const [isAddingHiredSwordForm, setIsAddingHiredSwordForm] = useState(false);
  const [isCreatingHiredSword, setIsCreatingHiredSword] = useState(false);
  const [newHiredSwordError, setNewHiredSwordError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  const isHiredSwordLimitReached =
    !newHiredSwordForm.blood_pacted && hiredSwordLimitCount >= maxHiredSwords;

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

  const handleAddHiredSword = useCallback(async () => {
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

    setIsCreatingHiredSword(true);
    setNewHiredSwordError("");

    try {
      await appendHiredSwordForm({
        name,
        unit_type: unitType,
        race_id: newHiredSwordForm.race_id,
        race_name: newHiredSwordForm.race_name,
        stats: newHiredSwordForm.stats,
        xp: newHiredSwordForm.xp.trim() || "0",
        price: newHiredSwordForm.price.trim() || "0",
        upkeep_price: newHiredSwordForm.upkeep_price.trim() || "0",
        rating: newHiredSwordForm.rating.trim() || "0",
        armour_save: newHiredSwordForm.armour_save,
        deeds: "",
        caster: newHiredSwordForm.caster,
        large: newHiredSwordForm.large,
        half_rate: newHiredSwordForm.half_rate,
        blood_pacted: newHiredSwordForm.blood_pacted,
        no_level_ups: false,
        available_skills: newHiredSwordForm.available_skills,
        items: newHiredSwordForm.items,
        skills: newHiredSwordForm.skills,
        spells: newHiredSwordForm.spells,
        specials: newHiredSwordForm.specials,
      });

      setNewHiredSwordForm(initialHiredSwordForm);
      setRaceQuery("");
      setNewHiredSwordError("");
      setIsAddingHiredSwordForm(false);
    } catch (err) {
      setNewHiredSwordError(err instanceof Error ? err.message || "Failed to create hired sword." : "Failed to create hired sword.");
    } finally {
      setIsCreatingHiredSword(false);
    }
  }, [appendHiredSwordForm, isHiredSwordLimitReached, newHiredSwordForm]);

  return {
    newHiredSwordForm,
    setNewHiredSwordForm,
    isAddingHiredSwordForm,
    setIsAddingHiredSwordForm,
    isCreatingHiredSword,
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
