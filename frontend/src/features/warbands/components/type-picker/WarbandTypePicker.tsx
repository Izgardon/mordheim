import { toast } from "sonner";

import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { useOwnWords } from "@/features/reference/own-words";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useAddWarbandType, useWarbandTypes } from "../../api/warband-types-queries";
import type { WarbandTypeBrief, WarbandTypeRow } from "../../types/warband-types";
import { pickerRows, typeMeta, typeWarning } from "./warband-type-picker";

type WarbandTypePickerProps = {
  campaignId: number;
  /** The input's id, for its label. */
  id: string;
  /** The type picked so far; null shows the search. */
  value: WarbandTypeBrief | null;
  onPick: (type: WarbandTypeRow) => void;
  /** Types not to offer (what a warband already counts as). */
  hidden?: number[];
  placeholder?: string;
  /** Offers a typed name as the campaign's own type (not in a workshop, which adds none). */
  canAdd?: boolean;
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

/** A type on the picker, under "In this campaign" or "Outside this campaign" (`place`). */
function typeOption(type: WarbandTypeBrief, place: string, row?: WarbandTypeRow): SearchOption {
  const warning = row ? typeWarning(row) : "";
  return {
    id: type.id,
    title: type.name,
    subtitle: typeMeta(type),
    warning,
    group: `${row?.in_play === false ? "Outside" : "In"} ${place}`,
    keywords: row ? [row.race, row.setting?.name ?? "", row.source_code].join(" ") : undefined,
    aside: <GradeBadge type={type} dim={Boolean(warning)} />,
  };
}

/**
 * The warband type on the searchable select (grading phase 1): types in the campaign's settings
 * first, the rest greyed out with a warning and still pickable, and a name nobody has added as
 * the campaign's own type, which every player there can pick.
 */
export default function WarbandTypePicker(props: WarbandTypePickerProps) {
  const { campaignId, value, onPick } = props;
  const { data: types, isLoading } = useWarbandTypes(campaignId);
  const addType = useAddWarbandType(campaignId);
  const { place } = useOwnWords();
  const all = types ?? [];
  const rows = pickerRows(all, "", props.hidden);
  const options = [...rows.inPlay, ...rows.outside].map((type) => typeOption(type, place, type));
  const current = value ? all.find((type) => type.id === value.id) : undefined;

  const addCustom = async (name: string) => {
    try {
      onPick(await addType.mutateAsync({ name }));
    } catch (error) {
      toast.error("Couldn't add the warband type.", { description: getErrorMessage(error) });
    }
  };

  return (
    <SearchSelect
      id={props.id}
      label="Warband type"
      placeholder={props.placeholder ?? "Search warband types"}
      emptyText="No warband type matches."
      loading={isLoading}
      options={options}
      value={value ? typeOption(value, place, current) : null}
      onChange={(option) => {
        const picked = all.find((type) => type.id === option?.id);
        if (picked) onPick(picked);
      }}
      create={
        props.canAdd === false
          ? undefined
          : {
              label: (typed) => `Add “${typed}” as a custom warband type`,
              onCreate: (typed) => {
                if (!addType.isPending) void addCustom(typed);
              },
            }
      }
      inputClassName="h-11 text-base"
    />
  );
}
