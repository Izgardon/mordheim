import { useCallback, useState } from "react";

import type { UnitForm, UnitKindKey, UnitNewForm } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

type UseUnitCreationFormOptions<K extends UnitKindKey> = {
  /** The kind's cap is reached for this add form ("Hero limit reached."). */
  isCreateBlocked: (newForm: UnitNewForm<K>) => boolean;
  /** Queues the new unit's form; it is recruited and charged on Save (decision 1). */
  appendForm: (form: UnitForm<K>) => void;
};

/** The "Add <unit>" form: its fields, race search text, error and the add-to-queue action. */
export function useUnitCreationForm<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  { isCreateBlocked, appendForm }: UseUnitCreationFormOptions<K>
) {
  const { creation } = kind.editor;
  const [newForm, setNewForm] = useState<UnitNewForm<K>>(creation.initialForm);
  const [isAdding, setIsAdding] = useState(false);
  const [newError, setNewError] = useState("");
  const [raceQuery, setRaceQuery] = useState("");

  const resetCreationForm = useCallback(() => {
    setNewForm(creation.initialForm);
    setIsAdding(false);
    setNewError("");
    setRaceQuery("");
  }, [creation]);

  const handleAdd = useCallback(() => {
    if (isCreateBlocked(newForm)) {
      setNewError(creation.blockedError);
      return;
    }

    const name = newForm.name.trim();
    const unitType = newForm.unit_type.trim();
    if (!name || !unitType) {
      setNewError(
        creation.optionalRace ? "Name and type are required." : "Name, type, and race are required."
      );
      return;
    }
    if (!creation.optionalRace && !newForm.race_id) {
      setNewError("Name, type, and race are required.");
      return;
    }
    const extraError = creation.extraError?.(newForm);
    if (extraError) {
      setNewError(extraError);
      return;
    }

    appendForm(creation.toFormEntry(newForm, name, unitType));
    setNewForm(creation.initialForm);
    setRaceQuery("");
    setNewError("");
    setIsAdding(false);
  }, [appendForm, creation, isCreateBlocked, newForm]);

  return {
    newForm,
    setNewForm,
    isAdding,
    setIsAdding,
    newError,
    setNewError,
    raceQuery,
    setRaceQuery,
    handleAdd,
    resetCreationForm,
  };
}
