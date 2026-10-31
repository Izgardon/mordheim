import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogKicker,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import { toastServerWarnings } from "../../utils/server-warnings";
import type { UnitKindKey } from "../../types/units";
import { LIST_KEY } from "./unit-view";

const TITLES: Record<UnitKindKey, { kicker: string; title: string; cost: string }> = {
  hero: { kicker: "Recruit", title: "Add a hero", cost: "Cost" },
  henchmen_group: { kicker: "Recruit", title: "Add a group", cost: "Cost each" },
  hireling: { kicker: "Hire", title: "Hire a sword", cost: "Hire fee" },
};

/**
 * Recruits a hero or a group, or hires a sword, with what the roster needs to start: a name, a
 * type, a cost and (for a group) how many models. The rest is set in the unit's Edit.
 */
export default function RecruitDialog({
  kind,
  warbandId,
  onClose,
}: {
  kind: UnitKindKey | null;
  warbandId: number;
  onClose: () => void;
}) {
  const updateCache = useWarbandCacheUpdate();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [cost, setCost] = useState("");
  const [count, setCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const copy = kind ? TITLES[kind] : TITLES.hero;

  const recruit = async () => {
    if (!kind) return;
    setSaving(true);
    const models = Math.max(1, Math.min(20, Number(count) || 1));
    const body = {
      name: name.trim() || null,
      unit_type: type.trim() || null,
      race: null,
      price: Number(cost) || 0,
      xp: 0,
      ...(kind === "henchmen_group"
        ? {
            henchmen: Array.from({ length: models }, (_, i) => ({
              name: `${type.trim() || "Henchman"} ${i + 1}`,
            })),
          }
        : {}),
    };
    try {
      const result = await unitApi(kind).batch(warbandId, { create: [body as never] });
      updateCache(warbandId, {
        [LIST_KEY[kind]]: result.units,
        summary: result.summary,
      } as WarbandUpdate);
      toastServerWarnings(result.warnings);
      setName("");
      setType("");
      setCost("");
      setCount("1");
      onClose();
    } catch (error) {
      toast.error("Couldn't recruit.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogKicker>{copy.kicker}</DialogKicker>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <form
          id="recruit-form"
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void recruit();
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Name
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Type
            <Input
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="Champion, Marksmen"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            {copy.cost}
            <Input
              inputMode="numeric"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              placeholder="gc"
            />
          </label>
          {kind === "henchmen_group" ? (
            <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
              Models
              <Input
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </label>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="recruit-form" disabled={saving}>
            {kind === "hireling" ? "Hire" : "Recruit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
