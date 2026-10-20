import { useState } from "react";

import { Button } from "@components/button";
import { Label } from "@components/label";
import CollapsibleSection from "@/components/ui/collapsible-section";

import type { useWarbandRulesForm } from "../../hooks/settings/useWarbandRulesForm";

type LevelUps = ReturnType<typeof useWarbandRulesForm>["levelUps"];

const textareaClassName =
  "min-h-[120px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_22px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

type ThresholdFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  error: string;
  hint?: string;
  onChange: (value: string) => void;
  onReset: () => void;
};

function ThresholdField({
  label,
  value,
  placeholder,
  error,
  hint,
  onChange,
  onReset,
}: ThresholdFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <Button type="button" variant="secondary" size="sm" onClick={onReset}>
          Reset default
        </Button>
      </div>
      <textarea
        className={textareaClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <p className="min-h-[1.25rem] text-sm text-red-600">{error}</p>
    </div>
  );
}

/** The heroes' and henchmen's XP thresholds, folded away by default (hired swords use heroes'). */
export default function LevelUpThresholdsSection({ levelUps }: { levelUps: LevelUps }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <CollapsibleSection
      title="Level ups"
      collapsed={collapsed}
      onToggle={() => setCollapsed((current) => !current)}
      summary={
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Heroes {levelUps.heroCount} · Henchmen {levelUps.henchmenCount}
        </span>
      }
    >
      <div className="space-y-3">
        <ThresholdField
          label="Heroes"
          value={levelUps.heroText}
          placeholder="2, 4, 6, 8, 11, 14..."
          error={levelUps.errors.hero}
          hint="Hired swords level on this table too."
          onChange={levelUps.setHeroText}
          onReset={levelUps.resetHero}
        />
        <ThresholdField
          label="Henchmen"
          value={levelUps.henchmenText}
          placeholder="2, 5, 9, 14"
          error={levelUps.errors.henchmen}
          onChange={levelUps.setHenchmenText}
          onReset={levelUps.resetHenchmen}
        />

        <p className="min-h-[1.25rem] text-sm text-red-600">{levelUps.errors.save}</p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={levelUps.save} disabled={levelUps.isSaving}>
            {levelUps.isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
