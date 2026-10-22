import { useMemo } from "react";

import { getHiredSwordProfile } from "@/features/bestiary/api/bestiary-api";
import UnitLoadout from "../../../shared/forms/UnitLoadout";
import HirelingPresetPicker from "./HirelingPresetPicker";
import { TraitToggle } from "../../forms/UnitSkillsTraitsPanel";
import { presetToNewHirelingForm } from "./hireling-preset";
import {
  AddNumberField,
  AddRaceField,
  AddTextField,
  type AddFieldsSlotProps,
} from "../../forms/AddFormFields";

import type { Skill } from "@/features/skills/types/skill-types";
import type { HirelingFormEntry } from "../../../../types/warband-types";

const inputClassName =
  "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";

/** Add hired sword: presets, name, type, race, costs, rating, blood pact and a starting loadout. */
export default function HirelingAddFields(props: AddFieldsSlotProps<"hireling">) {
  const { campaignId, form, setForm, setError, setRaceQuery } = props;
  const setText = (field: "name" | "unit_type") => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };
  const setNumber = (field: "price" | "upkeep_price" | "rating") => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // The loadout editor works on a full form entry; only its loadout and traits flow back.
  const draftEntry = useMemo<HirelingFormEntry>(
    () => ({
      ...form,
      deeds: "",
      is_leader: false,
      trading_action: false,
      no_level_ups: false,
    }),
    [form]
  );

  const handleLoadoutUpdate = (
    _index: number,
    updater: (entry: HirelingFormEntry) => HirelingFormEntry
  ) => {
    setForm((current) => {
      const updated = updater({ ...draftEntry, ...current });
      return {
        ...current,
        items: updated.items,
        skills: updated.skills,
        spells: updated.spells,
        specials: updated.specials,
        caster: updated.caster,
        large: updated.large,
      };
    });
  };

  const handleSkillCreated = (_index: number, skill: Skill) => {
    setForm((current) => {
      if (current.skills.some((entry) => entry.id === skill.id)) {
        return current;
      }
      return { ...current, skills: [...current.skills, skill] };
    });
  };

  return (
    <>
      <HirelingPresetPicker
        campaignId={campaignId}
        onAddFromPreset={async (profileId) => {
          const preset = presetToNewHirelingForm(
            await getHiredSwordProfile(profileId),
            props.races
          );
          setForm(preset.form);
          setRaceQuery(preset.raceQuery);
          setError("");
        }}
      />

      <div className="flex flex-wrap gap-3">
        <AddTextField
          className="min-w-[180px] flex-1 space-y-2"
          label="Name"
          value={form.name}
          onChange={setText("name")}
          placeholder="Hired sword name"
        />
        <AddTextField
          className="min-w-[160px] flex-1 space-y-2"
          label="Type"
          value={form.unit_type}
          onChange={setText("unit_type")}
          placeholder="Hired Sword"
        />
        <AddRaceField {...props} className="min-w-[200px] flex-[1.2] space-y-2" />
        <AddNumberField
          className="min-w-[140px] flex-1 space-y-2"
          label="Hire price"
          value={form.price}
          onChange={setNumber("price")}
          placeholder="0"
        />
        <AddNumberField
          className="min-w-[140px] flex-1 space-y-2"
          label="Upkeep price"
          value={form.upkeep_price}
          onChange={setNumber("upkeep_price")}
          placeholder="0"
        />
        <AddNumberField
          className="min-w-[140px] flex-1 space-y-2"
          label="Rating"
          value={form.rating}
          onChange={setNumber("rating")}
          placeholder="0"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TraitToggle
          checked={form.blood_pacted}
          onChange={(checked) => {
            setForm((prev) => ({ ...prev, blood_pacted: checked }));
            setError("");
          }}
          label="Bloodpacted"
        />
        <p className="text-xs text-muted-foreground">
          Blood-pacted hired swords don&apos;t count towards the hired-sword limit.
        </p>
      </div>
      <UnitLoadout
        unit={draftEntry}
        index={0}
        campaignId={campaignId}
        availableItems={props.availableItems}
        availableSkills={props.availableSkills}
        availableSpells={props.availableSpells}
        availableSpecials={props.availableSpecials}
        inputClassName={inputClassName}
        canAddCustom={props.canAddCustom}
        unitType="hirelings"
        deferItemCommit
        reservedGold={0}
        onUpdate={handleLoadoutUpdate}
        onSkillCreated={handleSkillCreated}
      />
    </>
  );
}
