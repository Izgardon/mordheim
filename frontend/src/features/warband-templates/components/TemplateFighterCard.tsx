import { RuleBlock, TagList } from "@/features/reference/ReferenceDetail";
import { ProfileStrip } from "@/features/reference/profile";
import type { SpecialKind } from "@/components/ui/game-icons";

import { countLabel, groupLabel, skillsFor, spellLabel, startSkillsFor } from "../template-view";
import type { TemplateFighter, WarbandTemplate } from "../types/template-types";

const CAPTION = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/** One labelled line of tags (his skill groups, lores, lists); left out when he has none. */
function Tags({ label, names }: { label: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={CAPTION}>{label}</span>
      <TagList tags={names.map((name) => ({ label: name }))} />
    </div>
  );
}

/** What he is besides his profile: "20 XP · Human · Leader · Wizard · groups of 1–5". */
function facts(fighter: TemplateFighter) {
  return [
    fighter.kind === "hero" || fighter.starting_xp ? `${fighter.starting_xp} XP` : "",
    fighter.race ?? "",
    fighter.is_leader ? "Leader" : "",
    fighter.caster !== "No" ? fighter.caster : "",
    fighter.large ? "Large" : "",
    groupLabel(fighter),
    fighter.gains_xp ? "" : "gains no XP",
    fighter.kind === "henchman" && !fighter.promotable ? "can't be promoted" : "",
    fighter.fixed_kit ? `kit: ${fighter.fixed_kit}` : "",
  ].filter(Boolean);
}

/**
 * A template's fighter: his name, cost and how many of him, his profile as written, his skill
 * groups in the variant, his lores and lists, and his rules (opened to read).
 */
export default function TemplateFighterCard({
  fighter,
  template,
  variant,
}: {
  fighter: TemplateFighter;
  template: WarbandTemplate;
  variant: string;
}) {
  const lists = fighter.lists
    .map((key) => template.lists.find((entry) => entry.key === key)?.name)
    .filter((name): name is string => Boolean(name));
  const name = fighter.kind === "henchman" && fighter.plural ? fighter.plural : fighter.name;
  return (
    <article
      aria-label={fighter.name}
      className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-1"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h4 className="m-0 text-[15px] font-bold text-head">{name}</h4>
        <span className="font-mono text-[13px] text-ink">
          {fighter.cost} gc · {countLabel(fighter)}
        </span>
      </div>
      <p className="m-0 text-xs text-muted-foreground">{facts(fighter).join(" · ")}</p>
      <ProfileStrip profile={{ ...fighter, armour_save: null }} />
      <Tags label="Skills" names={skillsFor(fighter, variant)} />
      <Tags label="Starts with" names={startSkillsFor(fighter, variant)} />
      <Tags label="Spells" names={fighter.spell_types.map(spellLabel)} />
      <Tags label="Lists" names={lists} />
      {fighter.rules.length ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-accent-text">
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
  );
}
