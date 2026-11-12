import { RuleBlock, TagList } from "@/features/reference/ReferenceDetail";
import { ProfileStrip } from "@/features/reference/profile";
import { groupLabel, spellLabel } from "@/features/warband-templates/template-view";
import type { SpecialKind } from "@/components/ui/game-icons";

import type { TemplateFighter } from "../../types/hire-template-types";
import RecruitAsHeader from "./RecruitAsHeader";
import { haveText } from "./hire-draft";

const CAPTION = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** One captioned line of tags (his skill groups, his lores); left out when he has none. */
function Tags({ label, names }: { label: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={CAPTION}>{label}</span>
      <TagList tags={names.map((name) => ({ label: name }))} />
    </div>
  );
}

/** "2 of 0–2 · 8 XP · Human · Leader · Wizard · groups of 1–5 · gains no XP". */
function facts(fighter: TemplateFighter) {
  return [
    haveText(fighter),
    `${fighter.starting_xp} XP`,
    fighter.race ?? "",
    fighter.is_leader ? "Leader" : "",
    fighter.caster !== "No" ? fighter.caster : "",
    fighter.large ? "Large" : "",
    groupLabel(fighter),
    fighter.gains_xp ? "" : "gains no XP",
    fighter.kind === "henchman" && !fighter.promotable ? "can't be promoted" : "",
  ].filter(Boolean);
}

/**
 * The fighter Recruit as settled on, with the rest of the list out of the way (William, 12 Nov:
 * "when you click a unit it should minimise the unit list section and just focus on that guy"):
 * his name and cost, what the warband has of him and the rest of his facts, his profile, the
 * skill groups he learns from, the skills he starts with and his rules (each opened to read).
 */
export default function ChosenFighter({
  fighter,
  onChange,
}: {
  fighter: TemplateFighter;
  /** Back to the list of fighters. */
  onChange: () => void;
}) {
  const name = fighter.kind === "henchman" && fighter.plural ? fighter.plural : fighter.name;
  return (
    <div className="flex flex-col gap-1.5">
      <RecruitAsHeader onChange={onChange} />
      <article
        aria-label={fighter.name}
        className="flex flex-col gap-2 border border-accent-line bg-accent-soft px-3 py-2.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="m-0 font-display text-xl font-semibold text-head">{name}</h3>
          <span className="font-mono text-sm font-bold text-head">{fighter.cost} gc</span>
        </div>
        <p className="m-0 text-xs text-text2">{facts(fighter).join(" · ")}</p>
        <ProfileStrip profile={{ ...fighter, armour_save: null }} />
        <Tags label="Skills" names={fighter.skill_types} />
        <Tags label="Spells" names={fighter.spell_types.map(spellLabel)} />
        {fighter.skills.length ? (
          <details>
            <summary className="min-h-6 cursor-pointer text-xs font-semibold text-accent-text">
              Starts with: {fighter.skills.map((skill) => skill.name).join(", ")}
            </summary>
            <div className="mt-2 flex flex-col gap-2.5">
              {fighter.skills.map((skill) => (
                <RuleBlock key={skill.id} name={skill.name}>
                  {skill.description}
                </RuleBlock>
              ))}
            </div>
          </details>
        ) : null}
        {fighter.rules.length ? (
          <details>
            <summary className="min-h-6 cursor-pointer text-xs font-semibold text-accent-text">
              Rules: {fighter.rules.map((rule) => rule.name).join(", ")}
            </summary>
            <div className="mt-2 flex flex-col gap-2.5">
              {fighter.rules.map((rule) => (
                <RuleBlock
                  key={rule.id}
                  name={rule.name}
                  kind={rule.kind as SpecialKind}
                  category={rule.category}
                >
                  {rule.description}
                </RuleBlock>
              ))}
            </div>
          </details>
        ) : null}
      </article>
    </div>
  );
}
