import { payloadOf, renderGoldBadge, type LogFormatter } from "./badges";

type BattleCompletePayload = {
  result?: "won" | "lost";
  with?: string[];
  against?: string[];
};

type BattleExplorationPayload = { dice?: number[] };

type BattleFindsPayload = {
  gold_crowns?: number;
  items?: Array<{ name?: string } | null>;
};

const names = (values: unknown) =>
  Array.isArray(values)
    ? values.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    : [];

const battleComplete: LogFormatter = (log) => {
  const payload = payloadOf<BattleCompletePayload>(log);
  const verb = payload.result === "lost" ? "Lost" : "Won";
  const withNames = names(payload.with);
  const againstNames = names(payload.against);
  if (againstNames.length === 0) {
    return `${verb} the battle.`;
  }
  if (withNames.length === 0) {
    return `${verb} the battle against ${againstNames.join(", ")}.`;
  }
  return `${verb} the battle with ${withNames.join(", ")} against ${againstNames.join(", ")}.`;
};

const exploration: LogFormatter = (log) => {
  const payload = payloadOf<BattleExplorationPayload>(log);
  const dice = Array.isArray(payload.dice)
    ? payload.dice
        .filter((value): value is number => Number.isFinite(Number(value)))
        .map((value) => Number(value))
    : [];
  return `Exploration rolls: ${dice.length > 0 ? dice.join(", ") : "-"}.`;
};

const finds: LogFormatter = (log) => {
  const payload = payloadOf<BattleFindsPayload>(log);
  const goldCrowns = Number(payload.gold_crowns);
  const items = Array.isArray(payload.items)
    ? payload.items
        .map((entry) => (entry && typeof entry === "object" ? String(entry.name || "").trim() : ""))
        .filter((value): value is string => value.length > 0)
    : [];
  const hasGold = Number.isFinite(goldCrowns) && goldCrowns > 0;

  if (hasGold && items.length > 0) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>Finds:</span>
        {renderGoldBadge(goldCrowns)}
        <span>and {items.join(", ")}.</span>
      </span>
    );
  }
  if (hasGold) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>Finds:</span>
        {renderGoldBadge(goldCrowns)}
      </span>
    );
  }
  if (items.length > 0) {
    return `Finds: ${items.join(", ")}.`;
  }
  return "Finds recorded.";
};

/** A battle's result, exploration and finds. */
export const BATTLE_FORMATTERS: Record<string, LogFormatter> = {
  "battle:complete": battleComplete,
  "battle:exploration": exploration,
  "battle:finds": finds,
};
