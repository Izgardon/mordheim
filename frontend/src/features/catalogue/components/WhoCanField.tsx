import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
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

const MATCHES = 8;

/**
 * A who-can list (the items rebuild): for everyone, or warband types and groups, each may or may
 * not. Lines are found by name among the campaign's types (the book's and its own) and the
 * groups; a line added while the list is for everyone is an exclusion ("Everyone except Skaven").
 */
export default function WhoCanField({ campaignId, value, onChange, label, id }: WhoCanFieldProps) {
  const [query, setQuery] = useState("");
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
  const needle = query.trim().toLowerCase();
  const taken = (option: Pick<AccessDraft, "kind" | "id">) =>
    value.lines.some((line) => line.kind === option.kind && line.id === option.id);
  const matches = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle) && !taken(option))
    : [];

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
      <Input
        id={id}
        inputSize="sm"
        type="search"
        aria-label={`${label}: add a warband type or group`}
        placeholder={value.forEveryone ? "Shut out a warband or group…" : "Add a warband or group…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.length ? (
        <ul className="m-0 flex max-h-48 list-none flex-col overflow-y-auto border border-line p-0">
          {matches.slice(0, MATCHES).map((option) => (
            <li key={`${option.kind}-${option.id}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(addLine(value, option));
                  setQuery("");
                }}
                className="flex w-full items-baseline justify-between gap-3 px-2 py-1.5 text-left text-[13px] hover:bg-raised"
              >
                <span className="font-semibold text-ink">{option.name}</span>
                <span className="text-xs text-muted-foreground">
                  {option.kind === "group" ? "Group" : "hint" in option ? option.hint : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
