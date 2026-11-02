import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SearchCombobox } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { specialOption, warnedLast } from "@/features/catalogue/search-options";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { AdvancePick } from "../../units/unit-api";
import SkillPicker from "./advance/SkillPicker";
import SpellPicker, { type SpellChoice } from "./advance/SpellPicker";
import type { PendingList, RosterUnit } from "./unit-view";

const NOUN = { skills: "skill", spells: "spell", specials: "boon or bane" } as const;

/** The pick a spell choice makes: rolled on a lore, or picked by hand. */
const spellPick = (choice: SpellChoice): AdvancePick =>
  choice.mode === "roll"
    ? { list: "spells", lore: choice.lore, roll: choice.roll }
    : { list: "spells", id: choice.spell.id };

/**
 * A pick an advance left for later ("Skill to choose"), made from the card with the advance's
 * guided pickers: a skill from his lists (the rest behind "Show all", with a warning), a spell
 * rolled on one of his lores (one he knows gets 1 easier) or picked by hand, a boon or bane from
 * the search. The line above Confirm says only what this pick gives. The server makes the pick
 * (`pick/`).
 */
export default function PendingPick({
  campaignId,
  warbandId,
  list,
  entry,
  onPick,
  onClose,
}: {
  campaignId: number;
  warbandId: number;
  list: PendingList;
  entry: RosterUnit;
  onPick: (pick: AdvancePick) => void;
  onClose: () => void;
}) {
  const { unit } = entry;
  const specials = useCatalogue("specials", campaignId, { enabled: list === "specials" }).data;
  const settings = useSettingsById();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [spell, setSpell] = useState<SpellChoice | null>(null);
  const pick =
    list === "skills" && skill
      ? ({ list, id: skill.id } as const)
      : list === "spells" && spell
        ? spellPick(spell)
        : null;

  return (
    <div className="flex flex-col gap-2.5 border border-accent-line bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-semibold text-head">
          Pick a new {NOUN[list]}
        </span>
        <IconButton aria-label="Close" className="h-9 w-9" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {list === "skills" ? (
        <SkillPicker
          campaignId={campaignId}
          warbandId={warbandId}
          access={"available_skills" in unit ? unit.available_skills : undefined}
          large={unit.large}
          value={skill}
          onChange={setSkill}
        />
      ) : list === "spells" ? (
        <SpellPicker
          campaignId={campaignId}
          known={("spells" in unit ? (unit.spells ?? []) : []) as Spell[]}
          value={spell}
          onChange={setSpell}
        />
      ) : (
        <SearchCombobox
          inline
          autoFocus
          label="Search boons and banes"
          placeholder="Search boons and banes"
          emptyText="No boon or bane matches."
          options={warnedLast((specials ?? []).map((special) => specialOption(special, settings)))}
          onPick={(option) => onPick({ list: "specials", id: Number(option.id) })}
          onDismiss={onClose}
        />
      )}
      {list === "specials" ? null : (
        <div className="flex flex-wrap items-center gap-2">
          {list === "spells" && spell ? (
            <span className="text-sm font-semibold text-head">
              {spell.known
                ? `${spell.spell.name} gets easier: Difficulty ${spell.difficulty}`
                : `New spell: ${spell.spell.name}`}
            </span>
          ) : null}
          <Button className="ml-auto" disabled={!pick} onClick={() => pick && onPick(pick)}>
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
}
