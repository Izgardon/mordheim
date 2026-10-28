import { payloadOf, renderGoldBadge, type LogFormatter } from "./badges";

type BattleCompletePayload = {
  result?: "won" | "lost" | "no_winner";
  with?: string[];
  against?: string[];
};

type BattleExplorationPayload = {
  dice?: number[];
  amount?: number | null;
  resource?: string | null;
  rerolls?: unknown[];
};

type ItemsLostPayload = { units?: Array<{ unit_name?: string; items?: unknown } | null> };

type WarningsPayload = { warnings?: Array<{ message?: unknown } | null> };

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
  const withNames = names(payload.with);
  const againstNames = names(payload.against);
  if (payload.result === "no_winner") {
    // "No winner" records no wins or losses (decision 8).
    const sides = [
      withNames.length > 0 ? ` with ${withNames.join(", ")}` : "",
      againstNames.length > 0 ? ` against ${againstNames.join(", ")}` : "",
    ].join("");
    return `The battle${sides} ended with no winner.`;
  }
  const verb = payload.result === "lost" ? "Lost" : "Won";
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
  const amount = Number(payload.amount);
  const found =
    Number.isFinite(amount) && amount > 0 && payload.resource
      ? `, finding ${amount} ${payload.resource}`
      : "";
  const rerolls = Array.isArray(payload.rerolls) ? payload.rerolls.length : 0;
  const rerolled =
    rerolls > 0 ? ` (rolled again ${rerolls === 1 ? "once" : `${rerolls} times`})` : "";
  return `Exploration rolls: ${dice.length > 0 ? dice.join(", ") : "-"}${found}${rerolled}.`;
};

/** What dead units took with them (pass 2 decision 7). */
const itemsLost: LogFormatter = (log) => {
  const units = (payloadOf<ItemsLostPayload>(log).units ?? [])
    .map((unit) => {
      const items = names(unit?.items);
      return unit?.unit_name && items.length > 0 ? `${unit.unit_name} (${items.join(", ")})` : null;
    })
    .filter((entry): entry is string => entry !== null);
  return units.length > 0
    ? `Lost with the dead: ${units.join("; ")}.`
    : "Items lost with the dead.";
};

type MountsLostPayload = {
  mounts?: Array<{ unit_name?: string; mount?: string; roll?: number | null } | null>;
};

/** Mounts that died after the battle, their riders taken out (the bestiary rewrite, step 5). */
const mountsLost: LogFormatter = (log) => {
  const mounts = (payloadOf<MountsLostPayload>(log).mounts ?? [])
    .map((entry) => {
      if (!entry?.mount) return null;
      const rolled = typeof entry.roll === "number" ? ` (rolled ${entry.roll})` : "";
      return `${entry.unit_name ? `${entry.unit_name}'s ` : ""}${entry.mount}${rolled}`;
    })
    .filter((entry): entry is string => entry !== null);
  return mounts.length > 0
    ? `Mounts lost after the battle: ${mounts.join("; ")}.`
    : "Mounts lost after the battle.";
};

/** Unusual numbers finalise went ahead with (decision 9). */
const warnings: LogFormatter = (log) => {
  const messages = (payloadOf<WarningsPayload>(log).warnings ?? [])
    .map((warning) => (typeof warning?.message === "string" ? warning.message.trim() : ""))
    .filter(Boolean);
  return messages.length > 0
    ? `Went ahead despite: ${messages.join(" ")}`
    : "Went ahead despite warnings.";
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
  "battle:items_lost": itemsLost,
  "battle:mounts_lost": mountsLost,
  "battle:warnings": warnings,
};
