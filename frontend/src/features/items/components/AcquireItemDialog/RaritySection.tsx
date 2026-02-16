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
};

const MODIFIER_OPTIONS = Array.from({ length: 13 }, (_, index) => 10 - index);

const formatModifierLabel = (value: number) => (value > 0 ? `+${value}` : String(value));

type RaritySectionProps = {
  rarity: number;
  heroes: HeroOption[];
  searchingHeroId: string;
  onSearchingHeroChange: (value: string) => void;
  rollLocked: boolean;
  rollDisabled: boolean;
  onHeroRolled: (heroId: string) => void;
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
  rollLocked,
  rollDisabled,
  onHeroRolled,
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
  const controlsDisabled = isRolling || rollLocked;

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
                  <SelectItem key={hero.id} value={String(hero.id)}>
                    {hero.name || "Unnamed Hero"}
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
            onTotalChange={(total) => {
              onRarityRollTotalChange(total);
              if (searchingHeroId) {
                onHeroRolled(searchingHeroId);
              }
            }}
            onRollingChange={setIsRolling}
            rollDisabled={rollDisabled}
          />
        </div>
      ) : null}
    </div>
  );
}
