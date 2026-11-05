import { useState } from "react";

import { Chip } from "@/components/ui/chip";

import type { TemplateFighter, TemplateWho } from "../types/template-types";
import { CAPTION } from "./editor-ui";
import { namedKeys, WHO_MODES, whoFor, whoMode, type WhoMode } from "./who-draft";

/**
 * Who may take a line or an upgrade: everyone, heroes (and any henchmen named), the fighters
 * named, or all but those named; others still may, with the reason (the server's `who_text`,
 * shown once saved).
 */
export default function WhoField({
  who,
  fighters,
  whoText,
  onChange,
}: {
  who: TemplateWho;
  fighters: TemplateFighter[];
  /** The server's wording of the saved who ("Gaolers only"). */
  whoText?: string;
  onChange: (who: TemplateWho) => void;
}) {
  // the mode stays as picked while it names nobody yet
  const [mode, setMode] = useState<WhoMode>(() => whoMode(who));
  const keys = namedKeys(who);
  const shown =
    mode === "heroes" ? fighters.filter((fighter) => fighter.kind === "henchman") : fighters;
  const toggle = (key: string) =>
    onChange(
      whoFor(mode, keys.includes(key) ? keys.filter((held) => held !== key) : [...keys, key])
    );
  const pick = (next: WhoMode) => {
    setMode(next);
    onChange(whoFor(next, next === "heroes" || mode === "heroes" ? [] : keys));
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Who may take it</span>
      <select
        aria-label="Who may take it"
        className="h-9 self-start border border-strong bg-page px-2 text-sm text-ink"
        value={mode}
        onChange={(event) => pick(event.target.value as WhoMode)}
      >
        {WHO_MODES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {mode !== "everyone" ? (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((fighter) => (
            <Chip
              key={fighter.key}
              pressed={keys.includes(fighter.key)}
              onClick={() => toggle(fighter.key)}
            >
              {fighter.kind === "henchman" && fighter.plural ? fighter.plural : fighter.name}
            </Chip>
          ))}
        </div>
      ) : null}
      {whoText ? <span className="text-xs text-muted-foreground">{whoText}</span> : null}
    </div>
  );
}
