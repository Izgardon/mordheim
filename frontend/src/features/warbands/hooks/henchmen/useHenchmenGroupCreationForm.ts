import { useCallback, useState } from "react";

import type { HenchmenGroupFormEntry } from "@/features/warbands/types/warband-types";
import { statFields } from "@/features/warbands/utils/warband-utils";

export type NewHenchmenGroupForm = {
  name: string;
  unit_type: string;
  race_id: number | null;
  race_name: string;
  price: string;
  xp: string;
  max_size: string;
  firstHenchmanName: string;
};

type UseHenchmenGroupCreationFormParams = {
  appendGroupForm: (group: HenchmenGroupFormEntry) => Promise<void> | void;
};

const initialForm: NewHenchmenGroupForm = {
  name: "",
  unit_type: "",
  race_id: null,
  race_name: "",
  price: "0",
  xp: "0",
  max_size: "5",
  firstHenchmanName: "",
};

export function useHenchmenGroupCreationForm({
  appendGroupForm,
}: UseHenchmenGroupCreationFormParams) {
  const [newGroupForm, setNewGroupForm] = useState<NewHenchmenGroupForm>(initialForm);
  const [isAddingGroupForm, setIsAddingGroupForm] = useState(false);
  const [newGroupError, setNewGroupError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");

  const resetGroupCreationForm = useCallback(() => {
    setNewGroupForm(initialForm);
    setIsAddingGroupForm(false);
    setNewGroupError("");
    setRaceQuery("");
  }, []);

  const handleAddGroup = useCallback(async () => {
    const name = newGroupForm.name.trim();
    const unitType = newGroupForm.unit_type.trim();
    const henchmanName = newGroupForm.firstHenchmanName.trim();
    if (!name || !unitType || !newGroupForm.race_id) {
      setNewGroupError("Name, type, and race are required.");
      return;
    }
    if (!henchmanName) {
      setNewGroupError("First henchman name is required.");
      return;
    }

    setNewGroupError("");

    try {
      await appendGroupForm({
        name,
        unit_type: unitType,
        race_id: newGroupForm.race_id,
        race_name: newGroupForm.race_name,
        stats: statFields.reduce((acc, key) => ({ ...acc, [key]: "" }), {}),
        xp: newGroupForm.xp.trim() || "0",
        max_size: newGroupForm.max_size.trim() || "5",
        price: newGroupForm.price.trim() || "0",
        armour_save: "",
        deeds: "",
        large: false,
        half_rate: false,
        no_level_ups: false,
        items: [],
        skills: [],
        specials: [],
        henchmen: [{ id: 0, name: henchmanName, kills: 0, dead: false }],
      });

      setNewGroupForm(initialForm);
      setRaceQuery("");
      setNewGroupError("");
      setIsAddingGroupForm(false);
    } catch (err) {
      setNewGroupError(
        err instanceof Error ? err.message || "Failed to create group." : "Failed to create group."
      );
    }
  }, [appendGroupForm, newGroupForm]);

  return {
    newGroupForm,
    setNewGroupForm,
    isAddingGroupForm,
    setIsAddingGroupForm,
    newGroupError,
    setNewGroupError,
    raceQuery,
    setRaceQuery,
    handleAddGroup,
    resetGroupCreationForm,
  };
}
