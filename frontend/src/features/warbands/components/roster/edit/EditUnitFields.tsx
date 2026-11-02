import { Chip, ChipLabel } from "@/components/ui/chip";
import { ItemKindIcon, type GameIconName } from "@/components/ui/game-icons";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import {
  skillOptions,
  specialOption,
  spellOption,
  warnedLast,
} from "@/features/catalogue/search-options";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import { itemKind } from "@/features/items/item-kind";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { HeroCaster } from "../../../types/warband-types";
import { buildAvailableSkillsPayload } from "../../../utils/warband-utils";
import UnitSectionLabel from "../UnitSectionLabel";
import { isGroup, unitName, type RosterUnit } from "../unit-view";
import EditGroupModels from "./EditGroupModels";
import EditPickList from "./EditPickList";
import EditProfileRow from "./EditProfileRow";
import RaceField from "./RaceField";
import SkillAccessField from "./SkillAccessField";
import type { UnitEditDraft } from "./useUnitEditDraft";

const CASTERS: [HeroCaster, string][] = [
  ["No", "None"],
  ["Wizard", "Wizard"],
  ["Priest", "Priest"],
];

/**
 * The edit form's fields (design E, compact), shared by the web's inline form and the phone's
 * sheet: the traits as plain toggles on the top row, then name, type, race and cost, experience
 * and the profile, skill access, the lists (spells only for a Wizard or Priest, or one who has
 * some) and the items.
 */
export default function EditUnitFields({
  entry,
  campaignId,
  warbandId,
  form,
  canCreateRace,
  onAddItem,
}: {
  entry: RosterUnit;
  campaignId: number;
  warbandId: number;
  form: UnitEditDraft;
  canCreateRace: boolean;
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
  const access = draft.available_skills as Record<string, boolean> | undefined;
  const skillRows = skillOptions(skills, {
    settings,
    large: Boolean(draft.large),
    access: access ? buildAvailableSkillsPayload(access) : [],
    specials: warbandSkills,
  });
  const spellRows = warnedLast(spells.map((spell) => spellOption(spell, settings)));
  const specialRows = warnedLast(specials.map((special) => specialOption(special, settings)));
  const heading = (label: string, icon: GameIconName) => (
    <UnitSectionLabel icon={icon}>{label}</UnitSectionLabel>
  );
  const caster = "caster" in draft ? (String(draft.caster) as HeroCaster) : "No";
  const showSpells = kind !== "henchmen_group" && (caster !== "No" || lists.spells.length > 0);

  // the picks an advance left for later on a list (heroes and hired swords), one fewer with ×
  const picks = (key: string) =>
    key in draft
      ? { pending: Number(draft[key]) || 0, onPendingChange: (next: number) => set(key, next) }
      : {};
  const field = (label: string, key: string, numeric = false) => {
    const Field = numeric ? NumberInput : Input;
    return (
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
        {label}
        <Field
          inputSize="sm"
          {...(numeric ? { min: 0 } : {})}
          value={String(draft[key] ?? "")}
          onChange={(event) => set(key, event.target.value)}
        />
      </label>
    );
  };
  const toggle = (label: string, key: string) =>
    key in draft ? (
      <Switch
        key={key}
        look="plain"
        checked={Boolean(draft[key])}
        onCheckedChange={(on) => set(key, on)}
      >
        {label}
      </Switch>
    ) : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {toggle("Leader", "is_leader")}
        {toggle("Large", "large")}
        {toggle("Trading action", "trading_action")}
        {toggle("No level ups", "no_level_ups")}
        {toggle("Bloodpacted", "blood_pacted")}
        {"caster" in draft ? (
          <span
            role="group"
            aria-label="Caster"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-text2"
          >
            Caster
            {CASTERS.map(([value, label]) => (
              <Chip
                key={value}
                pressed={caster === value}
                className="min-h-7 px-2 text-xs"
                onClick={() => set("caster", value)}
              >
                {label}
              </Chip>
            ))}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-[1fr_1fr_1.3fr_0.7fr]">
        {field("Name", "name")}
        {field("Type", "unit_type")}
        <RaceField
          campaignId={campaignId}
          value={(draft.race as number | null) ?? null}
          canCreate={canCreateRace}
          onChange={(raceId) => set("race", raceId)}
        />
        {field(kind === "hireling" ? "Hire fee (gc)" : "Cost (gc)", "price", true)}
      </div>
      <EditProfileRow form={form} unitLabel={unitName(unit)} />
      {"available_skills" in draft ? (
        <SkillAccessField
          campaignId={campaignId}
          value={draft.available_skills as Record<string, boolean>}
          onChange={(next) => set("available_skills", next)}
        />
      ) : null}
      <div className="grid gap-3.5 min-[720px]:grid-cols-2">
        <EditPickList
          title={heading("Skills", "skills")}
          noun="skill"
          entries={lists.skills}
          options={skillRows}
          onChange={(next) => setLists((c) => ({ ...c, skills: next }))}
          {...picks("pending_skills")}
        />
        <EditPickList
          title={heading("Specials", "specials")}
          noun="special"
          entries={lists.specials}
          options={specialRows}
          onChange={(next) => setLists((c) => ({ ...c, specials: next }))}
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
      </div>
      <div className="flex flex-col gap-1.5">
        {heading(kind === "henchmen_group" ? "Items · each" : "Items", "items")}
        <div className="flex flex-wrap items-center gap-1.5">
          {unit.items.map((item, index) => (
            <ChipLabel key={`${item.id}-${index}`} className="min-h-[34px] text-[13px] text-ink">
              <ItemKindIcon kind={itemKind(item)} className="text-accent-text" />
              {item.name}
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
      {isGroup(entry) ? (
        <EditGroupModels group={entry.unit} form={form} unitType={String(draft.unit_type ?? "")} />
      ) : null}
    </div>
  );
}
