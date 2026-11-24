import { RuleTableView } from "@/features/items/components/ItemRuleBlock";
import { ruleParts } from "@/features/items/utils/item-rules";
import { cn } from "@/lib/utils";

import type { Scenario, ScenarioSection } from "../types";

/** A section's text cut where its tables stand, as an item rule's is. */
function SectionBody({ section }: { section: ScenarioSection }) {
  const parts = ruleParts({ text: section.text, summary: "", table: section.tables ?? [] });
  return (
    <>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <p key={index} className="m-0 whitespace-pre-line">
            {part.text}
          </p>
        ) : (
          <RuleTableView key={index} table={part.table} />
        )
      )}
    </>
  );
}

/**
 * A scenario as it reads at the table: its opening lines, then each section under its heading
 * (read, never applied). Self-contained, so the Scenarios page's open row and the battle's Rules
 * sheet show the same thing.
 */
export default function ScenarioDetail({
  scenario,
  className,
}: {
  scenario: Pick<Scenario, "intro" | "sections">;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[72ch] flex-col gap-3.5", className)}>
      {scenario.intro ? (
        <p className="m-0 whitespace-pre-line font-display text-[15px] italic leading-normal text-text2">
          {scenario.intro}
        </p>
      ) : null}
      {scenario.sections.map((section, index) => (
        <section
          key={`${index}-${section.title}`}
          aria-label={section.title}
          className="flex flex-col gap-1.5 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
        >
          <h3 className="m-0 text-[15px] font-bold text-head">{section.title}</h3>
          {section.text || section.tables?.length ? (
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-text2">
              <SectionBody section={section} />
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
