import { useState } from "react";
import type { ClipboardEvent, FocusEvent, MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import BestiaryPicker from "@/features/bestiary/components/BestiaryPicker";
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";

import type { CustomUnitDraft, StatKey } from "./prebattle-types";
import { STAT_FIELDS } from "./prebattle-types";
import { parseSpreadsheetValues } from "../shared/battle-stat-inputs";

type PrebattleCustomUnitBuilderProps = {
  open: boolean;
  draft: CustomUnitDraft;
  error?: string;
  showRatingField?: boolean;
  disabled?: boolean;
  campaignId?: number;
  onToggleOpen: () => void;
  onDraftChange: (next: CustomUnitDraft) => void;
  onDraftStatChange: (key: StatKey, value: string) => void;
  onSave: () => void;
};

export default function PrebattleCustomUnitBuilder({
  open,
  draft,
  error,
  showRatingField = true,
  disabled = false,
  campaignId,
  onToggleOpen,
  onDraftChange,
  onDraftStatChange,
  onSave,
}: PrebattleCustomUnitBuilderProps) {
  const [showBestiaryPicker, setShowBestiaryPicker] = useState(false);

  const handleSelectFromBestiary = (entry: BestiaryEntrySummary) => {
    onDraftChange({
      ...draft,
      name: entry.name,
      unitType: entry.type,
      stats: {
        movement: String(entry.movement),
        weapon_skill: String(entry.weapon_skill),
        ballistic_skill: String(entry.ballistic_skill),
        strength: String(entry.strength),
        toughness: String(entry.toughness),
        wounds: String(entry.wounds),
        initiative: String(entry.initiative),
        attacks: String(entry.attacks),
        leadership: String(entry.leadership),
        armour_save: entry.armour_save != null ? String(entry.armour_save) : "",
      },
    });
    setShowBestiaryPicker(false);
  };

  const handleSelectAll = (
    event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    startFieldIndex: number
  ) => {
    const pastedValues = parseSpreadsheetValues(event.clipboardData.getData("text"));
    if (pastedValues.length <= 1) {
      return;
    }

    event.preventDefault();

    pastedValues.forEach((value, offset) => {
      const targetField = STAT_FIELDS[startFieldIndex + offset];
      if (!targetField) {
        return;
      }
      onDraftStatChange(targetField.key, value);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <Button variant="secondary" size="sm" onClick={onToggleOpen} disabled={disabled}>
          {open ? "Close" : "Add Temporary Unit"}
        </Button>
      </div>

      {open ? (
        <div className="battle-card space-y-2 p-2.5">
          <section className="battle-inline-panel rounded-md p-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
                Temporary Unit
              </p>
              {campaignId != null ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={disabled}
                  onClick={() => setShowBestiaryPicker((prev) => !prev)}
                >
                  {showBestiaryPicker ? "Close Bestiary" : "Load from Bestiary"}
                </Button>
              ) : null}
            </div>

            {showBestiaryPicker && campaignId != null ? (
              <div className="mb-2">
                <BestiaryPicker
                  campaignId={campaignId}
                  onSelect={handleSelectFromBestiary}
                  onClose={() => setShowBestiaryPicker(false)}
                />
              </div>
            ) : null}

            <div className={`grid grid-cols-2 gap-1 ${showRatingField ? "sm:grid-cols-3" : ""}`}>
              <div className="space-y-1">
                <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Name
                </label>
                <Input
                  value={draft.name}
                  onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                  placeholder="Unit name"
                  maxLength={120}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </label>
                <Input
                  value={draft.unitType}
                  onChange={(event) => onDraftChange({ ...draft, unitType: event.target.value })}
                  placeholder="Unit type"
                  maxLength={120}
                  className="h-8 text-xs"
                />
              </div>
              {showRatingField ? (
                <div className="col-span-2 space-y-1 sm:col-span-1">
                  <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                    Rating
                  </label>
                  <NumberInput
                    min={0}
                    max={9999}
                    step={1}
                    allowEmpty
                    inputSize="sm"
                    value={draft.rating}
                    onChange={(event) => onDraftChange({ ...draft, rating: event.target.value })}
                    onFocus={(event) => event.currentTarget.select()}
                    placeholder="Rating"
                    className="h-8 text-xs"
                  />
                </div>
              ) : null}
            </div>
            {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : null}
          </section>

          <section className="battle-inline-panel rounded-md p-2">
            <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
              Stats
            </p>
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {STAT_FIELDS.map((stat, statIndex) => (
                <div key={`custom-draft-${stat.key}`} className="space-y-1">
                  <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {stat.label}
                  </label>
                  <Input
                    type={stat.input}
                    min={stat.input === "number" ? 0 : undefined}
                    max={stat.input === "number" ? 10 : undefined}
                    maxLength={stat.input === "text" ? 20 : undefined}
                    value={draft.stats[stat.key]}
                    onFocus={handleSelectAll}
                    onClick={handleSelectAll}
                    onPaste={(event) => handlePaste(event, statIndex)}
                    onChange={(event) => onDraftStatChange(stat.key, event.target.value)}
                    className="h-8 px-1 text-center text-xs"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button variant="default" size="sm" onClick={onSave} disabled={disabled}>
              Save temporary unit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
