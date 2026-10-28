/**
 * The warband's rating in the page header: the server's, as saved. While a section has unsaved
 * changes it says so under the number, since they count only once saved (step 5 follow-up).
 */
export default function RatingLabel({
  rating,
  unsaved = false,
}: {
  rating: number;
  unsaved?: boolean;
}) {
  if (!unsaved) return <span>{rating}</span>;
  // Two short lines, as the gold's pending amount, so the header's tabs keep their room.
  return (
    <span className="inline-flex flex-col items-start whitespace-nowrap leading-none">
      <span>{rating}</span>{" "}
      <span className="text-[10px] font-normal opacity-80">(unsaved changes)</span>
    </span>
  );
}
