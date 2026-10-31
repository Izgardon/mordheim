import { StatStrip } from "@/components/ui/stat-strip";

/** A catalogue profile as the bestiary, the hired swords and a beast's item carry it. */
export type CatalogueProfile = {
  movement: number;
  weapon_skill: number;
  ballistic_skill: number;
  strength: number;
  toughness: number;
  wounds: number;
  initiative: number;
  attacks: number;
  leadership: number;
  armour_save: number | null;
};

/** "M8 WS3 S3 T3 W1": a profile's short line for a row. */
export const profileLine = (p: CatalogueProfile) =>
  `M${p.movement} WS${p.weapon_skill} S${p.strength} T${p.toughness} W${p.wounds}`;

/** The ten-cell profile strip of a catalogue entry. */
export function ProfileStrip({ profile }: { profile: CatalogueProfile }) {
  return (
    <StatStrip
      values={{
        M: profile.movement,
        WS: profile.weapon_skill,
        BS: profile.ballistic_skill,
        S: profile.strength,
        T: profile.toughness,
        W: profile.wounds,
        I: profile.initiative,
        A: profile.attacks,
        Ld: profile.leadership,
        Sv: profile.armour_save ? `${profile.armour_save}+` : "–",
      }}
    />
  );
}
