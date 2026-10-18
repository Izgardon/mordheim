import { Label } from "@components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import { ANY_COST, costKey, costLabel } from "../../../utils/stash-costs";

import type { StashCost } from "../../../types/warband-types";

type CostPickerProps = {
  costs?: StashCost[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
};

/**
 * Which stash copies a move or sale takes when the stash holds the item at several costs
 * (BUG-117): any (the ones that leave first) or only those of one cost. Hidden otherwise.
 */
export default function CostPicker({ costs, value, onChange, disabled }: CostPickerProps) {
  if (!costs || costs.length < 2) {
    return null;
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">Copies</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label="Copies">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_COST}>Any copies</SelectItem>
          {costs.map((entry) => (
            <SelectItem key={costKey(entry.cost)} value={costKey(entry.cost)}>
              {`${entry.quantity} at ${costLabel(entry.cost)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
