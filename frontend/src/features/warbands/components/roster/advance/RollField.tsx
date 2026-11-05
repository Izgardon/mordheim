import DiceEntry from "@/components/ui/dice-entry";

/**
 * Roll the dice, or type what was rolled at the table: "Roll 2D6" beside a box for each die (the
 * shared dice boxes), giving their total. A total set another way (a table row clicked) empties
 * the boxes of a 2D6 and shows a D6's face.
 */
export default function RollField({
  dice,
  value,
  onChange,
}: {
  /** How many D6. */
  dice: 1 | 2;
  value: number | null;
  onChange: (roll: number | null) => void;
}) {
  return (
    <DiceEntry
      dice={dice === 2 ? "2D6" : "D6"}
      total={value}
      onFaces={(faces) => onChange(faces.reduce((sum, die) => sum + die, 0))}
      // a box emptied takes the total back
      onChange={(faces) => (faces.includes(null) && value !== null ? onChange(null) : undefined)}
    />
  );
}
