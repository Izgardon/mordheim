import { BookOpen, Crosshair, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4c5 3 8 8 8 8s-3 5-8 8" />
      <path d="M6 4v16" />
      <path d="M4 12h16" />
      <path d="M16 8l4 4-4 4" />
    </svg>
  );
}

type ActiveBattleHelpersProps = {
  showLabel?: boolean;
  rangedDisabled: boolean;
  meleeDisabled: boolean;
  showScenarioAction: boolean;
  onOpenRanged: () => void;
  onOpenMelee: () => void;
  onOpenCriticalHits: () => void;
  onOpenScenario: () => void;
};

export default function ActiveBattleHelpers({
  showLabel = true,
  rangedDisabled,
  meleeDisabled,
  showScenarioAction,
  onOpenRanged,
  onOpenMelee,
  onOpenCriticalHits,
  onOpenScenario,
}: ActiveBattleHelpersProps) {
  return (
    <>
      {showLabel ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Helpers:
        </span>
      ) : null}
      <Button
        type="button"
        variant="toolbar"
        className="h-9 gap-2 px-3 text-xs"
        onClick={onOpenRanged}
        disabled={rangedDisabled}
        aria-label="Open ranged helper"
      >
        <BowIcon className="h-4 w-4" />
        <span>Ranged</span>
      </Button>
      <Button
        type="button"
        variant="toolbar"
        className="h-9 gap-2 px-3 text-xs"
        onClick={onOpenMelee}
        disabled={meleeDisabled}
        aria-label="Open melee helper"
      >
        <Swords className="h-4 w-4" aria-hidden="true" />
        <span>Melee</span>
      </Button>
      <Button
        type="button"
        variant="toolbar"
        className="h-9 gap-2 px-3 text-xs"
        onClick={onOpenCriticalHits}
        aria-label="Open critical hit reference"
      >
        <Crosshair className="h-4 w-4" aria-hidden="true" />
        <span>Critical Hits</span>
      </Button>
      {showScenarioAction ? (
        <Button
          type="button"
          variant="toolbar"
          className="h-9 gap-2 px-3 text-xs"
          onClick={onOpenScenario}
          aria-label="View scenario link"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Scenario</span>
        </Button>
      ) : null}
    </>
  );
}
