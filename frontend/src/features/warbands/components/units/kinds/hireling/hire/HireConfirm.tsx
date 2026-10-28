import { useState } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { formatHirelingCost } from "@/features/hirelings/hireling-catalogue-kinds";
import { personaTermsLine } from "@/features/hirelings/utils/hireling-display";

import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";

type Props = {
  entry: HirelingProfile;
  isPersona: boolean;
  availableGold: number;
  isHiring: boolean;
  error: string;
  onHire: (name: string) => void;
  onBack: () => void;
};

/** What a fee costs: gold and what is left, or a fee in something else, which takes no gold. */
function feeLine(entry: HirelingProfile, availableGold: number) {
  if (entry.hire_cost !== null && entry.hire_cost > 0) {
    return `Costs ${entry.hire_cost} gc, leaving ${availableGold - entry.hire_cost} gc.`;
  }
  if (entry.hire_cost_expression) {
    return `Fee: ${entry.hire_cost_expression}. It isn't gold, so no gold is taken.`;
  }
  return "No fee.";
}

/**
 * The second step of a hire: the one picked, a name for him (the catalogue's by default), what the
 * fee takes, the upkeep after each battle, a dramatis persona's terms, and Hire.
 */
export default function HireConfirm({
  entry,
  isPersona,
  availableGold,
  isHiring,
  error,
  onHire,
  onBack,
}: Props) {
  const [name, setName] = useState(entry.name);
  const terms = isPersona ? personaTermsLine(entry) : "";
  const overspends = entry.hire_cost !== null && entry.hire_cost > availableGold;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onHire(name.trim());
      }}
    >
      <p className="font-display text-lg text-foreground">{entry.name}</p>
      <div className="space-y-1.5">
        <Label htmlFor="hire-name">Name</Label>
        <Input
          id="hire-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          placeholder={entry.name}
        />
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p className={overspends ? "text-amber-200" : undefined}>{feeLine(entry, availableGold)}</p>
        <p>
          Upkeep after each battle:{" "}
          {formatHirelingCost(entry.upkeep_cost, entry.upkeep_cost_expression)}
        </p>
        {terms ? <p>{terms}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onBack} disabled={isHiring}>
          Back
        </Button>
        <Button type="submit" disabled={isHiring}>
          {isHiring ? "Hiring..." : `Hire ${name.trim() || entry.name}`}
        </Button>
      </div>
    </form>
  );
}
