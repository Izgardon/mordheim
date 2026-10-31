import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useAddWarbandType, useWarbandTypes } from "../../api/warband-types-queries";
import type { WarbandTypeBrief, WarbandTypeRow } from "../../types/warband-types";
import { pickerRows, typeMeta, typeWarning } from "./warband-type-picker";

const CAPTION = "px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

type WarbandTypePickerProps = {
  campaignId: number;
  /** The input's id, for its label. */
  id: string;
  /** The type picked so far, shown with Change; null shows the search. */
  value: WarbandTypeBrief | null;
  onPick: (type: WarbandTypeRow) => void;
  /** Types not to offer (what a warband already counts as). */
  hidden?: number[];
  placeholder?: string;
};

/** A type's grade: accent while it is in play, plain outside. */
function GradeBadge({ type, dim }: { type: WarbandTypeBrief; dim?: boolean }) {
  if (!type.setting) return null;
  return (
    <span
      className={cn(
        "shrink-0 border px-1.5 font-mono text-[11px] leading-5",
        dim ? "border-border text-muted-foreground" : "border-accent-line text-accent-text"
      )}
    >
      {type.setting.grade}
    </span>
  );
}

function TypeOption({ type, onPick }: { type: WarbandTypeRow; onPick: () => void }) {
  const warning = typeWarning(type);
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col gap-0.5 bg-transparent px-3 py-2 text-left hover:bg-raised focus-visible:bg-raised focus-visible:outline-none"
      >
        <span className="flex items-center justify-between gap-3">
          <span className={cn("text-sm font-semibold", warning ? "text-text2" : "text-head")}>
            {type.name}
          </span>
          <GradeBadge type={type} dim={Boolean(warning)} />
        </span>
        <span className="text-xs text-muted-foreground">{typeMeta(type)}</span>
        {warning ? <span className="text-xs font-semibold text-danger">{warning}</span> : null}
      </button>
    </li>
  );
}

/**
 * The searchable warband type picker (grading phase 1, v5's mock): types in the campaign's
 * settings first, the rest greyed out with a warning and still pickable, and a name nobody has
 * added as the campaign's own type, which every player there can pick.
 */
export default function WarbandTypePicker(props: WarbandTypePickerProps) {
  const { campaignId, value, onPick } = props;
  const { data: types, isLoading } = useWarbandTypes(campaignId);
  const addType = useAddWarbandType(campaignId);
  const [searching, setSearching] = useState(!value);
  const [typed, setTyped] = useState("");
  const rows = useMemo(
    () => pickerRows(types ?? [], typed, props.hidden),
    [types, typed, props.hidden]
  );
  const current = value ? (types ?? []).find((type) => type.id === value.id) : undefined;

  const pick = (type: WarbandTypeRow) => {
    onPick(type);
    setTyped("");
    setSearching(false);
  };
  const addCustom = async () => {
    try {
      pick(await addType.mutateAsync({ name: rows.custom }));
    } catch (error) {
      toast.error("Couldn't add the warband type.", { description: getErrorMessage(error) });
    }
  };

  if (value && !searching) {
    const warning = current ? typeWarning(current) : "";
    return (
      <div className="flex items-start justify-between gap-3 border border-border bg-page px-3 py-2.5">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[15px] font-bold text-head">
            {value.name}
            <GradeBadge type={value} dim={Boolean(warning)} />
          </span>
          <span className="text-xs text-muted-foreground">{typeMeta(value)}</span>
          {warning ? <span className="text-xs font-semibold text-danger">{warning}</span> : null}
        </span>
        <Button variant="secondary" className="shrink-0" onClick={() => setSearching(true)}>
          Change
        </Button>
      </div>
    );
  }

  const empty = !rows.inPlay.length && !rows.outside.length && !rows.custom;
  return (
    <div className="flex flex-col gap-2">
      <Input
        id={props.id}
        value={typed}
        autoFocus={Boolean(value)}
        autoComplete="off"
        onChange={(event) => setTyped(event.target.value)}
        placeholder={props.placeholder ?? "Search: Reiklanders, Skaven, Khemri…"}
        className="h-11 text-base md:h-11"
      />
      <div className="max-h-72 overflow-y-auto border border-border bg-page">
        {isLoading ? (
          <p className="m-0 px-3 py-3 text-sm text-text2">Loading warband types…</p>
        ) : null}
        {rows.inPlay.length ? (
          <>
            <div className={CAPTION}>In this campaign</div>
            <ul aria-label="Warband types in this campaign" className="m-0 list-none p-0">
              {rows.inPlay.map((type) => (
                <TypeOption key={type.id} type={type} onPick={() => pick(type)} />
              ))}
            </ul>
          </>
        ) : null}
        {rows.outside.length ? (
          <>
            <div className={cn(CAPTION, "border-t border-line")}>Outside this campaign</div>
            <ul aria-label="Warband types outside this campaign" className="m-0 list-none p-0">
              {rows.outside.map((type) => (
                <TypeOption key={type.id} type={type} onPick={() => pick(type)} />
              ))}
            </ul>
          </>
        ) : null}
        {rows.custom ? (
          <button
            type="button"
            disabled={addType.isPending}
            onClick={() => void addCustom()}
            className="flex w-full items-center gap-2 border-t border-line bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-accent-text hover:bg-raised"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            Add “{rows.custom}” as a custom warband type
          </button>
        ) : null}
        {!isLoading && empty ? (
          <p className="m-0 px-3 py-3 text-sm text-text2">Type a name to find a warband type.</p>
        ) : null}
      </div>
      {value ? (
        <Button variant="ghost" className="self-start" onClick={() => setSearching(false)}>
          Keep {value.name}
        </Button>
      ) : null}
    </div>
  );
}
