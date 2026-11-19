import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

import type { WeaponMaterial } from "../types/item-types";
import { rarityLabel } from "../utils/item-prices";

type MaterialChipsProps = {
  /** The four materials as the server offers them to this warband. */
  materials: WeaponMaterial[];
  /** What each one costs for the row being bought, the server's prices. */
  priceOf: (material: WeaponMaterial) => number;
  chosen: string;
  onChoose: (slug: string, material: WeaponMaterial | null) => void;
};

/**
 * What the weapon is made of (weapon materials): Plain, then each material with its price and its
 * own rarity, which is the one the purchase rolls. One the warband isn't meant to take is dimmed
 * and still pressed, and its reason shows under the row.
 */
export default function MaterialChips(props: MaterialChipsProps) {
  const picked = props.materials.find((row) => row.slug === props.chosen) ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Made of" className="flex flex-wrap gap-1.5">
        <Chip pressed={!props.chosen} onClick={() => props.onChoose("", null)}>
          Plain
        </Chip>
        {props.materials.map((material) => (
          <Chip
            key={material.slug}
            pressed={material.slug === props.chosen}
            onClick={() => props.onChoose(material.slug, material)}
            className={cn(!material.can_take && "opacity-60")}
          >
            {material.name} · {props.priceOf(material)} gc · {rarityLabel(material.rarity)}
          </Chip>
        ))}
      </div>
      {picked && !picked.can_take ? (
        <p className="m-0 text-xs font-semibold text-danger">{picked.reason}</p>
      ) : null}
    </div>
  );
}
