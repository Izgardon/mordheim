import { useCallback, useMemo, useState } from "react";

import type { Race } from "../../races/types/race-types";
import type { HenchmenGroupFormEntry } from "../types/warband-types";
import { statFields } from "../utils/warband-utils";

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
  groupFormsCount: number;
  availableRaces: Race[];
  appendGroupForm: (group: HenchmenGroupFormEntry) => void;
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
  groupFormsCount,
  availableRaces,
  appendGroupForm,
}: UseHenchmenGroupCreationFormParams) {
  const [newGroupForm, setNewGroupForm] = useState<NewHenchmenGroupForm>(initialForm);
  const [isAddingGroupForm, setIsAddingGroupForm] = useState(false);
  const [newGroupError, setNewGroupError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  const matchingRaces = useMemo(() => {
    const query = raceQuery.trim().toLowerCase();
    const base = availableRaces.filter((race) => race.id !== newGroupForm.race_id);
    if (!query) {
      return base;
    }
    return base.filter((race) => race.name.toLowerCase().includes(query));
  }, [availableRaces, newGroupForm.race_id, raceQuery]);

  const resetGroupCreationForm = useCallback(() => {
    setNewGroupForm(initialForm);
    setIsAddingGroupForm(false);
    setNewGroupError("");
    setRaceQuery("");
  }, []);

  const handleAddGroup = useCallback(() => {
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

    appendGroupForm({
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
      items: [],
      skills: [],
      specials: [],
      henchmen: [{ id: 0, name: henchmanName, kills: 0, dead: false }],
    });

    setNewGroupForm(initialForm);
    setRaceQuery("");
    setNewGroupError("");
    setIsAddingGroupForm(false);
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
    isRaceDialogOpen,
    setIsRaceDialogOpen,
    matchingRaces,
    handleAddGroup,
    resetGroupCreationForm,
  };
}
