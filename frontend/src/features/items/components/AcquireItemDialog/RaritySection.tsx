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
  rarityRollTotal,
  onRarityRollTotalChange,
}: RaritySectionProps) {
  const isCommon = rarity === 2;
  const rarityLabel = isCommon ? "Common" : String(rarity);
  const totalWithModifier =
    rarityRollTotal === null ? null : rarityRollTotal + (modifierEnabled ? rarityModifier : 0);

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center rounded-2xl border border-border/60 bg-background/80 px-4 py-2 shadow-[0_8px_18px_rgba(5,20,24,0.18)]">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          Rarity: {rarityLabel}
        </span>
      </div>
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
                  placeholder="Why apply this modifier?"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <DiceRoller
              fixedNotation="2d6"
              fullScreen
              onTotalChange={onRarityRollTotalChange}
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Total
                </span>
                <div className="flex h-8 min-w-[60px] items-center rounded-2xl border border-border/60 bg-background/70 px-3 shadow-[0_12px_24px_rgba(5,20,24,0.25)]">
                  <p className="text-lg font-semibold text-foreground">
                    {totalWithModifier ?? "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
