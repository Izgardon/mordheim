import { useMemo } from "react";
import { X } from "lucide-react";

import { SearchCombobox } from "@/components/ui/search-select";
import { Switch } from "@/components/ui/switch";
import { useWarbandGroups } from "@/features/items/api/who-can-queries";
import { useWarbandTypes } from "@/features/warbands/api/warband-types-queries";
import { cn } from "@/lib/utils";

import {
  addLine,
  removeLine,
  toggleExcluded,
  type AccessDraft,
  type WhoCanDraft,
} from "../utils/who-can-draft";

type WhoCanFieldProps = {
  campaignId: number;
  value: WhoCanDraft;
  onChange: (value: WhoCanDraft) => void;
  /** "Who can buy", "Who can hire". */
  label: string;
  id: string;
};

/**
 * A who-can list (the items rebuild): for everyone, or warband types and groups, each may or may
 * not. Lines are found by name among the campaign's types (the book's and its own) and the
 * groups; a line added while the list is for everyone is an exclusion ("Everyone except Skaven").
 */
export default function WhoCanField({ campaignId, value, onChange, label, id }: WhoCanFieldProps) {
  const types = useWarbandTypes(campaignId).data;
  const groups = useWarbandGroups().data;
  const options = useMemo(
    () => [
      ...(groups ?? []).map((group) => ({
        kind: "group" as const,
        id: group.id,
        name: group.name,
      })),
      ...(types ?? []).map((type) => ({
        kind: "type" as const,
        id: type.id,
        name: type.name,
        hint: type.source_code || type.setting?.name || "",
      })),
    ],
    [groups, types]
  );
  const taken = (option: Pick<AccessDraft, "kind" | "id">) =>
    value.lines.some((line) => line.kind === option.kind && line.id === option.id);
  const key = (option: { kind: string; id: number }) => `${option.kind}-${option.id}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <Switch
          checked={value.forEveryone}
          onCheckedChange={(forEveryone) => onChange({ ...value, forEveryone })}
        >
          For everyone
        </Switch>
      </div>
      {value.lines.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {value.lines.map((line, index) => (
            <li
              key={`${line.kind}-${line.id}`}
              className={cn(
                "flex items-center gap-1 border px-2 py-1 text-xs font-semibold",
                line.excluded ? "border-danger-line text-danger" : "border-accent-line text-ink"
              )}
            >
              <button
                type="button"
                onClick={() => onChange(toggleExcluded(value, index))}
                aria-label={`${line.excluded ? "Let" : "Shut out"} ${line.name}`}
                className="hover:underline"
              >
                {line.excluded ? `not ${line.name}` : line.name}
                {line.kind === "group" ? " (group)" : ""}
              </button>
              <button
                type="button"
                onClick={() => onChange(removeLine(value, index))}
                aria-label={`Remove ${line.name}`}
                className="text-muted-foreground hover:text-head"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <SearchCombobox
        id={id}
        label={`${label}: add a warband type or group`}
        placeholder={value.forEveryone ? "Shut out a warband or group…" : "Add a warband or group…"}
        emptyText="No warband type or group matches."
        options={options
          .filter((option) => !taken(option))
          .map((option) => ({
            id: key(option),
            title: option.name,
            subtitle: option.kind === "group" ? "Group" : option.hint,
          }))}
        onPick={(picked) => {
          const option = options.find((entry) => key(entry) === picked.id);
          if (option) onChange(addLine(value, option));
        }}
      />
    </div>
  );
}
