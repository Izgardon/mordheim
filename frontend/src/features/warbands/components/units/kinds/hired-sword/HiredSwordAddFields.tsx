import { useMemo } from "react";

import UnitLoadout from "../../../shared/forms/UnitLoadout";
import HiredSwordPresetPicker from "./HiredSwordPresetPicker";
import {
  AddNumberField,
  AddRaceField,
  AddTextField,
  type AddFieldsProps,
} from "../../forms/AddFormFields";

import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { HiredSwordFormEntry } from "../../../../types/warband-types";
import type { NewHiredSwordForm } from "../../../../utils/warband-utils";

type HiredSwordAddFieldsProps = AddFieldsProps<NewHiredSwordForm> & {
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  canAddCustom: boolean;
  onAddFromPreset: (profileId: number) => Promise<void>;
};

const inputClassName =
  "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";

/** Add hired sword: presets, name, type, race, hire, upkeep, rating and a starting loadout. */
export default function HiredSwordAddFields(props: HiredSwordAddFieldsProps) {
  const { campaignId, form, setForm, setError } = props;
  const setText = (field: "name" | "unit_type") => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };
  const setNumber = (field: "price" | "upkeep_price" | "rating") => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // The loadout editor works on a full form entry; only its loadout and traits flow back.
  const draftEntry = useMemo<HiredSwordFormEntry>(
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
    updater: (entry: HiredSwordFormEntry) => HiredSwordFormEntry
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
      <HiredSwordPresetPicker campaignId={campaignId} onAddFromPreset={props.onAddFromPreset} />

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
        unitType="hiredswords"
        deferItemCommit
        reservedGold={0}
        onUpdate={handleLoadoutUpdate}
        onSkillCreated={handleSkillCreated}
      />
    </>
  );
}
