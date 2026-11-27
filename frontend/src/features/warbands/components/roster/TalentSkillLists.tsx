import { Chip } from "@/components/ui/chip";

/**
 * The skill lists a promoted henchman takes (William, 27 Nov 2026: "they can choose 2 skills lists
 * out of the skill lists the current heroes in their warband have taken"): the heroes' lists as
 * the server offers them, `pick` of them pressed at most; a pick past that lets the oldest go.
 */
export default function TalentSkillLists({
  offer,
  pick,
  chosen,
  onChange,
}: {
  offer: string[];
  pick: number;
  chosen: string[];
  onChange: (chosen: string[]) => void;
}) {
  if (!offer.length) return null;
  const toggle = (name: string) =>
    onChange(
      chosen.includes(name)
        ? chosen.filter((held) => held !== name)
        : [...chosen, name].slice(-Math.max(pick, 1))
    );
  return (
    <>
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        His skill lists
      </span>
      <div role="group" aria-label="Skill lists" className="flex flex-wrap gap-1.5">
        {offer.map((name) => (
          <Chip key={name} pressed={chosen.includes(name)} onClick={() => toggle(name)}>
            {name}
          </Chip>
        ))}
      </div>
    </>
  );
}
