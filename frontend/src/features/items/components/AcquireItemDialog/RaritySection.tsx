import { Input } from "@components/input";
import { Checkbox } from "@components/checkbox";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { useState } from "react";
import DiceRoller from "@/components/dice/DiceRoller";
type HeroOption = {
  id: number | string;
  name?: string | null;
  trading_action?: boolean | null;
};

type HeroRarityRoll = {
  total: number;
  modifier: number;
  finalTotal: number;
  success: boolean;
};

const MODIFIER_OPTIONS = Array.from({ length: 13 }, (_, index) => 10 - index);

const formatModifierLabel = (value: number) => (value > 0 ? `+${value}` : String(value));

type RaritySectionProps = {
  rarity: number;
  heroes: HeroOption[];
  searchingHeroId: string;
  onSearchingHeroChange: (value: string) => void;
  rollDisabled: boolean;
  isSavingRarityRoll: boolean;
  hasStoredRarityRoll: boolean;
  currentRarityRoll: HeroRarityRoll | null;
  modifierEnabled: boolean;
  onModifierEnabledChange: (enabled: boolean) => void;
  rarityModifier: number;
  onRarityModifierChange: (value: number) => void;
  modifierReason: string;
  onModifierReasonChange: (value: string) => void;
  onRarityRollTotalChange: (value: number) => void;
};

export default function RaritySection({
  rarity,
  heroes,
  searchingHeroId,
  onSearchingHeroChange,
  rollDisabled,
  isSavingRarityRoll,
  hasStoredRarityRoll,
  currentRarityRoll,
  modifierEnabled,
  onModifierEnabledChange,
  rarityModifier,
  onRarityModifierChange,
  modifierReason,
  onModifierReasonChange,
  onRarityRollTotalChange,
}: RaritySectionProps) {
  const isCommon = rarity === 2;
  const [isRolling, setIsRolling] = useState(false);
  const controlsDisabled = isRolling || isSavingRarityRoll || hasStoredRarityRoll;

  return (
    <div className="space-y-4">
      {!isCommon ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Searching hero</Label>
            <Select
              value={searchingHeroId}
              onValueChange={onSearchingHeroChange}
              disabled={isRolling || heroes.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select hero" />
              </SelectTrigger>
              <SelectContent>
                {heroes.map((hero) => (
                  <SelectItem
                    key={hero.id}
                    value={String(hero.id)}
                    disabled={hero.trading_action === false}
                  >
                    {hero.name || "Unnamed Hero"}
                    {hero.trading_action === false ? " (spent)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={modifierEnabled}
              onChange={(event) => onModifierEnabledChange(event.target.checked)}
              disabled={controlsDisabled}
            />
            Add modifier
          </label>
          {modifierEnabled ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modifier</Label>
                <Select
                  value={String(rarityModifier)}
                  onValueChange={(value) => {
                    onRarityModifierChange(Number(value));
                  }}
                  disabled={controlsDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select modifier" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODIFIER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {formatModifierLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input
                  value={modifierReason}
                  onChange={(event) => onModifierReasonChange(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  disabled={controlsDisabled}
                />
              </div>
            </div>
          ) : null}
          <DiceRoller
            fixedNotation="2d6"
            fullScreen
            variant="button-only"
            showResultBox={false}
            rollButtonPrefix=""
            onTotalChange={onRarityRollTotalChange}
            onRollingChange={setIsRolling}
            rollDisabled={rollDisabled}
          />
          {currentRarityRoll ? (
            <p className="text-sm text-muted-foreground">
              Rolled {currentRarityRoll.total}
              {currentRarityRoll.modifier >= 0
                ? ` + ${currentRarityRoll.modifier}`
                : ` - ${Math.abs(currentRarityRoll.modifier)}`}{" "}
              = {currentRarityRoll.finalTotal}{" "}
              <span className={currentRarityRoll.success ? "text-emerald-400" : "text-red-400"}>
                {currentRarityRoll.success ? "(Success)" : "(Failed)"}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
