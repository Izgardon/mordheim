import { useId } from "react";

import { Input } from "@components/input";
import { Label } from "@components/label";
import { cn } from "@/lib/utils";

import type { RecruitTarget } from "../../../api/beasts-api";
import type { HenchmenGroup } from "../../../types/warband-types";

/** Where recruited copies go: `group:<id>` (join it), `new` (a new group), or `keep` (as items). */
export type RecruitChoice = `group:${number}` | "new" | "keep";

const members = (group: HenchmenGroup) => {
  const count = (group.henchmen ?? []).length;
  return `${count} ${count === 1 ? "member" : "members"}`;
};

/** The groups a creature's copies can join: those recruited from the same beast. */
export const groupsOfBeast = (groups: HenchmenGroup[], beastId: number | null | undefined) =>
  beastId == null ? [] : groups.filter((group) => group.source_beast_id === beastId);

/** The first group of the beast, else a new group (the plan's mock picks the join first). */
export const defaultRecruitChoice = (groups: HenchmenGroup[]): RecruitChoice =>
  groups[0] ? `group:${groups[0].id}` : "new";

/** The choice as the server takes it (null: keep the copies as items). */
export function recruitTarget(choice: RecruitChoice, name: string): RecruitTarget | null {
  if (choice === "keep") return null;
  if (choice === "new") return { new: name.trim() ? { name: name.trim() } : {} };
  return { group_id: Number(choice.slice("group:".length)) };
}

type RecruitTargetPickerProps = {
  groups: HenchmenGroup[];
  value: RecruitChoice;
  onChange: (choice: RecruitChoice) => void;
  name: string;
  onNameChange: (name: string) => void;
  /** The new group's default name (the beast's), shown as the name field's placeholder. */
  defaultName: string;
  /** Offer "Keep as items" (buying: the copies go to the stash instead). */
  offerKeep?: boolean;
};

/** Join a group of the same beast, form a new one (its name optional), or keep the items. */
export default function RecruitTargetPicker({
  groups,
  value,
  onChange,
  name,
  onNameChange,
  defaultName,
  offerKeep = false,
}: RecruitTargetPickerProps) {
  const nameId = useId();
  const options: { choice: RecruitChoice; label: string; detail: string }[] = [
    ...groups.map((group) => ({
      choice: `group:${group.id}` as RecruitChoice,
      label: `Join ${group.name || group.unit_type || "the group"}`,
      detail: members(group),
    })),
    { choice: "new", label: "New group", detail: `named ${name.trim() || defaultName}` },
    ...(offerKeep
      ? [{ choice: "keep" as const, label: "Keep as items", detail: "in the stash" }]
      : []),
  ];
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Recruit into" className="flex flex-col gap-1">
        {options.map((option) => {
          const checked = option.choice === value;
          return (
            <button
              key={option.choice}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.choice)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                checked
                  ? "border-orange-300/70 bg-orange-300/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.detail}</span>
            </button>
          );
        })}
      </div>
      {value === "new" ? (
        <div className="space-y-1">
          <Label htmlFor={nameId}>Group name</Label>
          <Input
            id={nameId}
            value={name}
            maxLength={120}
            placeholder={defaultName}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
