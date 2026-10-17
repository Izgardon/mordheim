import { useEffect, useState } from "react";

import { Input } from "@components/input";
import { Label } from "@components/label";
import RacePicker from "./RacePicker";

import type { Race } from "@/features/races/types/race-types";
import type { UnitValidationField } from "../../../units/unit-form-helpers";
import type { UnitFormBase } from "./form-types";

type UnitIdentityFieldsProps<T extends UnitFormBase> = {
  form: T;
  index: number;
  campaignId: number;
  availableRaces: Race[];
  inputClassName: string;
  onUpdate: (index: number, updater: (form: T) => T) => void;
  onRaceCreated: (race: Race) => void;
  hasFieldError: (field: UnitValidationField) => boolean;
  nameLabel: string;
  namePlaceholder: string;
  typePlaceholder: string;
  /** Heroes and hired swords keep the race profile on the form (race maxima on the stat grid). */
  keepsRaceProfile: boolean;
};

const labelClassName = (hasError: boolean) =>
  ["text-sm font-semibold text-foreground", hasError ? "text-red-500" : ""]
    .filter(Boolean)
    .join(" ");

/** Name, unit type and race on the edit cards. */
export default function UnitIdentityFields<T extends UnitFormBase>({
  form,
  index,
  campaignId,
  availableRaces,
  inputClassName,
  onUpdate,
  onRaceCreated,
  hasFieldError,
  nameLabel,
  namePlaceholder,
  typePlaceholder,
  keepsRaceProfile,
}: UnitIdentityFieldsProps<T>) {
  const [raceQuery, setRaceQuery] = useState(form.race_name ?? "");

  useEffect(() => {
    setRaceQuery(form.race_name ?? "");
  }, [form.race_name, form.race_id]);

  return (
    <div className="grid grid-cols-2 gap-3 min-[960px]:grid-cols-3">
      <div className="space-y-2">
        <Label className={labelClassName(hasFieldError("name"))}>{nameLabel}</Label>
        <Input
          value={form.name}
          onChange={(event) =>
            onUpdate(index, (current) => ({ ...current, name: event.target.value }))
          }
          placeholder={namePlaceholder}
          className={inputClassName}
        />
      </div>

      <div className="space-y-2">
        <Label className={labelClassName(hasFieldError("unit_type"))}>Unit type</Label>
        <Input
          value={form.unit_type}
          onChange={(event) =>
            onUpdate(index, (current) => ({ ...current, unit_type: event.target.value }))
          }
          placeholder={typePlaceholder}
          className={inputClassName}
        />
      </div>

      <div className="col-span-2 space-y-2 min-[960px]:col-span-1">
        <Label className={labelClassName(hasFieldError("race_id"))}>Race</Label>
        <RacePicker
          variant="edit"
          campaignId={campaignId}
          races={availableRaces}
          selectedRaceId={form.race_id}
          query={raceQuery}
          setQuery={setRaceQuery}
          inputClassName={inputClassName}
          onType={() =>
            onUpdate(index, (current) => ({
              ...current,
              race_id: null,
              race_name: "",
              ...(keepsRaceProfile ? { race: null } : {}),
            }))
          }
          onSelect={(race) =>
            onUpdate(index, (current) => ({
              ...current,
              race_id: race.id,
              race_name: race.name,
              ...(keepsRaceProfile ? { race } : {}),
            }))
          }
          onCreated={(race) => {
            onRaceCreated(race);
            onUpdate(index, (current) => ({ ...current, race_id: race.id, race_name: race.name }));
          }}
        />
      </div>
    </div>
  );
}
