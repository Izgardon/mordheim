import { useState } from "react";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import { Label } from "@components/label";
import UnitStatsGrid from "../shared/forms/UnitStatsGrid";
import UnitLoadout from "../shared/forms/UnitLoadout";
import DismissUnitDescription from "./DismissUnitDescription";
import MissingGamesField from "./forms/MissingGamesField";
import { statFieldMap, statFields } from "../../utils/warband-utils";

import type { UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";
import type { UnitValidationField } from "../../units/unit-form-helpers";
import type { CasterUnitForm, UnitFormSlotProps } from "./forms/form-types";

type UnitFormCardProps<K extends UnitKindKey> = Omit<
  UnitFormSlotProps<K>,
  "inputClassName" | "hasFieldError"
> & {
  kind: UnitKindConfig<K>;
};

const inputClassName =
  "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";

const deedsClassName = [
  "min-h-[110px] w-full border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)]",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]",
].join(" ");

/** A unit's edit card: the kind's basics and loadout around the shared stats and deeds. */
export default function UnitFormCard<K extends UnitKindKey>({
  kind,
  ...props
}: UnitFormCardProps<K>) {
  const { form, index, onUpdate, onRemove, error } = props;
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isDeedsOpen, setIsDeedsOpen] = useState(false);
  const { FormBasics, FormLoadout } = kind.slots;
  // A dramatis persona's card says so, though he is in the Hired Swords section.
  const labels = kind.labelsFor?.(form) ?? kind.labels;
  const unitName = form.name?.trim() || labels.fallbackName(index);
  const slotProps: UnitFormSlotProps<K> = {
    ...props,
    inputClassName,
    hasFieldError: (field: UnitValidationField) => Boolean(error?.fields?.includes(field)),
  };

  return (
    <div
      role="group"
      aria-label={`${labels.singular} ${index + 1}`}
      className="relative space-y-4 overflow-visible rounded-lg border border-border/60 bg-[rgba(12,9,6,0.92)] p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]"
    >
      <div className="absolute right-2 top-2 flex items-center gap-2">
        {props.onDuplicate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={props.onDuplicate}
            disabled={Boolean(props.duplicateBlockedReason)}
            title={props.duplicateBlockedReason ?? undefined}
            aria-label={`Duplicate ${unitName}`}
          >
            Duplicate
          </Button>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setIsRemoveDialogOpen(true)}
        >
          {labels.dismiss}
        </Button>
      </div>

      <ConfirmDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        description={
          <DismissUnitDescription verb={labels.dismissVerb} name={unitName} isQueued={!form.id} />
        }
        confirmText={!form.id ? "Remove" : labels.dismissConfirm}
        onConfirm={() => {
          setIsRemoveDialogOpen(false);
          onRemove(index);
        }}
        onCancel={() => setIsRemoveDialogOpen(false)}
      />

      <p className="pr-40 text-sm font-semibold tracking-[0.08em] text-foreground">
        <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {labels.singular} {index + 1}
        </span>
        <span className="mx-2 text-muted-foreground">-</span>
        <span className="text-lg font-bold leading-tight text-foreground">{unitName}</span>
      </p>

      {props.recruitCost !== undefined ? (
        <p className="text-xs text-muted-foreground">
          New recruit: {props.recruitCost} gc, paid when you save.
        </p>
      ) : null}
      {error && <p className="text-xs font-semibold text-red-500">{error.message}</p>}
      {props.serverErrors?.length ? (
        <ul role="alert" className="space-y-0.5 text-xs font-semibold text-red-500">
          {props.serverErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <FormBasics {...slotProps} />

          <UnitStatsGrid
            unit={form}
            index={index}
            statFields={statFields}
            inputClassName={inputClassName}
            onUpdate={onUpdate}
            raceStats={
              form.race
                ? Object.fromEntries(
                    statFields.map((k) => [
                      k,
                      form.race![statFieldMap[k as keyof typeof statFieldMap]] ?? null,
                    ])
                  )
                : undefined
            }
          />

          <MissingGamesField
            form={form}
            index={index}
            inputClassName={inputClassName}
            onUpdate={onUpdate}
          />

          <div className="space-y-2 rounded border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Deeds</Label>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setIsDeedsOpen((current) => !current)}
              >
                {isDeedsOpen ? "Hide" : "Show"}
              </button>
            </div>
            {isDeedsOpen ? (
              <textarea
                value={form.deeds}
                onChange={(event) =>
                  onUpdate(index, (current) => ({ ...current, deeds: event.target.value }))
                }
                placeholder="Notable deeds, achievements, and scars..."
                rows={4}
                className={deedsClassName}
              />
            ) : null}
          </div>
        </div>

        {FormLoadout ? (
          <FormLoadout {...slotProps} />
        ) : (
          <UnitLoadout
            unit={form as CasterUnitForm}
            index={index}
            campaignId={props.campaignId}
            availableItems={props.availableItems}
            availableSkills={props.availableSkills}
            availableSpells={props.availableSpells ?? []}
            availableSpecials={props.availableSpecials}
            inputClassName={inputClassName}
            canAddCustom={props.canAddCustom ?? false}
            unitType={kind.section}
            deferItemCommit={props.deferItemCommit}
            reservedGold={props.reservedGold}
            onPendingPurchaseAdd={props.onPendingPurchaseAdd}
            onPendingPurchaseRemove={props.onPendingPurchaseRemove}
            onUpdate={
              onUpdate as (index: number, updater: (form: CasterUnitForm) => CasterUnitForm) => void
            }
            onSkillCreated={props.onSkillCreated}
            initialTab={props.initialTab}
          />
        )}
      </div>
    </div>
  );
}
