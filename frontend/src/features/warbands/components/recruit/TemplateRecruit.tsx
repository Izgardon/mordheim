import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { NUMBER_INPUT_HEIGHT, NumberInput } from "@/components/ui/number-input";

import type {
  TemplateFighter,
  TemplateList,
  TemplateUpgrade,
} from "../../types/hire-template-types";
import HireKit from "./HireKit";
import HireTally from "./HireTally";
import HireUpgrades from "./HireUpgrades";
import MemberNames, { useMemberNames } from "./MemberNames";
import RecruitNameField, { useRecruitName } from "./RecruitNameField";
import {
  fighterLines,
  kitPurchases,
  listNames,
  listPrice,
  memberPrefill,
  overCount,
  overGroup,
  pickKey,
  unpriced,
  type KitPick,
} from "./hire-draft";
import { atHire } from "./upgrade-draft";
import { useUpgradePicks } from "./useUpgradePicks";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/** What a template hire sends: the fighter, the name, a group's members' names, his cost, the kit and his upgrades. */
export type TemplateHire = {
  fighter: TemplateFighter;
  name: string;
  /** A group's members, one name per model; none for a hero. */
  members: string[];
  cost: string;
  purchases: ReturnType<typeof kitPurchases>;
  upgrades: { create_index: number; upgrade_id: number; price: number }[];
};

/**
 * The rest of a hire once Recruit as picked a template fighter: his name (a group's models,
 * warning past its size, and each model's name), the kit from his lists, a hero's upgrades (before and after the first
 * battle: the book sells them on recruitment), and the tally. The server fills his type,
 * race, profile, skills, spells, rules and starting XP, and gives the "1st free" items.
 */
export default function TemplateRecruit({
  fighter,
  lists,
  upgrades = [],
  listPricesOpen,
  gold,
  saving,
  onRecruit,
  onCancel,
}: {
  fighter: TemplateFighter;
  lists: TemplateList[];
  /** The template's upgrades: a hero's section, none for a group. */
  upgrades?: TemplateUpgrade[];
  listPricesOpen: boolean;
  gold: number;
  saving: boolean;
  onRecruit: (hire: TemplateHire) => void;
  onCancel: () => void;
}) {
  const group = fighter.kind === "henchman";
  const lines = fighterLines(fighter, lists);
  const name = useRecruitName();
  const [models, setModels] = useState(String(fighter.group_min || 1));
  const ids = useId();
  const [cost, setCost] = useState(String(fighter.cost));
  const [picks, setPicks] = useState<KitPick[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  // a hero's upgrades, less the ones a skill gives (the Beastmen's mutations): the store sells those
  const offered = atHire(upgrades);
  const bought = useUpgradePicks(group ? [] : offered);
  const count = group ? Math.max(1, Math.min(20, Math.trunc(Number(models) || 1))) : 1;
  const members = useMemberNames(group ? count : 0, memberPrefill(fighter));
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
    const price = line ? listPrice(line, pick.brace, pick.itemId) : null;
    setPicks([...picks, pick]);
    setPrices({ ...prices, [key]: price === null ? "" : String(price) });
  };

  return (
    <form
      aria-label={`Recruit a ${fighter.name}`}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const named = name.ready();
        if (!members.ready(named) || !named) return;
        onRecruit({
          fighter,
          name: name.name,
          members: members.names,
          cost,
          purchases: kitPurchases(picks, prices, lines),
          upgrades: bought.lines(),
        });
      }}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2">
        {/* a group's name: "Group name", as tall as the Models stepper beside it (William, 28 Nov 2026) */}
        <RecruitNameField
          field={name}
          label={group ? "Group name" : "Name"}
          className={LABEL}
          inputSize="sm"
          inputClassName={NUMBER_INPUT_HEIGHT.sm}
          autoFocus
        />
        {group ? (
          <label htmlFor={`${ids}-models`} className={LABEL}>
            Models
            <NumberInput
              id={`${ids}-models`}
              inputSize="sm"
              compact
              min={1}
              max={20}
              value={models}
              onChange={(event) => setModels(event.target.value)}
            />
          </label>
        ) : null}
      </div>
      <MemberNames field={members} />
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
      {group ? null : (
        <HireUpgrades upgrades={offered} offUpgrades={fighter.off_upgrades} picks={bought} />
      )}
      <HireTally
        name={group ? fighter.plural || fighter.name : fighter.name}
        members={count}
        cost={cost}
        onCost={setCost}
        picks={listPricesOpen ? picks : []}
        lines={lines}
        prices={prices}
        onPrice={(key, value) => setPrices({ ...prices, [key]: value })}
        freeItems={fighter.free_items}
        upgrades={bought.picks}
        onUpgradePrice={bought.setPrice}
        gold={gold}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || unpriced(picks, prices) || bought.unpriced}>
          Recruit
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
