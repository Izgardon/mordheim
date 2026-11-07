import { useParams } from "react-router-dom";

import { SpecialIcon } from "@/components/ui/game-icons";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { ALL_SETTINGS, entrySettingName } from "@/features/reference/in-play";
import { FactLine, ReferenceDetail } from "@/features/reference/ReferenceDetail";
import { FilterRow, ReferenceChips, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import {
  ReferenceList,
  ReferenceRow,
  ShowMore,
  useShownRows,
} from "@/features/reference/ReferenceList";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { useCatalogue } from "@/lib/catalogue-queries";
import { useMediaQuery } from "@/lib/use-media-query";

import { SPECIAL_KIND_LABELS, boonBaneRows, categoryOf, type CategoryFilter } from "../boons-banes";
import { specialCost } from "../special-cost";

// William, 7 Nov 2026: "Boons and Banes drop setting and price"; an open row shows them
const COLUMNS = [{ label: "Type", className: "w-[200px] shrink-0" }];

/**
 * Boons & Banes (William, 5 Nov 2026: "having a page could be helpful"): the general rules and the
 * warbands' in play in the campaign, as the Boons & Banes pickers offer them (a hired sword's and a
 * dramatis persona's own show with them), each with its category's icon in its kind's colour and
 * its type, searched by name, type or rules and filtered by category and setting. A row opens to
 * its price where a list sells it, its setting and its rules; `?open=` lands on one (Search
 * everything's links). Read only: specials have no catalogue Edit.
 */
export default function BoonsBanes() {
  const { id } = useParams();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const specials = useCatalogue("specials", campaignId);
  const settings = useSettingsById();
  const params = useReferenceParams(!specials.isLoading);
  const category = params.get("category", "all") as CategoryFilter;
  const setting = params.get("setting", ALL_SETTINGS);
  const { rows, counts, settingOptions } = boonBaneRows(specials.data, {
    query: params.query,
    category,
    setting,
    settings,
    openId: params.openId,
  });
  const shown = useShownRows(
    rows,
    rows.findIndex((special) => String(special.id) === params.openId)
  );

  return (
    <ReferencePage
      title="Boons & Banes"
      section="boons-banes"
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search boons and banes"
              label="Search boons and banes"
              isMobile={isMobile}
            />
          </FilterRow>
          <ReferenceChips
            label="Category"
            options={counts}
            value={category}
            onChange={(next) => params.set({ category: next === "all" ? null : next })}
            isMobile={isMobile}
          />
          {settingOptions.length > 2 ? (
            <ReferenceChips
              label="Setting"
              options={settingOptions}
              value={setting}
              onChange={(next) => params.set({ setting: next === ALL_SETTINGS ? null : next })}
              isMobile={isMobile}
            />
          ) : null}
        </>
      }
      summary={
        isMobile
          ? undefined
          : `${rows.length} ${rows.length === 1 ? "boon or bane" : "boons and banes"} shown`
      }
    >
      {specials.error ? <p className="m-0 text-sm text-danger">{specials.error}</p> : null}
      <ReferenceList
        nameLabel="Name"
        columns={isMobile ? undefined : COLUMNS}
        isEmpty={!specials.isLoading && rows.length === 0}
        empty="No boons or banes match."
      >
        {specials.isLoading ? <ReferenceRowBones cells={1} /> : null}
        {shown.rows.map((special) => {
          const key = String(special.id);
          const price = specialCost(special);
          const kind = [special.kind ? SPECIAL_KIND_LABELS[special.kind] : "", special.type]
            .filter(Boolean)
            .join(" · ");
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={
                <span className="flex items-center gap-1.5">
                  <SpecialIcon category={categoryOf(special)} kind={special.kind} />
                  {special.name}
                </span>
              }
              sub={isMobile ? special.type || undefined : undefined}
              cells={isMobile ? undefined : [special.type]}
            >
              <ReferenceDetail title={special.name} kind={kind} isMobile={isMobile}>
                <FactLine
                  facts={[
                    ...(price ? [{ label: "Price", value: price }] : []),
                    { label: "Setting", value: entrySettingName(special, settings) },
                  ]}
                />
                {special.description ? (
                  <p className="m-0 max-w-[72ch] whitespace-pre-line text-sm leading-relaxed text-text2">
                    {special.description}
                  </p>
                ) : null}              </ReferenceDetail>
            </ReferenceRow>
          );
        })}
      </ReferenceList>
      {rows.length > 0 ? (
        <ShowMore
          shown={shown.rows.length}
          total={rows.length}
          onMore={shown.showMore}
          sorted="sorted by name"
        />
      ) : null}
    </ReferencePage>
  );
}
