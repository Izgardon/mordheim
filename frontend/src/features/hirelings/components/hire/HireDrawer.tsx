import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SidePanel } from "@/components/ui/side-panel";
import { Switch } from "@/components/ui/switch";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import type { Warband, WarbandHero } from "@/features/warbands/types/warband-types";
import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import {
  HIRELING_CATALOGUES,
  hirelingRace,
  type HirelingCatalogueKind,
} from "../../hireling-catalogue-kinds";
import type { HirelingProfile } from "../../types/hireling-catalogue-types";
import HireDialog from "../HireDialog";
import HirelingProfileFormDialog from "../HirelingProfileFormDialog";
import HireDrawerRow from "./HireDrawerRow";

const KINDS: HirelingCatalogueKind[] = ["hired-swords", "dramatis-personae"];

type HireDrawerProps = {
  campaignId: number;
  warband: Pick<Warband, "id" | "name" | "resources" | "hero_count" | "max_heroes">;
  heroes: WarbandHero[];
  /** Whether the viewer may hire for the warband (its sheet's `edit`). */
  canHire: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a hire: the new hireling's id (his card opens in Edit). */
  onHired: (unitId: number) => void;
};

/**
 * Hire from the warband page (William, 7 Nov 2026: "adding a hired sword on warband page should
 * open a side draw (add new button there opens the hired sword modal)"; "should also be a toggle
 * to see all not just allowed"): the hired swords, or the dramatis personae, the warband may hire
 * by who-can, searched; Show all lists the rest with the server's reason, and they can still be
 * hired. Hire is the hire dialog (the fee and its payment). Nobody is typed in by hand: Add new is
 * the hired sword form, and saving it goes straight on to hiring the new one, only here (William,
 * 8 Nov 2026: "a user should always create the unit first in the modal. if they are adding a new
 * one from the warband page then when saving it should automatically add that hired sword as if
 * they had clicked hire, but only from that page"). Cancelled, he stays made and shows in the list.
 */
export default function HireDrawer(props: HireDrawerProps) {
  const { campaignId, warband } = props;
  const [kind, setKind] = useState<HirelingCatalogueKind>("hired-swords");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hiring, setHiring] = useState<HirelingProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const config = HIRELING_CATALOGUES[kind];
  const entries = useCatalogue(kind, campaignId, { enabled: props.open });
  const whoCan = useWhoCan(campaignId, props.open ? warband.id : null);
  const access = kind === "hired-swords" ? whoCan.hiredSwords : whoCan.dramatisPersonae;
  const canAdd = useCampaignCapabilities(campaignId).edit_catalogue;
  const warningOf = (entry: HirelingProfile) => {
    const row = access.get(entry.id);
    return row && !row.can_hire ? row.reason : "";
  };
  // those it can usually hire first, then the rest; each part by name
  const rows = entries.data
    .filter(
      (entry) =>
        (showAll || !warningOf(entry)) &&
        matchesSearchQuery(query, entry.name, hirelingRace(entry), entry.description)
    )
    .sort(
      (a, b) =>
        Number(Boolean(warningOf(a))) - Number(Boolean(warningOf(b))) ||
        a.name.localeCompare(b.name)
    );

  return (
    <SidePanel
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker={`Hire for ${warband.name}`}
      title={config.labels.title}
    >
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Hire from" className="flex gap-1.5">
          {KINDS.map((each) => (
            <Chip key={each} pressed={kind === each} onClick={() => setKind(each)}>
              {HIRELING_CATALOGUES[each].labels.title}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-stretch gap-2.5">
          <label className="flex min-h-11 min-w-[200px] flex-1 items-center gap-2 border border-strong bg-page px-3 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              placeholder={config.labels.search}
              aria-label={config.labels.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
          </label>
          <Switch checked={showAll} onCheckedChange={setShowAll}>
            Show all
          </Switch>
          {canAdd ? (
            <Button variant="secondary" className="min-h-11" onClick={() => setAdding(true)}>
              Add new
            </Button>
          ) : null}
        </div>
        {entries.isLoading || whoCan.isLoading ? (
          <p className="m-0 text-sm text-muted-foreground">Reading the list…</p>
        ) : entries.error ? (
          <p className="m-0 text-sm text-danger">{entries.error}</p>
        ) : rows.length === 0 ? (
          <p className="m-0 text-sm text-text2">{`${config.labels.noMatches}.`}</p>
        ) : null}
        <ul aria-label={config.labels.title} className="m-0 flex list-none flex-col p-0">
          {rows.map((entry) => (
            <HireDrawerRow
              key={entry.id}
              entry={entry}
              warning={warningOf(entry)}
              canHire={props.canHire}
              onHire={() => setHiring(entry)}
            />
          ))}
        </ul>
      </div>
      <HireDialog
        config={config}
        campaignId={campaignId}
        warband={warband}
        heroes={props.heroes}
        entry={hiring}
        warning={hiring ? warningOf(hiring) : ""}
        onClose={() => setHiring(null)}
        onHired={props.onHired}
      />
      <HirelingProfileFormDialog
        config={config}
        campaignId={campaignId}
        open={adding}
        onOpenChange={setAdding}
        editingId={null}
        canDelete={false}
        onSaved={(saved) => {
          setAdding(false);
          setQuery(saved.name);
          // on as if Hire were pressed on him: the hire dialog, then his card in Edit
          if (props.canHire) setHiring(saved);
        }}
      />
    </SidePanel>
  );
}
