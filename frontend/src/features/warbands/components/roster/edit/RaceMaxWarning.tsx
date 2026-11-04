import { STAT_FIELDS, numberOnly } from "@/features/catalogue/utils/statblock";
import { useCatalogue } from "@/lib/catalogue-queries";

/**
 * "Above his race maximum" in the Edit form, as the advance dialog warns (a warning: the save goes
 * through): each characteristic the form sets above his race's maximum.
 */
export default function RaceMaxWarning({
  campaignId,
  raceId,
  draft,
}: {
  campaignId: number;
  raceId: number | null;
  draft: Record<string, unknown>;
}) {
  const races = useCatalogue("races", campaignId, { enabled: raceId !== null }).data ?? [];
  const race = races.find((entry) => entry.id === raceId) as Record<string, unknown> | undefined;
  if (!race) return null;
  const over = STAT_FIELDS.flatMap(({ key, label }) => {
    const max = race[key];
    const value = Number(numberOnly(draft[key]));
    return typeof max === "number" && numberOnly(draft[key]) !== "" && value > max
      ? [`${label} ${value} (max ${max})`]
      : [];
  });
  if (!over.length) return null;
  return (
    <p className="m-0 text-xs font-semibold text-danger">
      Above his race maximum: {over.join(", ")}
    </p>
  );
}
