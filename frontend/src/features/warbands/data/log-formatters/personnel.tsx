import { payloadOf, renderDiceBadge, type LogFormatter } from "./badges";

type SeriousInjuryPayload = {
  unit_name?: string;
  roll_type?: string | null;
  rolls?: number[];
  result_code?: string | null;
  result_label?: string | null;
};

type HiredSwordPersonnelPayload = { name?: string; type?: string };

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
    </span>
  );
};

/** "Hired …" / "Dismissed …" for a hired sword joining or leaving. */
const hiredSwordMove =
  (verb: string): LogFormatter =>
  (log) => {
    const payload = payloadOf<HiredSwordPersonnelPayload>(log);
    return `${verb} ${payload.name || "Unknown"} the ${payload.type || "Hired Sword"}`;
  };

/** Injuries, and hired swords joining or leaving (recruits use the templates). */
export const PERSONNEL_FORMATTERS: Record<string, LogFormatter> = {
  "personnel:serious_injury": seriousInjury,
  "personnel:new_hired_sword": hiredSwordMove("Hired"),
  "personnel:remove_hired_sword": hiredSwordMove("Dismissed"),
};
