import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";

import type { WarbandRule } from "../../types/warband-types";
import { SECTION_TITLE } from "../page/warband-layout";
import AddRuleDialog from "./AddRuleDialog";
import WarbandRulesDialog, { type RulesOpening } from "./WarbandRulesDialog";

/** Whether the pills' one line holds them all, measured whenever the rules or the width change. */
function useOverflows(rules: WarbandRule[]) {
  const line = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const element = line.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollWidth > element.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rules]);
  return { line, overflows };
}

/**
 * The warband's own rules on its sheet, laid out as Resources is (William, 22 Nov 2026): the
 * section's title with Add rule across from it, then one line of the rules' pills, an arrow
 * showing the rest when they don't all fit. A pill opens the modal at its rule; Add rule opens a
 * form of its own (AddRuleDialog). Left out for a viewer when there are none.
 */
export default function WarbandRules({
  campaignId,
  warbandId,
  warbandName,
  rules,
  canEdit,
}: {
  /** The warband's campaign: its editors can add the template's missing rules. */
  campaignId?: number;
  /** None: a warband template's rules (Reference → Warbands), read only. */
  warbandId?: number;
  warbandName: string;
  rules: WarbandRule[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const editable = canEdit && warbandId !== undefined;
  const [opening, setOpening] = useState<RulesOpening>({});
  const { line, overflows } = useOverflows(rules);
  const show = (next: RulesOpening) => {
    setOpening(next);
    setOpen(true);
  };

  if (!rules.length && !editable) return null;

  return (
    <section aria-label="Warband rules" className="flex flex-col gap-2 border-b border-line pb-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className={SECTION_TITLE}>Warband rules</h2>
        {editable ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-8 border border-dashed border-strong px-2.5 text-xs font-bold text-accent-text"
          >
            Add rule
          </button>
        ) : null}
      </div>
      {rules.length ? (
        <div className="flex items-start gap-2">
          <div
            ref={line}
            className={`flex min-w-0 flex-1 gap-2 ${expanded ? "flex-wrap" : "overflow-hidden"}`}
          >
            {rules.map((rule) => (
              <Chip key={rule.id} className="shrink-0" onClick={() => show({ ruleId: rule.id })}>
                {rule.title}
              </Chip>
            ))}
          </div>
          {overflows || expanded ? (
            <IconButton
              aria-label={expanded ? "Show fewer rules" : "Show every rule"}
              aria-expanded={expanded}
              look="plain"
              className="h-8 w-8 shrink-0"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown
                aria-hidden="true"
                className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
              />
            </IconButton>
          ) : null}
        </div>
      ) : null}
      <WarbandRulesDialog
        open={open}
        onOpenChange={setOpen}
        opening={opening}
        campaignId={campaignId}
        warbandId={warbandId}
        warbandName={warbandName}
        rules={rules}
        canEdit={editable}
      />
      {editable && warbandId !== undefined ? (
        <AddRuleDialog
          open={adding}
          onOpenChange={setAdding}
          campaignId={campaignId}
          warbandId={warbandId}
          warbandName={warbandName}
        />
      ) : null}
    </section>
  );
}
