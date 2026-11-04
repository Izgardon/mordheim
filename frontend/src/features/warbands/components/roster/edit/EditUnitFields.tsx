import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import type { HeroCaster } from "../../../types/warband-types";
import { isCreature, isGroup, unitName, xpTable, type RosterUnit } from "../unit-view";
import XpTrack from "../XpTrack";
import EditGroupModels from "./EditGroupModels";
import EditLists from "./EditLists";
import EditProfile, { EditXpField } from "./EditProfile";
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
 * sheet (William's layout): the traits as plain toggles; name, type, race, cost and experience on
 * one row, each as tall as the race, and the XP track under it; the profile and skill access side
 * by side; then the lists
 * as a 2 × 2 grid, and a group's models.
 */
export default function EditUnitFields({
  entry,
  campaign,
  campaignId,
  warbandId,
  form,
  canCreateRace,
  onAddItem,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  campaignId: number;
  warbandId: number;
  form: UnitEditDraft;
  canCreateRace: boolean;
  /** Add item: opens the unit's loadout. */
  onAddItem: () => void;
}) {
  const { kind, unit } = entry;
  const { draft, set } = form;
  const caster = "caster" in draft ? (String(draft.caster) as HeroCaster) : "No";

  const field = (label: string, key: string, numeric = false) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      <span className="flex min-h-5 items-center">{label}</span>
      {numeric ? (
        <NumberInput
          inputSize="sm"
          min={0}
          containerClassName="h-auto min-h-9 flex-1"
          value={String(draft[key] ?? "")}
          onChange={(event) => set(key, event.target.value)}
        />
      ) : (
        <Input
          inputSize="sm"
          className="h-auto min-h-9 flex-1 md:h-auto"
          value={String(draft[key] ?? "")}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </label>
  );
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
      <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-[1fr_1fr_1.3fr_0.7fr_0.9fr]">
        {field("Name", "name")}
        {field("Type", "unit_type")}
        <RaceField
          campaignId={campaignId}
          value={(draft.race as number | null) ?? null}
          canCreate={canCreateRace}
          onChange={(raceId) => set("race", raceId)}
        />
        {field(kind === "hireling" ? "Hire fee (gc)" : "Cost (gc)", "price", true)}
        <EditXpField form={form} />
      </div>
      {isCreature(entry) ? null : (
        <XpTrack xp={Number(draft.xp) || 0} thresholds={xpTable(kind, campaign)} />
      )}
      <div className="grid gap-3.5 min-[720px]:grid-cols-2">
        <EditProfile form={form} unitLabel={unitName(unit)} />
        {"available_skills" in draft ? (
          <SkillAccessField
            campaignId={campaignId}
            warbandId={warbandId}
            value={draft.available_skills as Record<string, boolean>}
            onChange={(next) => set("available_skills", next)}
          />
        ) : null}
      </div>
      <EditLists
        entry={entry}
        campaignId={campaignId}
        warbandId={warbandId}
        form={form}
        onAddItem={onAddItem}
      />
      {isGroup(entry) ? (
        <EditGroupModels group={entry.unit} form={form} unitType={String(draft.unit_type ?? "")} />
      ) : null}
    </div>
  );
}
