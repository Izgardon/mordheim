import type { Dispatch, SetStateAction } from "react";

import { Input } from "@components/input";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import RacePicker from "./RacePicker";

import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { UnitKindKey, UnitNewForm } from "../../../types/units";

/** What every kind's AddFields slot receives from the add form. */
export type AddFieldsProps<F> = {
  campaignId: number;
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
  setError: (value: string) => void;
  raceQuery: string;
  setRaceQuery: (value: string) => void;
  races: Race[];
  onRaceCreated: (race: Race) => void;
};

/** The add form's catalogue (hired swords pick a starting loadout). */
export type AddFieldsCatalogue = {
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  canAddCustom: boolean;
};

export type AddFieldsSlotProps<K extends UnitKindKey> = AddFieldsProps<UnitNewForm<K>> &
  AddFieldsCatalogue;

const labelClassName = "text-sm font-semibold text-foreground";

type FieldProps = {
  className: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function AddTextField({ className, label, value, onChange, placeholder }: FieldProps) {
  return (
    <div className={className}>
      <Label className={labelClassName}>{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function AddNumberField({
  className,
  label,
  value,
  onChange,
  placeholder,
  min = 0,
}: FieldProps & { min?: number }) {
  return (
    <div className={className}>
      <Label className={labelClassName}>{label}</Label>
      <NumberInput
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

type RaceForm = { race_id: number | null; race_name: string };

/** The add form's race search; picking, typing or creating a race clears the form error. */
export function AddRaceField<F extends RaceForm>({
  className,
  campaignId,
  form,
  setForm,
  setError,
  raceQuery,
  setRaceQuery,
  races,
  onRaceCreated,
}: AddFieldsProps<F> & { className: string }) {
  const setRace = (race_id: number | null, race_name: string) =>
    setForm((prev) => ({ ...prev, race_id, race_name }));
  return (
    <div className={className}>
      <Label className={labelClassName}>Race</Label>
      <RacePicker
        variant="add"
        campaignId={campaignId}
        races={races}
        selectedRaceId={form.race_id}
        query={raceQuery}
        setQuery={setRaceQuery}
        onType={() => {
          setRace(null, "");
          setError("");
        }}
        onSelect={(race) => {
          setRace(race.id, race.name);
          setError("");
        }}
        onCreated={(race) => {
          onRaceCreated(race);
          setRace(race.id, race.name);
          setError("");
        }}
      />
    </div>
  );
}
