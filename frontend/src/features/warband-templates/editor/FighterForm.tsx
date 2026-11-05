import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { raceOption } from "@/features/catalogue/search-options";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { TemplateFighter, WarbandTemplate } from "../types/template-types";
import { CAPTION, Field, FORM_BOX, NumberField, SaveRow } from "./editor-ui";
import { fighterDraft, type FighterDraft } from "./fighter-draft";
import { SkillTypesField, SpellTypesField } from "./FighterAccess";
import FighterFlags from "./FighterFlags";
import FighterProfile from "./FighterProfile";
import RulePicker from "./RulePicker";

type FighterFormProps = {
  campaignId: number;
  template: WarbandTemplate;
  /** The fighter edited; null: a new one of `kind`. */
  fighter: TemplateFighter | null;
  kind: "hero" | "henchman";
  pending: boolean;
  error: string;
  onSave: (draft: FighterDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
};

/** The variants that change him, which a copy keeps and this form leaves as they are. */
const variantNote = (template: WarbandTemplate, fighter: TemplateFighter | null) => {
  const names = Object.keys(fighter?.variant_changes ?? {}).map(
    (key) => template.variants.find((variant) => variant.key === key)?.name ?? key
  );
  return names.length
    ? `${names.join(", ")} change${names.length === 1 ? "s" : ""} him as well.`
    : "";
};

/**
 * One fighter's form: his name and figures, his profile as written, his skill groups and spell
 * lores, his flags (a henchman's group size, gains XP and promotable), fixed kit, the lists he
 * buys from and his rules (picked or written). Taking him out leaves units recruited as him.
 */
export default function FighterForm(props: FighterFormProps) {
  const { template, fighter } = props;
  const [draft, setDraft] = useState<FighterDraft>(() => fighterDraft(fighter, props.kind));
  const [deleting, setDeleting] = useState(false);
  const races = useCatalogue("races", props.campaignId);
  const settings = useSettingsById();
  const set = (patch: Partial<FighterDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const henchman = draft.kind === "henchman";
  const race = races.data.find((row) => row.id === draft.raceId);
  const label = draft.name || (henchman ? "the henchman" : "the hero");
  const toggleList = (key: string) =>
    set({
      lists: draft.lists.includes(key)
        ? draft.lists.filter((held) => held !== key)
        : [...draft.lists, key],
    });

  return (
    <div
      className={FORM_BOX}
      aria-label={fighter ? `Edit ${fighter.name}` : `New ${henchman ? "henchman" : "hero"}`}
      role="group"
    >
      <div className="grid grid-cols-2 gap-2 min-[620px]:grid-cols-4">
        <Field label="Name" className="col-span-2">
          <Input
            inputSize="sm"
            maxLength={160}
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </Field>
        <Field label="Plural" className="col-span-2">
          <Input
            inputSize="sm"
            maxLength={160}
            value={draft.plural}
            onChange={(event) => set({ plural: event.target.value })}
          />
        </Field>
        <NumberField label="Cost" value={draft.cost} onChange={(cost) => set({ cost })} />
        <NumberField
          label="Least"
          value={draft.min}
          placeholder="0"
          onChange={(min) => set({ min })}
        />
        <NumberField
          label="Most"
          value={draft.max}
          placeholder="any"
          onChange={(max) => set({ max })}
        />
        <NumberField
          label="Starting XP"
          value={draft.xp}
          placeholder="0"
          onChange={(xp) => set({ xp })}
        />
        {henchman ? (
          <>
            <NumberField
              label="Group least"
              value={draft.groupMin}
              onChange={(groupMin) => set({ groupMin })}
            />
            <NumberField
              label="Group most"
              value={draft.groupMax}
              onChange={(groupMax) => set({ groupMax })}
            />
          </>
        ) : null}
      </div>
      <Field label="Race">
        <SearchSelect
          label="Race"
          value={race ? raceOption(race, settings) : null}
          options={races.data.map((row) => raceOption(row, settings))}
          clearLabel="No race"
          onChange={(option) => set({ raceId: option ? Number(option.id) : null })}
        />
      </Field>
      <FighterProfile stats={draft.stats} label={label} onChange={(stats) => set({ stats })} />
      <SkillTypesField
        campaignId={props.campaignId}
        value={draft.skillTypes}
        onChange={(skillTypes) => set({ skillTypes })}
      />
      <SpellTypesField
        campaignId={props.campaignId}
        value={draft.spellTypes}
        onChange={(spellTypes) => set({ spellTypes })}
      />
      <FighterFlags draft={draft} onChange={set} />
      <div className="flex flex-col gap-1.5">
        <span className={CAPTION}>Lists</span>
        <div className="flex flex-wrap gap-1.5">
          {template.lists.map((list) => (
            <Chip
              key={list.key}
              pressed={draft.lists.includes(list.key)}
              onClick={() => toggleList(list.key)}
            >
              {list.name}
            </Chip>
          ))}
        </div>
      </div>
      <Field label="Fixed kit">
        <Input
          inputSize="sm"
          maxLength={1000}
          value={draft.fixedKit}
          onChange={(event) => set({ fixedKit: event.target.value })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className={CAPTION}>Rules</span>
        <RulePicker
          campaignId={props.campaignId}
          templateName={template.name}
          rules={draft.rules}
          label="Add rule"
          onChange={(rules) => set({ rules })}
        />
      </div>
      {variantNote(template, fighter) ? (
        <p className="m-0 text-xs text-muted-foreground">{variantNote(template, fighter)}</p>
      ) : null}
      <SaveRow
        label={fighter ? "Save fighter" : henchman ? "Add henchmen" : "Add hero"}
        pending={props.pending}
        error={props.error}
        disabled={!draft.name.trim()}
        onSave={() => props.onSave(draft)}
        onCancel={props.onCancel}
      >
        {props.onDelete ? (
          <Button
            size="sm"
            variant="danger"
            disabled={props.pending}
            onClick={() => (deleting ? props.onDelete?.() : setDeleting(true))}
          >
            {deleting ? "Take out for good" : "Take out"}
          </Button>
        ) : null}
      </SaveRow>
      {deleting ? (
        <p className="m-0 text-xs font-semibold text-danger">
          Units recruited as him keep what they have.
        </p>
      ) : null}
    </div>
  );
}
