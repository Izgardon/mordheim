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
import DiceRoller from "@/components/dice/DiceRoller";

const MODIFIER_OPTIONS = Array.from({ length: 13 }, (_, index) => 10 - index);

const formatModifierLabel = (value: number) => (value > 0 ? `+${value}` : String(value));

type RaritySectionProps = {
  rarity: number;
  modifierEnabled: boolean;
  onModifierEnabledChange: (enabled: boolean) => void;
  rarityModifier: number;
  onRarityModifierChange: (value: number) => void;
  modifierReason: string;
  onModifierReasonChange: (value: string) => void;
  rarityRollTotal: number | null;
  onRarityRollTotalChange: (value: number) => void;
};

export default function RaritySection({
  rarity,
  modifierEnabled,
  onModifierEnabledChange,
  rarityModifier,
  onRarityModifierChange,
  modifierReason,
  onModifierReasonChange,
  onRarityRollTotalChange,
}: RaritySectionProps) {
  const isCommon = rarity === 2;

  return (
    <div className="space-y-4">
      {!isCommon ? (
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={modifierEnabled}
              onChange={(event) => onModifierEnabledChange(event.target.checked)}
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
                />
              </div>
            </div>
          ) : null}
          <DiceRoller
            fixedNotation="2d6"
            fullScreen
            variant="button-only"
            showResultBox={false}
            onTotalChange={onRarityRollTotalChange}
          />
        </div>
      ) : null}
    </div>
  );
}
