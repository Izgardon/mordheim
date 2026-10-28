type Named = { name: string; dc?: string | number | null };

type CompanionAbilityLinesProps = {
  skills?: Named[];
  specials?: Named[];
  spells?: Named[];
  className?: string;
};

/**
 * A mount's or pet's skills, specials and spells, one line each ("Spells: Hoof Hex (DC 7)"), in
 * its profile or tooltip (step 5); nothing when its beast has none.
 */
export default function CompanionAbilityLines({
  skills = [],
  specials = [],
  spells = [],
  className = "space-y-1 text-sm",
}: CompanionAbilityLinesProps) {
  const withDc = (spell: Named) =>
    spell.dc !== undefined && spell.dc !== null && spell.dc !== ""
      ? `${spell.name} (DC ${spell.dc})`
      : spell.name;
  const lines: [string, string[]][] = [
    ["Skills", skills.map((skill) => skill.name)],
    ["Specials", specials.map((special) => special.name)],
    ["Spells", spells.map(withDc)],
  ];
  const shown = lines.filter(([, names]) => names.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className={className}>
      {shown.map(([label, names]) => (
        <p key={label}>
          <span className="text-muted-foreground">{label}:</span> {names.join(", ")}
        </p>
      ))}
    </div>
  );
}
