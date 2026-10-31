import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import type { KillHow } from "@/features/battles/api/battles-api";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { KillInput } from "@/features/battles/hooks/useBattleScreen";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { victimOptions, type BattleSide, type BattleUnitView } from "./battle-units";

/** Who is logging the kill: one unit, or a henchmen group whose model is picked in the sheet. */
export type Killer = { name: string; models: BattleUnitView[] };

type KillSheetProps = {
  killer: Killer | null;
  round: number;
  /** The other warbands and the neutral groups. */
  sides: BattleSide[];
  rosters: Record<number, ParticipantRoster | undefined>;
  onOpenChange: (open: boolean) => void;
  onSave: (kill: KillInput) => Promise<void>;
};

const HOWS: { id: KillHow; label: string }[] = [
  { id: "melee", label: "Melee" },
  { id: "shooting", label: "Shooting" },
  { id: "magic", label: "Magic" },
  { id: "other", label: "Other" },
];

const pill = (on: boolean) =>
  cn(
    "min-h-11 border text-[13px] font-bold",
    on
      ? "border-accent-line bg-accent-soft text-accent-hi"
      : "border-border bg-transparent text-text2"
  );

/**
 * The kill sheet (design E): who (the model, for henchmen), the victim from another warband's
 * units (hired swords and animals among them) or a neutral group's creatures, or Someone else
 * with a typed name; how; and XP earned, on by default. Saving records the kill, which puts the
 * victim out of action.
 */
export default function KillSheet({
  killer,
  round,
  sides,
  rosters,
  onOpenChange,
  onSave,
}: KillSheetProps) {
  const [modelKey, setModelKey] = useState("");
  const [sideId, setSideId] = useState("");
  const [victimId, setVictimId] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [how, setHow] = useState<KillHow>("melee");
  const [earnedXp, setEarnedXp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = killer !== null;

  useEffect(() => {
    if (!killer) return;
    const standing = killer.models.find((model) => model.status !== "out_of_action");
    setModelKey((standing ?? killer.models[0])?.unit.key ?? "");
    setSideId(sides[0]?.id ?? "");
    setVictimId(null);
    setTyped("");
    setHow("melee");
    setEarnedXp(true);
    setError("");
    // A new sheet each time it opens, for whoever it opens for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killer]);

  const side = sides.find((entry) => entry.id === sideId) ?? sides[0];
  const victims = useMemo(() => (side ? victimOptions(side, rosters) : []), [rosters, side]);
  const victim = victims.find((entry) => entry.id === victimId) ?? null;
  const name = typed.trim();
  const ready = Boolean(modelKey) && (victim !== null || name.length > 0);

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        killerUnitKey: modelKey,
        victim: victim?.unitKey
          ? { unitKey: victim.unitKey }
          : victim?.neutralKey
            ? { neutralKey: victim.neutralKey }
            : { name },
        how,
        earnedXp,
      });
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't log the kill."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={`Log a kill · round ${round}`}
      title={killer?.name ?? "Log a kill"}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={cn("min-h-12 text-[15px]", !ready && "bg-raised text-muted-foreground")}
            disabled={!ready || saving}
            onClick={() => void save()}
          >
            {saving ? "Logging…" : ready ? "Log kill" : "Pick a victim"}
          </Button>
        </div>
      }
    >
      {killer && killer.models.length > 1 ? (
        <div role="group" aria-label="Which model" className="grid grid-cols-3 gap-1.5">
          {killer.models.map((model) => (
            <button
              key={model.unit.key}
              type="button"
              aria-pressed={modelKey === model.unit.key}
              disabled={model.status === "out_of_action"}
              onClick={() => setModelKey(model.unit.key)}
              className={cn(pill(modelKey === model.unit.key), "disabled:opacity-40")}
            >
              {model.unit.displayName}
            </button>
          ))}
        </div>
      ) : null}
      {sides.length > 1 ? (
        <div
          role="tablist"
          aria-label="Whose model"
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.min(sides.length, 3)}, minmax(0, 1fr))` }}
        >
          {sides.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === side?.id}
              onClick={() => {
                setSideId(entry.id);
                setVictimId(null);
              }}
              className={cn(pill(entry.id === side?.id), "min-h-10 truncate px-2 text-xs")}
            >
              {entry.kind === "neutral" ? `${entry.name} · neutral` : entry.name}
            </button>
          ))}
        </div>
      ) : null}
      <div role="radiogroup" aria-label="Victim" className="flex flex-col">
        {victims.map((entry) => {
          const on = entry.id === victimId;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setVictimId(entry.id);
                setTyped("");
              }}
              className={cn(
                "flex min-h-12 items-center gap-3 border-t border-line px-2.5 py-1 text-left",
                on && "bg-accent-soft"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 shrink-0 border-2",
                  on ? "border-primary bg-primary" : "border-strong bg-transparent"
                )}
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink">{entry.name}</span>
                <span className="text-xs text-muted-foreground">{entry.detail}</span>
              </span>
            </button>
          );
        })}
        {victims.length === 0 ? (
          <p className="m-0 border-t border-line px-2.5 py-3 text-sm text-muted-foreground">
            Nobody left standing here.
          </p>
        ) : null}
        <label className="flex min-h-12 items-center gap-2.5 border-t border-line px-2.5 py-1 text-[13px] text-muted-foreground">
          Someone else
          <Input
            value={typed}
            placeholder="Name"
            onChange={(event) => {
              setTyped(event.target.value);
              if (event.target.value.trim()) setVictimId(null);
            }}
            className="flex-1"
          />
        </label>
      </div>
      <div role="group" aria-label="How" className="grid grid-cols-4 gap-1.5">
        {HOWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={how === entry.id}
            onClick={() => setHow(entry.id)}
            className={pill(how === entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={earnedXp}
        onClick={() => setEarnedXp(!earnedXp)}
        className={cn(
          "flex min-h-12 items-center justify-between border px-3 text-sm font-bold text-ink",
          earnedXp ? "border-accent-line bg-accent-soft" : "border-border bg-transparent"
        )}
      >
        XP earned
        <span
          aria-hidden="true"
          className={cn(
            "flex h-[22px] w-10 p-0.5",
            earnedXp ? "justify-end bg-primary" : "justify-start bg-border"
          )}
        >
          <span className={cn("h-4 w-4", earnedXp ? "bg-on-accent" : "bg-muted-foreground")} />
        </span>
      </button>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
