import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { useCampaignLocations } from "@/features/campaigns/api/campaign-queries";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";
import { inPlayOnly } from "@/features/reference/in-play";
import { SectionPicker } from "@/features/reference/ReferencePage";
import { referenceSpecials } from "@/features/special/boons-banes";
import { useCampaignRules, useHouseRules } from "@/features/rules/api/rule-queries";
import { ruleEntries } from "@/features/rules/rules-index";
import { myWarbandQuery } from "@/features/warbands/api/warband-queries";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

import { MIN_SEARCH, useCampaignSearch } from "../api/search-api";
import { searchEverything, type SearchGroup } from "../search-everything";
import { SEARCH_FIELD_ID } from "../useSearchShortcut";

const FIRST = 6;

/** The search after the typing settles, so the server isn't asked on every key. */
function useSettled(value: string, delay = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return settled;
}

function ResultGroup({
  group,
  campaignId,
  isMobile,
}: {
  group: SearchGroup;
  campaignId: number;
  isMobile: boolean;
}) {
  const [all, setAll] = useState(false);
  const hits = all ? group.hits : group.hits.slice(0, FIRST);
  return (
    <section aria-label={group.label} className="flex flex-col gap-2">
      <h2 className="m-0 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        {group.label}
        <span className="font-mono text-xs normal-case tracking-normal text-accent-text">
          {group.hits.length}
        </span>
      </h2>
      <ul className="m-0 list-none border border-border bg-surface p-0">
        {hits.map((hit) => (
          <li key={hit.key} className="border-t border-line first:border-t-0">
            <Link
              to={`/campaigns/${campaignId}/${hit.to}`}
              className={cn(
                "flex min-h-12 flex-col justify-center gap-px px-3 py-2 hover:bg-raised",
                !isMobile && "px-4"
              )}
            >
              <span className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-[15px] font-bold text-head">{hit.title}</span>
                {hit.meta ? (
                  <span className="text-xs text-muted-foreground">{hit.meta}</span>
                ) : null}
              </span>
              {hit.snippet ? (
                <span className="text-xs text-text2">
                  {hit.snippet.before}
                  <mark className="bg-accent-soft text-accent-hi">{hit.snippet.match}</mark>
                  {hit.snippet.after}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {group.hits.length > FIRST ? (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="self-start text-[13px] font-semibold text-accent-text hover:text-accent-hi"
        >
          {all ? "Show fewer" : `Show all ${group.hits.length}`}
        </button>
      ) : null}
    </section>
  );
}

/**
 * Search everything (`/campaigns/:id/search?q=`): one field over the reference
 * (items, skills, spells, Boons & Banes, beasts, hired swords, dramatis personae), the rulebook's
 * text, the house rules and the campaign rules, searched here from the lists the pages already
 * load, and this campaign's warbands and units (the server's `search/`) and locations. Results
 * are grouped by kind with counts; each
 * opens its page with its row open, or the warband page for a warband or unit. `/` or Ctrl+K
 * opens it from anywhere in a campaign on the web.
 */
export default function SearchEverything() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const url = useCatalogueSearchParams();
  const query = url.get("q");
  const settled = useSettled(query);
  const items = useCatalogue("items", campaignId);
  const skills = useCatalogue("skills", campaignId);
  const skillGroups = useCatalogue("skill-groups", campaignId);
  const spells = useCatalogue("spells", campaignId);
  const specials = useCatalogue("specials", campaignId);
  const beasts = useCatalogue("bestiary", campaignId);
  const hiredSwords = useCatalogue("hired-swords", campaignId);
  const personae = useCatalogue("dramatis-personae", campaignId);
  const houseRules = useHouseRules(campaignId);
  const campaignRules = useCampaignRules(campaignId);
  const withLocations = Boolean(campaign?.enable_locations);
  const locations = useCampaignLocations(campaignId, { enabled: withLocations });
  const mine = useQuery(myWarbandQuery(campaignId));
  const server = useCampaignSearch(campaignId, settled);
  const rules = useMemo(() => ruleEntries(), []);
  const searching = query.trim().length >= MIN_SEARCH;

  const groups = useMemo(
    () =>
      searching
        ? searchEverything(query, {
            // the reference as its pages show it: only what is in play in the campaign
            items: inPlayOnly(items.data),
            skills: inPlayOnly(skills.data),
            skillGroups: skillGroups.data,
            spells: inPlayOnly(spells.data),
            specials: referenceSpecials(specials.data),
            beasts: inPlayOnly(beasts.data),
            hiredSwords: inPlayOnly(hiredSwords.data),
            personae: inPlayOnly(personae.data),
            rules,
            houseRules: houseRules.data ?? [],
            campaignRules: campaignRules.data ?? [],
            locations: withLocations ? (locations.data ?? []) : [],
            campaign: server.data,
            myWarbandId: mine.data?.id ?? null,
          })
        : [],
    [
      beasts.data,
      hiredSwords.data,
      houseRules.data,
      campaignRules.data,
      items.data,
      locations.data,
      mine.data?.id,
      personae.data,
      query,
      rules,
      searching,
      server.data,
      skillGroups.data,
      skills.data,
      specials.data,
      spells.data,
      withLocations,
    ]
  );
  const total = groups.reduce((sum, group) => sum + group.hits.length, 0);
  const loading = items.isLoading || skills.isLoading || spells.isLoading || server.isFetching;

  return (
    <div className="flex flex-col gap-6 pb-14 max-[960px]:gap-3">
      {isMobile ? (
        <SectionPicker current="search" />
      ) : (
        <header className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            Reference
          </span>
          <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head">
            Search everything
          </h1>
        </header>
      )}
      <label className="flex min-h-12 items-center gap-2.5 border border-strong bg-rail px-3.5 text-muted-foreground">
        <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <input
          id={SEARCH_FIELD_ID}
          type="search"
          autoFocus={!isMobile}
          value={query}
          onChange={(event) => url.set({ q: event.target.value })}
          placeholder="Search everything"
          aria-label="Search everything"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
        />
        {isMobile ? null : (
          <span className="shrink-0 border border-border px-1.5 font-mono text-[11px] text-faint">
            / or Ctrl K
          </span>
        )}
      </label>
      {!searching ? (
        <p className="m-0 text-sm text-text2">Type two letters or more.</p>
      ) : (
        <p role="status" className="m-0 text-[13px] text-text2">
          {total
            ? `${total} ${total === 1 ? "result" : "results"} for “${query.trim()}”`
            : loading
              ? "Searching…"
              : `Nothing found for “${query.trim()}”.`}
          {total && server.isFetching ? " · searching the warbands…" : ""}
        </p>
      )}
      {server.error ? (
        <p className="m-0 text-sm text-danger">Couldn&apos;t search the warbands just now.</p>
      ) : null}
      <div
        className={cn(
          "grid gap-x-8 gap-y-6",
          !isMobile && "[grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]"
        )}
      >
        {groups.map((group) => (
          <ResultGroup key={group.id} group={group} campaignId={campaignId} isMobile={isMobile} />
        ))}
      </div>
    </div>
  );
}
