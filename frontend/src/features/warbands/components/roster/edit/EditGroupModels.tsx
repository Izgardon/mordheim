import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";

import type { HenchmenGroup } from "../../../types/warband-types";
import { memberShare } from "../../../units/loadout";
import type { KitChoice, MemberDraft, UnitEditDraft } from "./useUnitEditDraft";

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const NEXT: Record<KitChoice, KitChoice> = { buy: "stash", stash: "without", without: "buy" };

/**
 * A group's models in its edit form (henchmen loadouts). A recruit carries the loadout: each row
 * is bought with him (in his cost), taken from the stash, or he joins without it; removing a model
 * asks whether his share goes to the stash or leaves with him.
 */
export default function EditGroupModels({
  group,
  form,
  unitType,
}: {
  group: HenchmenGroup;
  form: UnitEditDraft;
  unitType: string;
}) {
  const { members, setMembers, setDismissed } = form;
  const [asking, setAsking] = useState<number | null>(null);
  const rows = group.items;

  const kitLabel = (choice: KitChoice, cost: number | null | undefined) =>
    choice === "buy"
      ? `buy · ${cost ?? 0} gc`
      : choice === "stash"
        ? "from the stash"
        : "goes without";

  const recruitCost = (member: MemberDraft) => {
    const kept = rows.reduce((sum, row) => {
      const choice = member.kit?.[row.row_id ?? 0] ?? "buy";
      return choice === "buy" ? sum : sum + (row.cost ?? 0);
    }, 0);
    return (group.hire_cost ?? 0) - kept;
  };

  const setKit = (index: number, rowId: number, choice: KitChoice) =>
    setMembers((list) =>
      list.map((m, i) => (i === index ? { ...m, kit: { ...m.kit, [rowId]: choice } } : m))
    );

  const remove = (index: number) => setMembers((list) => list.filter((_, i) => i !== index));

  const dismissWith = (index: number, id: number, share: "stash" | "leaves") => {
    setDismissed((current) => ({ ...current, [id]: share }));
    setAsking(null);
    remove(index);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className={SECTION_LABEL}>Models</span>
      {members.map((member, index) => (
        <div key={member.id ?? `new-${index}`} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Input
              inputSize="sm"
              aria-label={`Model ${index + 1} name`}
              value={member.name ?? ""}
              onChange={(event) =>
                setMembers((list) =>
                  list.map((m, i) => (i === index ? { ...m, name: event.target.value } : m))
                )
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (member.id === undefined ? remove(index) : setAsking(member.id))}
            >
              Remove
            </Button>
          </div>
          {member.id !== undefined && asking === member.id ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
              <span>
                His share (
                {memberShare(group, member)
                  .map((row) => row.name)
                  .join(", ") || "nothing"}
                ):
              </span>
              <Button size="sm" onClick={() => dismissWith(index, member.id!, "stash")}>
                To the stash
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => dismissWith(index, member.id!, "leaves")}
              >
                He leaves with it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                Keep him
              </Button>
            </div>
          ) : null}
          {member.id === undefined && rows.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {rows.map((row) => {
                const rowId = row.row_id ?? 0;
                const choice = member.kit?.[rowId] ?? "buy";
                return (
                  <Chip
                    key={rowId}
                    pressed={choice !== "buy"}
                    className="min-h-[28px] px-2 text-xs"
                    onClick={() => setKit(index, rowId, NEXT[choice])}
                  >
                    {row.name} · {kitLabel(choice, row.cost)}
                  </Chip>
                );
              })}
              <span className="font-mono text-xs text-muted-foreground">
                Recruit {recruitCost(member)} gc
              </span>
            </div>
          ) : null}
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={() =>
          setMembers((list) => [...list, { name: `${unitType || "Henchman"} ${list.length + 1}` }])
        }
      >
        Add a model
      </Button>
    </div>
  );
}
