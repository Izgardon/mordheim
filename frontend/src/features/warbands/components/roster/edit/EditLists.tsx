import type { ReactNode } from "react";

import { ChipLabel } from "@/components/ui/chip";
import { ItemKindIcon, type GameIconName } from "@/components/ui/game-icons";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import {
  skillOptions,
  specialOption,
  spellOption,
  warnedLast,
} from "@/features/catalogue/search-options";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import { itemKind } from "@/features/items/item-kind";
import { inPlayOnly } from "@/features/reference/in-play";
import { unitGroups, useSkillGroups } from "@/features/skills/skill-groups";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { HeroCaster } from "../../../types/warband-types";
import { buildAvailableSkillsPayload } from "../../../utils/warband-utils";
import { boonBaneOptions } from "../boon-bane-options";
import UnitSectionLabel from "../UnitSectionLabel";
import { isInjury, type RosterUnit } from "../unit-view";
import EditPickList from "./EditPickList";
import type { Named, UnitEditDraft } from "./useUnitEditDraft";

const heading = (label: string, icon: GameIconName) => (
  <UnitSectionLabel icon={icon}>{label}</UnitSectionLabel>
);

/**
 * The edit form's lists as a 2 × 2 grid (William): Items, Skills, Boons & Banes, then Spells for a
 * caster (or one who has some) and Injuries when he has any. One column on a phone.
 */
export default function EditLists({
  entry,
  campaignId,
  warbandId,
  form,
  onAddItem,
}: {
  entry: RosterUnit;
  campaignId: number;
  warbandId: number;
  form: UnitEditDraft;
  /** Add item: opens the unit's loadout. */
  onAddItem: () => void;
}) {
  const { kind, unit } = entry;
  const { draft, set, lists, setLists } = form;
  const skills = useCatalogue("skills", campaignId).data ?? [];
  const specials = useCatalogue("specials", campaignId).data ?? [];
  const spells = useCatalogue("spells", campaignId).data ?? [];
  const settings = useSettingsById();
  const warbandSkills = useWhoCan(campaignId, warbandId).specialSkillIds;
  const groups = useSkillGroups(campaignId);
  const access = draft.available_skills as Record<string, boolean> | undefined;
  const skillContext = {
    settings,
    groups,
    large: Boolean(draft.large),
    access: access ? unitGroups(groups, buildAvailableSkillsPayload(access)) : [],
    specials: warbandSkills,
  };
  // only the campaign's skills are offered; one he has from outside it still shows as his
  const skillRows = skillOptions(inPlayOnly(skills), skillContext);
  const heldSkills = skillOptions(skills, skillContext);
  const spellRows = warnedLast(spells.map((spell) => spellOption(spell, settings)));
  // a hired sword's or dramatis persona's own rule isn't offered; one he has keeps its chip
  const heldSpecials = specials.map((special) => specialOption(special, settings));
  const rules = lists.specials.filter((special) => !isInjury(special));
  const injuries = lists.specials.filter(isInjury);
  // a new pick keeps its type, which says whether it is an injury
  const typed = (entry: Named) =>
    entry.type === undefined
      ? { ...entry, type: specials.find((s) => s.id === entry.id)?.type }
      : entry;
  const setSpecials = (next: Named[], injured: boolean) =>
    setLists((c) => ({
      ...c,
      specials: [
        ...c.specials.filter((special) => isInjury(special) !== injured),
        ...next.map(typed),
      ],
    }));
  const caster = "caster" in draft ? (String(draft.caster) as HeroCaster) : "No";
  const showSpells = kind !== "henchmen_group" && (caster !== "No" || lists.spells.length > 0);

  // the picks an advance left for later on a list (heroes and hired swords), one fewer with ×
  const picks = (key: string) =>
    key in draft
      ? { pending: Number(draft[key]) || 0, onPendingChange: (next: number) => set(key, next) }
      : {};

  const items: ReactNode = (
    <div className="flex flex-col gap-1.5">
      {heading(kind === "henchmen_group" ? "Items · each" : "Items", "items")}
      <div className="flex flex-wrap items-center gap-1.5">
        {unit.items.map((item, index) => (
          <ChipLabel
            key={`${item.id}-${index}`}
            className="min-h-[34px] max-w-[200px] text-[13px] text-ink"
          >
            <ItemKindIcon kind={itemKind(item)} className="shrink-0 text-accent-text" />
            <span title={item.name} className="truncate">
              {item.name}
            </span>
          </ChipLabel>
        ))}
        <button
          type="button"
          onClick={onAddItem}
          className="min-h-[34px] border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text"
        >
          Add item
        </button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-3.5 min-[720px]:grid-cols-2">
      {items}
      <EditPickList
        title={heading("Skills", "skills")}
        noun="skill"
        entries={lists.skills}
        options={skillRows}
        known={heldSkills}
        onChange={(next) => setLists((c) => ({ ...c, skills: next }))}
        {...picks("pending_skills")}
      />
      <EditPickList
        title={heading("Boons & Banes", "specials")}
        noun="boon or bane"
        plural="boons and banes"
        entries={rules}
        options={boonBaneOptions(specials, settings)}
        known={heldSpecials}
        onChange={(next) => setSpecials(next, false)}
        {...picks("pending_specials")}
      />
      {showSpells ? (
        <EditPickList
          title={heading("Spells", "spells")}
          noun="spell"
          entries={lists.spells}
          options={spellRows}
          onChange={(next) => setLists((c) => ({ ...c, spells: next }))}
          {...picks("pending_spells")}
        />
      ) : null}
      {injuries.length ? (
        <EditPickList
          title={heading("Injuries", "injuries")}
          noun="injury"
          plural="injuries"
          entries={injuries}
          options={boonBaneOptions(specials, settings, true)}
          known={heldSpecials}
          onChange={(next) => setSpecials(next, true)}
        />
      ) : null}
    </div>
  );
}
