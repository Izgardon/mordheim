import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { TemplateFighter, TemplateVariant } from "../types/template-types";
import { Field, NumberField } from "./editor-ui";
import type { LineDraft } from "./list-draft";
import WhoField from "./WhoField";

/**
 * One line opened: the item and its chart (and why the template's types can't usually buy it),
 * its list price (empty: see the cost note), the brace price, the first free, the list's own
 * name for it, who may take it, the most in a warband, a note and the variant it is for.
 */
export default function LineFields({
  line,
  chart,
  reason,
  fighters,
  variants,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  /** "Wargear · chart: 10 gc, Common". */
  chart: string;
  /** Why its types can't usually buy it ("Not usually available to Night Watch."). */
  reason: string;
  fighters: TemplateFighter[];
  variants: TemplateVariant[];
  onChange: (line: LineDraft) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<LineDraft>) => onChange({ ...line, ...patch });
  return (
    <div className="flex flex-col gap-2.5 border-l-2 border-accent-line bg-page px-3 py-2.5">
      <p className="m-0 text-xs text-text2">
        {line.item.name}
        {chart ? ` · ${chart}` : ""}
      </p>
      {reason ? <p className="m-0 text-xs font-semibold text-danger">{reason}</p> : null}
      <div className="grid grid-cols-2 gap-2 min-[620px]:grid-cols-4">
        <NumberField
          label="Price"
          value={line.cost}
          placeholder="none"
          onChange={(cost) => set({ cost })}
        />
        <NumberField
          label="Brace"
          value={line.brace}
          placeholder="—"
          onChange={(brace) => set({ brace })}
        />
        <NumberField
          label="Warband max"
          value={line.most}
          placeholder="—"
          onChange={(most) => set({ most })}
        />
        <div className="flex items-end pb-1.5">
          <Switch
            look="plain"
            className="text-xs"
            checked={line.firstFree}
            onCheckedChange={(firstFree) => set({ firstFree })}
          >
            1st free
          </Switch>
        </div>
        <Field label="Cost note" className="col-span-2">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={120}
              value={line.costNote}
              onChange={(event) => set({ costNote: event.target.value })}
            />
          )}
        </Field>
        <Field label="Shown as" className="col-span-2">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={160}
              value={line.shownAs}
              placeholder="(its own name)"
              onChange={(event) => set({ shownAs: event.target.value })}
            />
          )}
        </Field>
        <Field label="Note" className="col-span-2">
          {(id) => (
            <Input
              id={id}
              inputSize="sm"
              maxLength={300}
              value={line.note}
              onChange={(event) => set({ note: event.target.value })}
            />
          )}
        </Field>
        {variants.length ? (
          <Field label="Variant" className="col-span-2">
            {(id) => (
              <select
                id={id}
                className="h-9 border border-strong bg-page px-2 text-sm text-ink"
                value={line.variant}
                onChange={(event) => set({ variant: event.target.value })}
              >
                <option value="">Every variant</option>
                {variants.map((variant) => (
                  <option key={variant.key} value={variant.key}>
                    {variant.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}
      </div>
      <WhoField
        who={line.who}
        fighters={fighters}
        whoText={line.whoText}
        onChange={(who) => set({ who, whoText: "" })}
      />
      <Button size="sm" variant="ghost" className="self-start" onClick={onRemove}>
        Take off the list
      </Button>
    </div>
  );
}
