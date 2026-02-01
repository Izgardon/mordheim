import { useState } from "react";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroStatsTable from "../blocks/HeroStatsTable";
import HeroExpandedCard from "./HeroExpandedCard";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import DiceRoller from "@/components/dice/DiceRoller";
import { useAppStore } from "@/stores/app-store";

import type { WarbandHero } from "../../../../types/warband-types";
import cardDetailed from "@/assets/containers/basic_bar.png";
import expandIcon from "@/assets/components/right_arrow.png";
import expandIconHover from "@/assets/components/right_arrow_hover.png";

type HeroSummaryCardProps = {
  hero: WarbandHero;
  warbandId: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
};

export default function HeroSummaryCard({
  hero,
  warbandId,
  isExpanded = false,
  onToggle,
  onCollapse,
}: HeroSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [expandHovered, setExpandHovered] = useState(false);
  const [isLevelUpOpen, setIsLevelUpOpen] = useState(false);
  const [rollSignal, setRollSignal] = useState(0);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [hasRolled, setHasRolled] = useState(false);
  const [levelUpError, setLevelUpError] = useState("");
  const { diceColor } = useAppStore();

  const statOptions = [
    { id: "M", label: "Movement" },
    { id: "WS", label: "Weapon Skill" },
    { id: "BS", label: "Ballistic Skill" },
    { id: "S", label: "Strength" },
    { id: "T", label: "Toughness" },
    { id: "W", label: "Wounds" },
    { id: "I", label: "Initiative" },
    { id: "A", label: "Attacks" },
    { id: "Ld", label: "Leadership" },
  ];

  const handleSelectStat = (statId: string) => {
    setSelectedStat((current) => (current === statId ? null : statId));
    setLevelUpError("");
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  const resetLevelUpState = () => {
    setRollSignal(0);
    setSelectedStat(null);
    setHasRolled(false);
    setLevelUpError("");
  };

  const handleLevelUpOpenChange = (open: boolean) => {
    if (!open && hasRolled && !selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }
    setIsLevelUpOpen(open);
    if (!open) {
      resetLevelUpState();
      return;
    }
    resetLevelUpState();
  };

  const handleLevelUpConfirm = () => {
    if (!selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }
    setIsLevelUpOpen(false);
    resetLevelUpState();
  };

  if (isExpanded) {
    return (
      <HeroExpandedCard
        hero={hero}
        warbandId={warbandId}
        onClose={onCollapse ?? (() => {})}
      />
    );
  }

  return (
    <div
      className="warband-hero-card relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setExpandHovered(false);
      }}
    >
      {hero.level_up ? (
        <button
          type="button"
          onClick={() => setIsLevelUpOpen(true)}
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b] shadow-[0_6px_12px_rgba(6,4,2,0.5)]"
        >
          Level Up!
        </button>
      ) : null}
      <div
        style={{
          backgroundImage: `url(${cardDetailed})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <HeroCardHeader hero={hero} />
      </div>
      <div
        style={{
          backgroundImage: `url(${cardDetailed})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <HeroStatsTable hero={hero} />
      </div>
      <HeroListBlocks hero={hero} />

      {/* Expand button */}
      {isHovered && (
        <button
          type="button"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 cursor-pointer border-none bg-transparent p-0 transition-opacity duration-150"
          onMouseEnter={() => setExpandHovered(true)}
          onMouseLeave={() => setExpandHovered(false)}
          onClick={handleExpandClick}
        >
          <img
            src={expandHovered ? expandIconHover : expandIcon}
            alt="Expand"
            className="h-8 w-8"
          />
        </button>
      )}

      <Dialog
        open={isLevelUpOpen}
        onOpenChange={handleLevelUpOpenChange}
      >
        <DialogContent
          className="max-w-[560px]"
          onInteractOutside={(event) => {
            if (hasRolled && !selectedStat) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (hasRolled && !selectedStat) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Level Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">2d6 Roll</h3>
                <p className="text-sm text-muted-foreground">
                  Roll to determine the advance result.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setRollSignal((prev) => prev + 1);
                    setHasRolled(true);
                    setLevelUpError("");
                  }}
                >
                  Roll 2d6
                </Button>
              </div>
              <DiceRoller
                mode="fixed"
                fixedNotation="2d6"
                fullScreen
                themeColor={diceColor}
                showRollButton={false}
                resultMode="dice"
                showResultBox
                rollSignal={rollSignal}
              />
            </section>
            <section className="space-y-3 border-t border-border/50 pt-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Pick a stat</h3>
                <p className="text-sm text-muted-foreground">
                  Choose one stat to increase.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {statOptions.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground"
                  >
                    <Checkbox
                      checked={selectedStat === option.id}
                      onChange={() => handleSelectStat(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {levelUpError ? (
                <p className="text-sm text-red-600">{levelUpError}</p>
              ) : null}
            </section>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsLevelUpOpen(false)}
              disabled={hasRolled}
            >
              Cancel
            </Button>
            <Button onClick={handleLevelUpConfirm}>Level up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
