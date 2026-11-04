import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

import type { TemplateFighter, TemplateList } from "../../types/hire-template-types";
import HireKit from "./HireKit";
import HireTally from "./HireTally";
import {
  fighterLines,
  kitPurchases,
  listNames,
  listPrice,
  overCount,
  overGroup,
  pickKey,
  unpriced,
  type KitPick,
} from "./hire-draft";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/** What a template hire sends: the fighter, the name, a group's models, his cost and the kit's purchases. */
export type TemplateHire = {
  fighter: TemplateFighter;
  name: string;
  models: number;
  cost: string;
  purchases: ReturnType<typeof kitPurchases>;
};

/**
 * The rest of a hire once Recruit as picked a template fighter: his name (a group's models,
 * warning past its size), the kit from his lists, and the tally. The server fills his type,
 * race, profile, skills, spells, rules and starting XP, and gives the free dagger.
 */
export default function TemplateRecruit({
  fighter,
  lists,
  listPricesOpen,
  gold,
  saving,
  onRecruit,
  onCancel,
}: {
  fighter: TemplateFighter;
  lists: TemplateList[];
  listPricesOpen: boolean;
  gold: number;
  saving: boolean;
  onRecruit: (hire: TemplateHire) => void;
  onCancel: () => void;
}) {
  const group = fighter.kind === "henchman";
  const lines = fighterLines(fighter, lists);
  const [name, setName] = useState("");
  const [models, setModels] = useState(String(fighter.group_min || 1));
  const [cost, setCost] = useState(String(fighter.cost));
  const [picks, setPicks] = useState<KitPick[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const count = group ? Math.max(1, Math.min(20, Math.trunc(Number(models) || 1))) : 1;
  const warnings = [overCount(fighter, count), group ? overGroup(fighter, count) : null].filter(
    Boolean
  );

  const toggle = (pick: KitPick) => {
    const key = pickKey(pick);
    if (picks.some((entry) => pickKey(entry) === key)) {
      setPicks(picks.filter((entry) => pickKey(entry) !== key));
      return;
    }
    const line = lines.find((entry) => entry.id === pick.lineId);
    const price = line ? listPrice(line, pick.brace) : null;
    setPicks([...picks, pick]);
    setPrices({ ...prices, [key]: price === null ? "" : String(price) });
  };

  return (
    <form
      aria-label={`Recruit a ${fighter.name}`}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onRecruit({
          fighter,
          name,
          models: count,
          cost,
          purchases: kitPurchases(picks, prices, lines),
        });
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className={LABEL}>
          Name
          <Input
            inputSize="sm"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {group ? (
          <label className={LABEL}>
            Models
            <NumberInput
              inputSize="sm"
              min={1}
              max={20}
              value={models}
              onChange={(event) => setModels(event.target.value)}
            />
          </label>
        ) : null}
      </div>
      {warnings.map((warning) => (
        <p key={warning} className="m-0 text-xs font-semibold text-danger">
          {warning}
        </p>
      ))}
      <HireKit
        lists={listNames(fighter, lists)}
        lines={lines}
        offLines={fighter.off_lines}
        open={listPricesOpen}
        picks={listPricesOpen ? picks : []}
        onToggle={toggle}
      />
      <HireTally
        name={group ? fighter.plural || fighter.name : fighter.name}
        members={count}
        cost={cost}
        onCost={setCost}
        picks={listPricesOpen ? picks : []}
        lines={lines}
        prices={prices}
        onPrice={(key, value) => setPrices({ ...prices, [key]: value })}
        freeItem={fighter.free_item}
        gold={gold}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || unpriced(picks, prices)}>
          Recruit
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
