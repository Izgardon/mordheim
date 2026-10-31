import type { ReactNode } from "react";
import { Check, Dices } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rollDice } from "@/lib/dice";
import { cn } from "@/lib/utils";

import { dueText, upkeepCharged, upkeepLines } from "./camp-state";
import type { CampRow, OpenCamp } from "./camp-types";
import { campDone } from "./PostgameBar";
import UpkeepRows from "./UpkeepRows";

type RowProps = {
  id: CampRow;
  title: string;
  sub: string;
  action?: string;
  primary?: boolean;
  dice?: boolean;
  done?: boolean;
  onAction?: () => void;
  focused: boolean;
  isMobile: boolean;
  children?: ReactNode;
};

function Row(props: RowProps) {
  return (
    <li
      id={`camp-row-${props.id}`}
      className={cn(
        "flex flex-col border-t border-line",
        props.focused && "bg-accent-soft shadow-[inset_2px_0_0_var(--color-accent)]"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2.5",
          props.isMobile ? "min-h-[52px] py-1 pl-2.5 pr-1.5" : "py-[11px] pl-1.5 pr-1"
        )}
      >
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 font-bold text-ink">
            {props.title}
            {props.done ? (
              <Check className="h-[13px] w-[13px] text-good" strokeWidth={2.5} aria-label="Done" />
            ) : null}
          </span>
          <span className="text-xs text-muted-foreground">{props.sub}</span>
        </div>
        {props.action ? (
          <Button
            size="sm"
            variant={props.primary ? "primary" : "secondary"}
            className={cn("shrink-0", props.isMobile ? "h-10" : "h-9")}
            onClick={props.onAction}
          >
            {props.dice ? <Dices aria-hidden="true" /> : null}
            {props.action}
          </Button>
        ) : null}
      </div>
      {props.children}
    </li>
  );
}

/**
 * Camp's rows (design E), top to bottom: Sell, Veterans (roll 2D6 for the XP pool, then Recruit),
 * Hired swords (Hire), Upkeep (Pay all, and Pay or Let go per hired sword) and Buy items.
 */
export default function CampRows({
  camp,
  onSell,
  onRecruit,
}: {
  camp: OpenCamp;
  onSell: () => void;
  onRecruit: () => void;
}) {
  const record = camp.draft.camp ?? {};
  const done = campDone(camp);
  const vet = record.veterans;
  const pool = vet ? vet.dice[0] + vet.dice[1] - vet.spent : 0;
  const lines = upkeepLines(camp);
  const lastSale = record.sold?.[record.sold.length - 1];
  const maxHired = camp.campaign?.max_hired_swords;
  const withCamp = (next: typeof record) => camp.save({ ...camp.draft, camp: next });
  const setPaid = (keys: string[]) => {
    const entries = { ...camp.draft.upkeep.entries };
    for (const key of keys) entries[key] = { ...entries[key], paid: true };
    void camp.save({ ...camp.draft, upkeep: { ...camp.draft.upkeep, entries } });
  };
  const row = (id: CampRow) => ({ id, focused: camp.focus === id, isMobile: camp.isMobile });

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      <Row
        {...row("sell")}
        title="Sell"
        sub={
          lastSale
            ? `Sold ${lastSale.quantity} ${lastSale.name} for ${lastSale.gold} gc`
            : "Sell resource"
        }
        action="Sell"
        done={done.sell}
        onAction={onSell}
      />
      <Row
        {...row("recruit")}
        title="Veterans"
        sub={vet ? `${pool} XP available` : "Roll for available XP"}
        action={vet ? "Recruit" : "2D6"}
        dice={!vet}
        primary={Boolean(vet) && !done.recruit}
        done={done.recruit}
        onAction={
          vet
            ? onRecruit
            : () => void withCamp({ ...record, veterans: { dice: rollDice(2), spent: 0 } })
        }
      />
      <Row
        {...row("hire")}
        title="Hired swords"
        sub={`${camp.hirelings.length}${maxHired ? ` of ${maxHired}` : ""}`}
        action="Hire"
        onAction={camp.onHire}
      />
      <Row
        {...row("upkeep")}
        title="Upkeep"
        sub={
          !lines.length
            ? "No hired swords to pay"
            : lines.some((line) => line.status === "due")
              ? `${dueText(lines)} due, charged at Ready`
              : "Settled"
        }
        action={lines.some((line) => line.status === "due") ? "Pay all" : undefined}
        done={done.upkeep}
        onAction={() =>
          setPaid(lines.filter((line) => line.status === "due").map((line) => line.key))
        }
      >
        <UpkeepRows camp={camp} lines={lines} />
      </Row>
      <Row
        {...row("buy")}
        title="Buy items"
        done={done.buy}
        sub={`${camp.gold - upkeepCharged(camp)} gc to spend`}
        action="Store"
        onAction={camp.onStore}
      />
    </ul>
  );
}
