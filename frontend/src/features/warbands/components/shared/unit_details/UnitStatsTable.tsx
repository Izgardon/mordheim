import basicBar from "@/assets/containers/basic_bar.webp";
import { cn } from "@/lib/utils";
import { Tooltip } from "@components/tooltip";

export type UnitStats = {
  movement?: number | string | null;
  weapon_skill?: number | string | null;
  ballistic_skill?: number | string | null;
  strength?: number | string | null;
  toughness?: number | string | null;
  wounds?: number | string | null;
  initiative?: number | string | null;
  attacks?: number | string | null;
  leadership?: number | string | null;
  armour_save?: number | string | null;
  [key: string]: number | string | boolean | null | undefined;
};

export type UnitStatField = {
  label: string;
  statKey: keyof UnitStats | string;
  raceKey?: keyof UnitStats | string;
  fullName: string;
};

export const UNIT_STAT_FIELDS_SUMMARY: UnitStatField[] = [
  { label: "M", statKey: "movement", fullName: "Movement" },
  { label: "WS", statKey: "weapon_skill", fullName: "Weapon Skill" },
  { label: "BS", statKey: "ballistic_skill", fullName: "Ballistic Skill" },
  { label: "S", statKey: "strength", fullName: "Strength" },
  { label: "T", statKey: "toughness", fullName: "Toughness" },
  { label: "W", statKey: "wounds", fullName: "Wounds" },
  { label: "I", statKey: "initiative", fullName: "Initiative" },
  { label: "A", statKey: "attacks", fullName: "Attacks" },
  { label: "Ld", statKey: "leadership", fullName: "Leadership" },
  { label: "AS", statKey: "armour_save", fullName: "Armour Save" },
];

export const UNIT_STAT_FIELDS_RACE: UnitStatField[] = [
  { label: "M", statKey: "movement", raceKey: "movement", fullName: "Movement" },
  { label: "WS", statKey: "weapon_skill", raceKey: "weapon_skill", fullName: "Weapon Skill" },
  { label: "BS", statKey: "ballistic_skill", raceKey: "ballistic_skill", fullName: "Ballistic Skill" },
  { label: "S", statKey: "strength", raceKey: "strength", fullName: "Strength" },
  { label: "T", statKey: "toughness", raceKey: "toughness", fullName: "Toughness" },
  { label: "W", statKey: "wounds", raceKey: "wounds", fullName: "Wounds" },
  { label: "I", statKey: "initiative", raceKey: "initiative", fullName: "Initiative" },
  { label: "A", statKey: "attacks", raceKey: "attacks", fullName: "Attacks" },
  { label: "Ld", statKey: "leadership", raceKey: "leadership", fullName: "Leadership" },
  { label: "Sv", statKey: "armour_save", fullName: "Armour Save" },
];

type UnitStatsTableVariant = "summary" | "race";

type UnitStatsTableProps = {
  stats: UnitStats;
  raceStats?: UnitStats | null;
  variant?: UnitStatsTableVariant;
  statFields?: UnitStatField[];
  className?: string;
  wrapperClassName?: string;
  valueOverrides?: Partial<Record<string, number | string | null>>;
  valueDelta?: Partial<Record<string, number>>;
  renderExtraRow?: (label: string) => React.ReactNode;
  showTooltips?: boolean;
};

const raceWrapperStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

const formatStatValue = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

const toNumberOrNull = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export default function UnitStatsTable({
  stats,
  raceStats,
  variant = "summary",
  statFields,
  className,
  wrapperClassName,
  valueOverrides,
  valueDelta,
  renderExtraRow,
  showTooltips = true,
}: UnitStatsTableProps) {
  const fields =
    statFields ?? (variant === "race" ? UNIT_STAT_FIELDS_RACE : UNIT_STAT_FIELDS_SUMMARY);
  const showRace = variant === "race";

  const renderStatValue = (field: UnitStatField) => {
    const override = valueOverrides?.[field.label];
    const baseValue =
      override !== undefined ? override : stats[field.statKey as keyof UnitStats];
    const delta = valueDelta?.[field.label] ?? 0;
    const numericBase = toNumberOrNull(baseValue as number | string | null | undefined);
    const resolvedValue =
      numericBase !== null && delta ? numericBase + delta : baseValue;
    const formattedValue = formatStatValue(resolvedValue as number | string | null | undefined);

    if (formattedValue === "-") {
      return "-";
    }

    if (showRace && field.raceKey && raceStats) {
      const raceValue = raceStats[field.raceKey as keyof UnitStats];
      if (raceValue !== null && raceValue !== undefined && raceValue !== "") {
        return (
          <span>
            {formattedValue}
            <sup className="text-[0.6em] text-muted-foreground">/{raceValue}</sup>
          </span>
        );
      }
    }

    return formattedValue;
  };

  const renderHeader = (field: UnitStatField) => {
    if (!showTooltips) {
      return field.label;
    }
    return (
      <Tooltip
        trigger={<span>{field.label}</span>}
        content={field.fullName}
        minWidth={160}
        maxWidth={240}
        className="inline-flex"
      />
    );
  };

  const wrapperClasses =
    variant === "race" ? "max-w-[500px] p-2" : "warband-hero-stats-wrapper";
  const tableClasses =
    variant === "race"
      ? "w-full border-collapse text-center table-fixed"
      : "warband-hero-stats-table w-full table-fixed";
  const headerClasses =
    variant === "race"
      ? "w-[10%] border border-primary/20 px-2 py-1 text-[0.65rem] uppercase tracking-widest text-accent"
      : "";
  const cellClasses =
    variant === "race"
      ? "w-[10%] border border-primary/20 px-2 py-1.5 text-sm font-semibold"
      : "";
  const extraCellClasses =
    variant === "race" ? "w-[10%] border border-primary/20 px-2 py-1.5" : "";

  return (
    <div
      className={cn(wrapperClasses, wrapperClassName)}
      style={variant === "race" ? raceWrapperStyle : undefined}
    >
      <table className={cn(tableClasses, className)}>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.label} className={headerClasses}>
                {renderHeader(field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {fields.map((field) => (
              <td key={field.label} className={cellClasses}>
                {renderStatValue(field)}
              </td>
            ))}
          </tr>
          {renderExtraRow ? (
            <tr>
              {fields.map((field) => (
                <td key={`extra-${field.label}`} className={extraCellClasses}>
                  {renderExtraRow(field.label)}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
