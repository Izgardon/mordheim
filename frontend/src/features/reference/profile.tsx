import { StatStrip } from "@/components/ui/stat-strip";
import { STAT_FIELDS, statShown, type WrittenStats } from "@/features/catalogue/utils/statblock";

/** A catalogue profile as the bestiary, the hired swords and a beast's item carry it. */
export type CatalogueProfile = {
  movement: number | null;
  weapon_skill: number | null;
  ballistic_skill: number | null;
  strength: number | null;
  toughness: number | null;
  wounds: number | null;
  initiative: number | null;
  attacks: number | null;
  leadership: number | null;
  armour_save: number | null;
  /** Stats written as the book prints them ("2D6", "-"), by field. */
  written_stats?: WrittenStats;
};

const shown = (p: CatalogueProfile, key: (typeof STAT_FIELDS)[number]["key"]) =>
  statShown(p[key], p.written_stats?.[key]);

/** "M8 WS3 S3 T3 W1": a profile's short line for a row. */
export const profileLine = (p: CatalogueProfile) =>
  `M${shown(p, "movement")} WS${shown(p, "weapon_skill")} S${shown(p, "strength")} T${shown(p, "toughness")} W${shown(p, "wounds")}`;

/** The ten-cell profile strip of a catalogue entry. */
export function ProfileStrip({ profile }: { profile: CatalogueProfile }) {
  return (
    <StatStrip
      values={{
        ...Object.fromEntries(STAT_FIELDS.map(({ key, label }) => [label, shown(profile, key)])),
        Sv: profile.armour_save ? `${profile.armour_save}+` : "–",
      }}
    />
  );
}
