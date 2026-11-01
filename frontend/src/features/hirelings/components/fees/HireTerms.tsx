import type { WarbandHero } from "@/features/warbands/types/warband-types";

import { feeOf, type Fee } from "../../fees";
import { useHirelingProfileDetail } from "../../hooks/useHirelingProfileDetail";
import type { HirelingCatalogueKind } from "../../hireling-catalogue-kinds";

const BOX = "flex flex-col gap-1.5 border border-accent-line bg-accent-soft p-2.5 text-[13px]";

/**
 * A fee in his rules (Bertha, the Truthsayer, Aksho'akhash's summoning): the fee's own words in
 * full when it has them (how he is hired, never automated), its listed gold, then his rules, read
 * with his detail, to set the price by.
 */
function HisRules({
  kind,
  campaignId,
  entryId,
  fee,
}: {
  kind: HirelingCatalogueKind;
  campaignId: number;
  entryId: number;
  fee: Fee;
}) {
  const detail = useHirelingProfileDetail(kind, campaignId, entryId);
  const rules = detail.entry?.specials ?? [];
  const note = fee.note.trim();
  return (
    <div className={BOX}>
      <span className="font-semibold text-danger">
        His fee is in his rules: hired at what you set below (0 gc unless you change it).
        {fee.gold !== null ? ` His listed fee is ${fee.gold} gc.` : ""}
      </span>
      {note ? (
        <p className="m-0 whitespace-pre-line text-ink">
          <span className="font-semibold">How he is hired.</span> {note}
        </p>
      ) : null}
      {rules.length ? (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
          {rules.map((rule) => (
            <p key={rule.id} className="m-0 text-text2">
              <span className="font-semibold text-ink">{rule.name}.</span> {rule.description}
            </p>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">{detail.error || "Reading his rules…"}</span>
      )}
    </div>
  );
}

/**
 * What a fee's kind asks before a hire (the fees step): a fee in his rules shows them; one who
 * takes a hero's place says so and, with the heroes full, offers to let one go (carried items are
 * lost). Warnings, never blocks: he can be hired either way.
 */
export default function HireTerms({
  kind,
  campaignId,
  entryId,
  fee,
  heroes,
  heroCount,
  maxHeroes,
  dismissHeroId,
  onDismissHero,
}: {
  kind: HirelingCatalogueKind;
  campaignId: number;
  entryId: number;
  fee: Fee | null | undefined;
  heroes: WarbandHero[];
  /** Heroes, and those in a hero's place, against the cap (the server's counts). */
  heroCount: number;
  maxHeroes: number | null;
  dismissHeroId: number | null;
  onDismissHero: (heroId: number | null) => void;
}) {
  const read = feeOf(fee);
  if (read.kind === "special")
    return <HisRules kind={kind} campaignId={campaignId} entryId={entryId} fee={read} />;
  if (read.kind !== "replaces_hero") return null;
  const full = maxHeroes !== null && heroCount >= maxHeroes;
  return (
    <div className={BOX}>
      <span className="text-ink">He takes one of the heroes&apos; places: no fee in gold.</span>
      {full ? (
        <>
          <span className="font-semibold text-danger">
            {heroCount} of {maxHeroes} heroes. Let a hero go to make room, or hire him anyway.
          </span>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Let go (carried items are lost)
            <select
              value={dismissHeroId ?? ""}
              onChange={(event) =>
                onDismissHero(event.target.value ? Number(event.target.value) : null)
              }
              className="h-9 border border-strong bg-page px-2 text-sm text-ink"
            >
              <option value="">Nobody</option>
              {heroes.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  {hero.name || hero.unit_type || `Hero ${hero.id}`}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
