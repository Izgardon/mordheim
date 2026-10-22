import { payloadOf, renderDiceBadge, type LogFormatter } from "./badges";

type SeriousInjuryPayload = {
  unit_name?: string;
  roll_type?: string | null;
  rolls?: number[];
  result_code?: string | null;
  result_label?: string | null;
  applied?: boolean;
  apply_by_hand?: boolean;
};

type StatsKeptPayload = {
  unit_name?: string;
  changes?: Record<string, { before?: unknown; after?: unknown } | null>;
};

const STAT_ABBREVIATIONS: Record<string, string> = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
  armour_save: "AS",
};

const statValue = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

/** Battle stat changes made permanent by the Keep tick (SEC-10, decision 6). */
const statsKept: LogFormatter = (log) => {
  const payload = payloadOf<StatsKeptPayload>(log);
  const changes = Object.entries(payload.changes ?? {})
    .map(([stat, change]) =>
      change
        ? `${STAT_ABBREVIATIONS[stat] ?? stat} ${statValue(change.before)} → ${statValue(change.after)}`
        : null
    )
    .filter((entry): entry is string => entry !== null);
  return `${payload.unit_name || "Unknown unit"} kept the battle's stat changes${
    changes.length > 0 ? `: ${changes.join(", ")}` : ""
  }.`;
};

type HirelingPersonnelPayload = { name?: string; type?: string };

const seriousInjury: LogFormatter = (log) => {
  const payload = payloadOf<SeriousInjuryPayload>(log);
  const unitName = payload.unit_name || "Unknown unit";
  const rollTypeRaw =
    typeof payload.roll_type === "string" ? payload.roll_type.trim().toUpperCase() : "";
  const rolls = Array.isArray(payload.rolls)
    ? payload.rolls
        .map((value) => Number(value))
        .filter((value): value is number => Number.isFinite(value))
    : [];
  const resultCode = typeof payload.result_code === "string" ? payload.result_code.trim() : "";
  const resultLabel = typeof payload.result_label === "string" ? payload.result_label.trim() : "";

  if (!rollTypeRaw && rolls.length === 0 && !resultCode && !resultLabel) {
    return `${unitName} made a serious injury roll`;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>
        {unitName} made a serious injury roll of {rolls.length ? rolls.join(", ") : "-"}
      </span>
      {rollTypeRaw ? <span>({renderDiceBadge(rollTypeRaw)})</span> : null}
      {resultCode || resultLabel ? (
        <span>= {[resultCode, resultLabel].filter(Boolean).join(": ")}</span>
      ) : null}
      {payload.applied ? <span>(applied)</span> : null}
      {payload.apply_by_hand ? <span>(apply by hand)</span> : null}
    </span>
  );
};

/** "Hired …" / "Dismissed …" for a hired sword joining or leaving. */
const hirelingMove =
  (verb: string): LogFormatter =>
  (log) => {
    const payload = payloadOf<HirelingPersonnelPayload>(log);
    return `${verb} ${payload.name || "Unknown"} the ${payload.type || "Hired Sword"}`;
  };

/** Injuries, and hired swords joining or leaving (recruits use the templates). */
export const PERSONNEL_FORMATTERS: Record<string, LogFormatter> = {
  "personnel:serious_injury": seriousInjury,
  "personnel:stats_kept": statsKept,
  "personnel:new_hireling": hirelingMove("Hired"),
  "personnel:remove_hireling": hirelingMove("Dismissed"),
};
