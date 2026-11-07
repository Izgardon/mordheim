import { useMemo } from "react";
import { X } from "lucide-react";

import { SearchCombobox } from "@/components/ui/search-select";
import { useWarbandGroups } from "@/features/items/api/who-can-queries";
import { lineNames } from "@/features/items/utils/item-prices";
import { useWarbandTypes } from "@/features/warbands/api/warband-types-queries";
import { cn } from "@/lib/utils";

import {
  addLine,
  isMixed,
  modeOf,
  removeLine,
  whoCanMeaning,
  withMode,
  type AccessDraft,
  type WhoCanDraft,
  type WhoCanMode,
} from "../utils/who-can-draft";

type WhoCanFieldProps = {
  campaignId: number;
  value: WhoCanDraft;
  onChange: (value: WhoCanDraft) => void;
  /** "Who can buy", "Who can hire". */
  label: string;
  id: string;
};

const MODES: { mode: WhoCanMode; label: string }[] = [
  { mode: "exclude", label: "Exclude" },
  { mode: "include", label: "Include" },
];

/**
 * A who-can list (William, 7 Nov 2026: "all Who can buy sections toggle should be Exclude
 * (default on) and Include, with input text saying what it does and what it means if nothing
 * there is added"): Exclude lets in everyone but the warband types and groups added, Include only
 * those, and the line under the toggle says which ("Everyone except these", "No one"). Lines are
 * found by name among the campaign's types (the book's and its own) and the groups. A list with
 * lines that say the opposite (from before the toggle) shows them as they are, "not Skaven".
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
        sourceCode: type.source_code,
        hint: type.source_code || type.setting?.name || "",
      })),
    ],
    [groups, types]
  );
  const taken = (option: Pick<AccessDraft, "kind" | "id">) =>
    value.lines.some((line) => line.kind === option.kind && line.id === option.id);
  const key = (option: { kind: string; id: number }) => `${option.kind}-${option.id}`;
  const labels = lineNames(value.lines.map((line) => ({ ...line, source_code: line.sourceCode })));
  const mode = modeOf(value);
  const meaningId = `${id}-meaning`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-xs font-bold text-muted-foreground">
          {label}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-label`}
          aria-describedby={meaningId}
          className="flex border border-strong"
        >
          {MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={mode === option.mode}
              onClick={() =>
                mode === option.mode ? undefined : onChange(withMode(value, option.mode))
              }
              className={cn(
                "min-h-8 border-r border-strong px-3 text-[13px] last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                mode === option.mode
                  ? "bg-accent-soft font-bold text-accent-hi"
                  : "font-semibold text-text2 hover:bg-raised hover:text-ink"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p id={meaningId} className="m-0 text-xs text-text2">
        {whoCanMeaning(value)}
        {isMixed(value) ? (
          <span className="text-danger">
            {" "}
            · some lines say otherwise; switching makes them all match
          </span>
        ) : null}
      </p>
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
              <span>
                {line.excluded ? `not ${labels[index]}` : labels[index]}
                {line.kind === "group" ? " (group)" : ""}
              </span>
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
        placeholder={
          mode === "exclude"
            ? "Exclude a warband type or group…"
            : "Include a warband type or group…"
        }
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
