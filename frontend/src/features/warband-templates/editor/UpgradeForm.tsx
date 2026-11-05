import { useId, useState } from "react";

import { useDirtySince, useReportDirty } from "@/components/ui/discard-changes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { WarbandTemplate } from "../types/template-types";
import { CAPTION, Field, FORM_BOX, NumberField, SaveRow } from "./editor-ui";
import RulePicker from "./RulePicker";
import type { UpgradeDraft } from "./upgrade-draft";
import WhoField from "./WhoField";

/**
 * One upgrade's form: its group, the special it gives (picked, or written as the template's own),
 * its cost (empty for none in the book, 0 for free) and cost note, who may take it (of the heroes:
 * upgrades are bought for heroes), the most of its group per fighter, later ones at double, and
 * bought only when he is recruited.
 */
export default function UpgradeForm({
  campaignId,
  template,
  initial,
  groups,
  isNew,
  pending,
  error,
  onSave,
  onDelete,
  onCancel,
}: {
  campaignId: number;
  template: WarbandTemplate;
  initial: UpgradeDraft;
  /** The template's groups so far, offered as you type. */
  groups: string[];
  isNew: boolean;
  pending: boolean;
  error: string;
  onSave: (draft: UpgradeDraft) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  useReportDirty(useDirtySince(draft).dirty);
  const [deleting, setDeleting] = useState(false);
  const listId = useId();
  const set = (patch: Partial<UpgradeDraft>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <div
      className={FORM_BOX}
      role="group"
      aria-label={isNew ? "New upgrade" : `Edit ${initial.rule?.name ?? "upgrade"}`}
    >
      <div className="grid grid-cols-2 gap-2 min-[620px]:grid-cols-4">
        <Field label="Group" className="col-span-2">
          {(id) => (
            <>
              <Input
                id={id}
                inputSize="sm"
                maxLength={120}
                list={listId}
                value={draft.group}
                onChange={(event) => set({ group: event.target.value })}
              />
              <datalist id={listId}>
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <NumberField
          label="Cost"
          value={draft.cost}
          placeholder="none"
          onChange={(cost) => set({ cost })}
        />
        <NumberField
          label="Most each"
          value={draft.most}
          placeholder="—"
          onChange={(most) => set({ most })}
        />
        <Field label="Cost note" className="col-span-2">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={120}
              value={draft.costNote}
              onChange={(event) => set({ costNote: event.target.value })}
            />
          )}
        </Field>
        <Field label="Note" className="col-span-2">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={300}
              value={draft.note}
              onChange={(event) => set({ note: event.target.value })}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={CAPTION}>What it gives</span>
        <RulePicker
          campaignId={campaignId}
          templateName={template.name}
          rules={draft.rule ? [draft.rule] : []}
          single
          label="Pick a rule"
          onChange={([rule]) => set({ rule: rule ?? null })}
        />
      </div>
      <WhoField
        who={draft.who}
        fighters={template.fighters.filter((fighter) => fighter.kind === "hero")}
        whoText={draft.whoText}
        onChange={(who) => set({ who, whoText: "" })}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Switch
          look="plain"
          className="text-xs"
          checked={draft.laterDouble}
          onCheckedChange={(laterDouble) => set({ laterDouble })}
        >
          Later ones double
        </Switch>
        <Switch
          look="plain"
          className="text-xs"
          checked={draft.atRecruit}
          onCheckedChange={(atRecruit) => set({ atRecruit })}
        >
          Only when recruited
        </Switch>
      </div>
      <SaveRow
        label={isNew ? "Add upgrade" : "Save upgrade"}
        pending={pending}
        error={error}
        disabled={!draft.group.trim() || !draft.rule}
        onSave={() => onSave(draft)}
        onCancel={onCancel}
      >
        {onDelete ? (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => (deleting ? onDelete() : setDeleting(true))}
          >
            {deleting ? "Delete for good" : "Delete"}
          </Button>
        ) : null}
      </SaveRow>
    </div>
  );
}
