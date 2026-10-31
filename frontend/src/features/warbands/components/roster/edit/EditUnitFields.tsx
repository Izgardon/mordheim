import { ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { STAT_KEYS } from "@/components/ui/stat-strip";
import { Switch } from "@/components/ui/switch";
import { largeWarning } from "@/features/skills/skill-learning";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { HeroCaster } from "../../../types/warband-types";
import { isGroup, type RosterUnit } from "../unit-view";
import EditGroupModels from "./EditGroupModels";
import EditListPicker from "./EditListPicker";
import RaceField from "./RaceField";
import SkillAccessField from "./SkillAccessField";
import { STAT_FIELDS, type UnitEditDraft } from "./useUnitEditDraft";

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** The edit form's fields (design E), shared by the web's inline form and the phone's sheet. */
export default function EditUnitFields({
  entry,
  campaignId,
  form,
  canCreateRace,
  onAddItem,
}: {
  entry: RosterUnit;
  campaignId: number;
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

  // the picks an advance left for later on a list (heroes and hired swords), one fewer with ×
  const picks = (key: string) =>
    key in draft
      ? { pending: Number(draft[key]) || 0, onPendingChange: (next: number) => set(key, next) }
      : {};
  const field = (label: string, key: string, numeric = false) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      <Input
        inputSize="sm"
        inputMode={numeric ? "numeric" : undefined}
        value={String(draft[key] ?? "")}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const toggle = (label: string, key: string) =>
    key in draft ? (
      <Switch key={key} checked={Boolean(draft[key])} onCheckedChange={(on) => set(key, on)}>
        {label}
      </Switch>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-4">
        {field("Name", "name")}
        {field("Type", "unit_type")}
        <RaceField
          campaignId={campaignId}
          value={(draft.race as number | null) ?? null}
          canCreate={canCreateRace}
          onChange={(raceId) => set("race", raceId)}
        />
        {field(kind === "hireling" ? "Hire fee (gc)" : "Cost (gc)", "price", true)}
        {field("Experience", "xp", true)}
        <div className="flex items-end pb-1">{toggle("Half-rate XP", "half_rate")}</div>
        {field("Missing games", "missing_games", true)}
        {field("Why", "missing_reason")}
      </div>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className={`${SECTION_LABEL} pb-1`}>Profile</legend>
        <div className="grid grid-cols-5 gap-1.5 min-[720px]:grid-cols-10">
          {STAT_KEYS.map((key) => (
            <label
              key={key}
              className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint"
            >
              {key}
              <Input
                inputSize="sm"
                inputMode="numeric"
                aria-label={`${key} for ${unit.name ?? unit.unit_type ?? "this unit"}`}
                className="px-1 text-center font-mono"
                value={String(draft[STAT_FIELDS[key]] ?? "")}
                onChange={(event) => set(STAT_FIELDS[key], event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>
      {"available_skills" in draft ? (
        <SkillAccessField
          campaignId={campaignId}
          value={draft.available_skills as Record<string, boolean>}
          onChange={(next) => set("available_skills", next)}
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className={SECTION_LABEL}>
          {kind === "henchmen_group" ? "Items · each" : "Items"}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {unit.items.map((item, index) => (
            <ChipLabel key={`${item.id}-${index}`} className="min-h-[34px] text-[13px] text-ink">
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
      <EditListPicker
        label="Skills"
        entries={lists.skills}
        options={skills}
        onChange={(next) => setLists((c) => ({ ...c, skills: next }))}
        {...picks("pending_skills")}
        describe={(entry) => {
          const skill = skills.find((option) => option.id === entry.id);
          const warning = skill ? largeWarning(skill, Boolean(draft.large)) : "";
          return { warning, note: skill?.learn_note ?? "" };
        }}
      />
      {kind !== "henchmen_group" ? (
        <EditListPicker
          label="Spells"
          entries={lists.spells}
          options={spells}
          onChange={(next) => setLists((c) => ({ ...c, spells: next }))}
          {...picks("pending_spells")}
        />
      ) : null}
      <EditListPicker
        label="Specials"
        entries={lists.specials}
        options={specials}
        onChange={(next) => setLists((c) => ({ ...c, specials: next }))}
        {...picks("pending_specials")}
      />
      <div className="flex flex-col gap-1.5">
        <span className={SECTION_LABEL}>Traits</span>
        <div className="flex flex-wrap items-center gap-2">
          {toggle("Leader", "is_leader")}
          {toggle("Large", "large")}
          {toggle("Trading action", "trading_action")}
          {toggle("No level ups", "no_level_ups")}
          {toggle("Bloodpacted", "blood_pacted")}
          {"caster" in draft ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              Caster
              <select
                value={String(draft.caster)}
                onChange={(event) => set("caster", event.target.value as HeroCaster)}
                className="h-9 border border-strong bg-page px-2 text-sm text-ink"
              >
                <option value="No">None</option>
                <option value="Wizard">Wizard</option>
                <option value="Priest">Priest</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>
      {isGroup(entry) ? (
        <EditGroupModels group={entry.unit} form={form} unitType={String(draft.unit_type ?? "")} />
      ) : null}
    </div>
  );
}
