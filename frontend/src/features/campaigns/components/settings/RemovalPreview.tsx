import type { MemberRemovalPreview } from "../../types/campaign-types";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** How the preview speaks: of a member being removed, or to you as you leave. */
type Voice = {
  /** "Mira" or "you", mid-sentence. */
  name: string;
  /** "Mira" or "You", at the start of a sentence. */
  subject: string;
  /** "Their" or "Your". */
  possessive: string;
  /** "has" or "have". */
  has: string;
  /** "is skipped and the battle goes on without them" or "... without you". */
  skipped: string;
};

export const memberVoice = (name: string, subject: string): Voice => ({
  name,
  subject,
  possessive: "Their",
  has: "has",
  skipped: `${name} is skipped and the battle goes on without them`,
});

export const ownVoice: Voice = {
  name: "you",
  subject: "You",
  possessive: "Your",
  has: "have",
  skipped: "you are skipped and the battle goes on without you",
};

/**
 * What a removal or a leave closes, read from the server before anything is confirmed (decision
 * 1, CAMP-NEW-03): the warband is kept, open battles are cancelled or go on without the member,
 * trades close, and their notifications are cleared.
 */
export default function RemovalPreview({
  preview,
  voice,
}: {
  preview: MemberRemovalPreview;
  voice: Voice;
}) {
  const hasOpenWork = preview.battles.length > 0 || preview.trades.length > 0;
  return (
    <div className="flex flex-col gap-2 text-sm text-text2">
      <p className="m-0">
        {preview.warband
          ? `${voice.possessive} warband, ${preview.warband.name}, is kept: it stays in the campaign's history and comes back if ${voice.name} rejoin${voice.name === "you" ? "" : "s"}.`
          : `${voice.subject} ${voice.has} no warband.`}
      </p>
      {hasOpenWork ? (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5" aria-label="What closes">
          {preview.battles.map((battle) => {
            const label = `Battle #${battle.id}${battle.scenario ? `, ${battle.scenario}` : ""}`;
            const outcome = battle.outcome === "skipped" ? voice.skipped : "cancelled for everyone";
            return (
              <li key={`battle-${battle.id}`}>{`${label} (${battle.status}): ${outcome}.`}</li>
            );
          })}
          {preview.trades.map((trade) => (
            <li key={`trade-${trade.id}`}>
              {`Trade with ${trade.with.name} (${trade.status}): closed.`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0">{`${voice.subject} ${voice.has} no open battles or trades.`}</p>
      )}
      {preview.notifications > 0 ? (
        <p className="m-0">{`${plural(preview.notifications, "notification")} waiting for ${voice.name} will be cleared.`}</p>
      ) : null}
    </div>
  );
}
