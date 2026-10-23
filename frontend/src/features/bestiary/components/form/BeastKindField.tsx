import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { BEAST_KINDS, beastKindLabel, type BeastKind } from "../../bestiary-kinds";
import { BEAST_KIND_TEXT, BeastKindIcon } from "../BeastKindIcon";

/** The form's kind: Mount, Pet or Creature, one chosen, each with its mark (the plan's mock). */
export default function BeastKindField({
  value,
  onChange,
}: {
  value: BeastKind;
  onChange: (kind: BeastKind) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label id="bestiary-kind-label">Kind</Label>
      <div
        role="radiogroup"
        aria-labelledby="bestiary-kind-label"
        className="flex overflow-hidden rounded-md border border-input"
      >
        {BEAST_KINDS.map((kind) => {
          const checked = value === kind;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(kind)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 border-r border-input px-3 py-2 text-sm last:border-r-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                checked
                  ? cn("bg-accent/20 font-semibold", BEAST_KIND_TEXT[kind])
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BeastKindIcon kind={kind} />
              {beastKindLabel(kind)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
