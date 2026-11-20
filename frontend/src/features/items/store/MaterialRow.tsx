import { useState } from "react";

import { ItemKindIcon } from "@/components/ui/game-icons";
import { RuleBlock } from "@/features/reference/ReferenceDetail";
import { cn } from "@/lib/utils";

import type { WeaponMaterial } from "../types/item-types";
import { rarityLabel } from "../utils/item-prices";
import AcquireForm from "./AcquireForm";
import { materialRowName, type MaterialWeapon } from "./material-rows";
import MaterialWeapons from "./MaterialWeapons";
import { itemName } from "./store-items";
import type { BasketLine, Recipient } from "./useStoreBasket";

type MaterialRowProps = {
  material: WeaponMaterial;
  /** Every melee weapon the store offers, priced through the material. */
  weapons: MaterialWeapon[];
  open: boolean;
  onOpen: (open: boolean) => void;
  canBuy: boolean;
  isMobile: boolean;
  warbandId: number;
  recipients: Recipient[];
  firstKey: string | null;
  searchers: { id: number; name: string; spent: boolean }[];
  /** The bonus a rare search starts on for the weapon picked (the variant's). */
  rareBonus: (item: MaterialWeapon["offer"]["item"]) => number;
  onPick: (line: Omit<BasketLine, "id">) => void;
};

/**
 * A weapon material's row in the store (weapon materials, William 20 Nov 2026): "Gromril Weapon"
 * with its own rarity and how it prices ("4 x Price"), the server's reason when the warband isn't
 * usually allowed it, and its rules when the row is opened. Get picks the weapon it is made into,
 * and the rest is the normal acquire form, at the material's rarity.
 */
export default function MaterialRow(props: MaterialRowProps) {
  const { material } = props;
  const [shown, setShown] = useState(false);
  const [picked, setPicked] = useState<MaterialWeapon | null>(null);
  const dim = !material.can_take;
  return (
    <li className="flex flex-col gap-2.5 border-b border-line py-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-expanded={shown}
          onClick={() => setShown(!shown)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            shown && "[&_.item-name]:text-accent-hi"
          )}
        >
          <ItemKindIcon
            kind="melee"
            className={cn("h-5 w-5 text-accent-text", dim && "opacity-60")}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className={cn("item-name font-bold text-ink", dim && "opacity-60")}>
              {materialRowName(material)}
            </span>
            <span className={cn("text-xs text-muted-foreground", dim && "opacity-60")}>
              {props.isMobile ? (
                <>
                  {material.price_note} ·{" "}
                  <span className="text-accent-text">{rarityLabel(material.rarity)}</span>
                </>
              ) : (
                "Melee weapon"
              )}
            </span>
            {dim ? (
              <span className="text-xs font-semibold text-danger">{material.reason}</span>
            ) : null}
          </div>
          {props.isMobile ? null : (
            <div className={cn("flex min-w-24 shrink-0 flex-col text-right", dim && "opacity-60")}>
              <span className="whitespace-nowrap font-mono text-sm font-bold text-head">
                {material.price_note}
              </span>
              <span className="text-xs text-accent-text">{rarityLabel(material.rarity)}</span>
            </div>
          )}
        </button>
        {props.canBuy ? (
          <button
            type="button"
            aria-expanded={props.open}
            onClick={() => props.onOpen(!props.open)}
            className={cn(
              "shrink-0 border px-3 text-[13px] font-bold",
              props.isMobile ? "min-h-11 min-w-16" : "min-h-10 min-w-[72px]",
              props.open
                ? "border-border bg-transparent text-muted-foreground"
                : "border-accent-line bg-accent-soft text-accent-hi"
            )}
          >
            {props.open ? "Close" : "Get"}
          </button>
        ) : null}
      </div>
      {shown ? (
        <div className="flex flex-col gap-2.5">
          {material.rules.map((rule) => (
            <RuleBlock key={rule.name} name={rule.name}>
              {rule.text}
            </RuleBlock>
          ))}
        </div>
      ) : null}
      {props.open && !picked ? (
        <MaterialWeapons material={material} weapons={props.weapons} onPick={setPicked} />
      ) : null}
      {props.open && picked ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="self-start text-[13px] font-semibold text-accent-hi underline"
          >
            {material.name} {itemName(picked.offer.item)} · another weapon
          </button>
          <AcquireForm
            key={picked.offer.item.id}
            warbandId={props.warbandId}
            item={picked.offer.item}
            rows={picked.offer.rows}
            startBonus={props.rareBonus(picked.offer.item)}
            recipients={props.recipients}
            firstKey={props.firstKey}
            searchers={props.searchers}
            material={material}
            isMobile={props.isMobile}
            onPick={(line) => {
              props.onPick(line);
              setPicked(null);
              props.onOpen(false);
            }}
          />
        </div>
      ) : null}
    </li>
  );
}
