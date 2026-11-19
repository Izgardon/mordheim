import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useWhoCan } from "../api/who-can-queries";
import type { WeaponMaterial } from "../types/item-types";

/**
 * A material the book lets a warband put on a weapon it already owns (weapon materials: silver
 * only, "To silver a weapon the warband already owns, roll the rarity all the same and pay 80 gc
 * in all"). One the warband isn't meant to take is dimmed and still works, warning when pressed.
 */
export function useOwnedMaterials(campaignId: number, warbandId: number) {
  const { materials } = useWhoCan(campaignId, warbandId);
  return materials.filter((material) => material.on_owned != null);
}

type MaterialButtonProps = {
  material: WeaponMaterial;
  onApply: () => void;
};

export default function MaterialButton({ material, onApply }: MaterialButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(!material.can_take && "opacity-60")}
      onClick={() => {
        if (!material.can_take) toast.warning(material.reason);
        onApply();
      }}
    >
      {material.name} · {material.on_owned} gc
    </Button>
  );
}
