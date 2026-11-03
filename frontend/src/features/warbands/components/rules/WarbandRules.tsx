import { useState } from "react";
import { ScrollText } from "lucide-react";

import { Chip } from "@/components/ui/chip";

import type { WarbandRule } from "../../types/warband-types";
import WarbandRulesDialog, { type RulesOpening } from "./WarbandRulesDialog";

/**
 * The warband's own rules on its sheet (William: "a section/button that opens a modal ... title
 * +description entries so we can pill-ify them for quick access"): Warband rules opens them all,
 * a rule's pill opens the modal at it. Left out for a viewer when there are none.
 */
export default function WarbandRules({
  warbandId,
  warbandName,
  rules,
  canEdit,
}: {
  warbandId: number;
  warbandName: string;
  rules: WarbandRule[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState<RulesOpening>({});
  const show = (next: RulesOpening) => {
    setOpening(next);
    setOpen(true);
  };

  if (!rules.length && !canEdit) return null;

  return (
    <section aria-label="Warband rules" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => show({})}
        className="mr-1 inline-flex min-h-[34px] items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text hover:text-accent-hi"
      >
        <ScrollText aria-hidden="true" className="h-4 w-4" />
        Warband rules
      </button>
      {rules.map((rule) => (
        <Chip key={rule.id} onClick={() => show({ ruleId: rule.id })}>
          {rule.title}
        </Chip>
      ))}
      {canEdit && !rules.length ? (
        <button
          type="button"
          onClick={() => show({ adding: true })}
          className="min-h-8 border border-dashed border-strong px-2.5 text-xs font-bold text-accent-text"
        >
          Add a rule
        </button>
      ) : null}
      <WarbandRulesDialog
        open={open}
        onOpenChange={setOpen}
        opening={opening}
        warbandId={warbandId}
        warbandName={warbandName}
        rules={rules}
        canEdit={canEdit}
      />
    </section>
  );
}
