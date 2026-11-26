import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";

import type { HenchmenGroup } from "../../../types/warband-types";
import { memberShare } from "../../../units/loadout";
import { missingLabel } from "../../../units/missing-games";
import MissingGamesFields from "./MissingGamesFields";
import type { KitChoice, MemberDraft, UnitEditDraft } from "./useUnitEditDraft";

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const NEXT: Record<KitChoice, KitChoice> = { buy: "stash", stash: "without", without: "buy" };

/**
 * A group's models in its edit form (henchmen loadouts). A recruit carries the loadout: each row
 * is bought with him (in his cost), taken from the stash, or he joins without it; dismissing a
 * model asks whether his share goes to the stash or leaves with him. Beside Dismiss, each saved
 * model's own Missing games (William, 25 Nov 2026: a henchman misses games on his own).
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
  const { members, setMembers, setDismissed, memberNameError } = form;
  const [asking, setAsking] = useState<number | null>(null);
  const [missingOpen, setMissingOpen] = useState<number | null>(null);
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
  const setMember = (index: number, change: Partial<MemberDraft>) =>
    setMembers((list) => list.map((m, i) => (i === index ? { ...m, ...change } : m)));

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
              aria-invalid={memberNameError(index) ? true : undefined}
              value={member.name ?? ""}
              onChange={(event) => setMember(index, { name: event.target.value })}
            />
            {member.id === undefined ? (
              <Button size="sm" variant="ghost" onClick={() => remove(index)}>
                Remove
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  aria-expanded={missingOpen === member.id}
                  aria-label={`Missing games of model ${index + 1}`}
                  onClick={() => setMissingOpen(missingOpen === member.id ? null : member.id!)}
                >
                  {Number(member.missing_games) > 0
                    ? missingLabel(Number(member.missing_games))
                    : "Missing games"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  onClick={() => setAsking(member.id!)}
                >
                  Dismiss
                </Button>
              </>
            )}
          </div>
          <FieldError message={memberNameError(index)} className="mt-0" />
          {member.id !== undefined && missingOpen === member.id ? (
            <MissingGamesFields
              label={`Model ${index + 1}`}
              games={String(member.missing_games ?? "")}
              reason={member.missing_reason ?? ""}
              onGames={(value) => setMember(index, { missing_games: value })}
              onReason={(value) => setMember(index, { missing_reason: value })}
              onDone={() => setMissingOpen(null)}
            />
          ) : null}
          {member.id !== undefined && asking === member.id ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
              <span>
                Their share (
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
                They leave with it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                Keep them
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
