import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import AddNewMenu from "@/features/reference/AddNewMenu";
import { FilterLine, FilterSelect } from "@/features/reference/FilterLine";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, type ColumnSort } from "@/features/reference/ReferenceList";
import ReferencePage from "@/features/reference/ReferencePage";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";

import { useCampaignScenarios } from "../api/scenario-queries";
import AddScenarioDialog from "../components/AddScenarioDialog";
import ScenarioFormDialog from "../components/ScenarioFormDialog";
import { playersMatch } from "../components/ScenarioPlayersIcon";
import ScenarioRow from "../components/ScenarioRow";
import { SORT_OPTIONS, scenarioRows, type ScenarioSort } from "../scenario-rows";
import type { CampaignScenario } from "../types";

type PlayersFilter = "all" | "1v1" | "multiplayer";

const SOURCE = "w-[220px] shrink-0";
const WEIGHT = "w-[96px] shrink-0";

/**
 * The campaign's Scenarios page (William, 24 Nov 2026): its list, each with the icon for who it is
 * for, its source and its weight in the random draw (a manager edits it in place), opening to its
 * opening lines and sections. Managers (`manage_scenarios`) add from the catalogue, write a new
 * one and remove one. `?q=`, `?players=`, `?sort=` and `?open=` keep the page in the address.
 */
export default function Scenarios() {
  const { id } = useParams();
  const campaignId = Number(id);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const capabilities = useCampaignCapabilities(campaignId);
  const canManage = capabilities.manage_scenarios;
  const list = useCampaignScenarios(campaignId);
  const params = useReferenceParams(!list.isLoading);
  const [adding, setAdding] = useState<"pick" | "new" | null>(null);
  const players = params.get("players", "all") as PlayersFilter;
  const sort = params.get("sort", "name") as ScenarioSort;
  const all = list.data ?? [];
  const rows = scenarioRows(
    all.filter((row) => playersMatch(row.scenario.players, players)),
    params.query,
    sort
  );
  const sortBy = (next: ScenarioSort) => params.set({ sort: next === "name" ? null : next });
  const columnSort = (by: ScenarioSort): ColumnSort => ({
    direction: sort === by ? (by === "weight" ? "desc" : "asc") : null,
    onSort: () => sortBy(by),
  });
  const reveal = (row: CampaignScenario) =>
    params.reveal(String(row.id), { q: null, players: null });
  const counts = (filter: PlayersFilter) =>
    all.filter((row) => playersMatch(row.scenario.players, filter)).length;

  return (
    <ReferencePage
      title="Scenarios"
      section="scenarios"
      eyebrow="Campaign"
      actions={
        !canManage ? null : isMobile ? (
          // one button beside a phone's search box, its menu naming both
          <AddNewMenu
            className="min-h-10"
            entries={[
              { label: "From the catalogue", onSelect: () => setAdding("pick") },
              ...(capabilities.edit_catalogue
                ? [{ label: "New scenario", onSelect: () => setAdding("new") }]
                : []),
            ]}
          />
        ) : (
          <>
            <Button variant="secondary" onClick={() => setAdding("pick")}>
              Add scenario
            </Button>
            {capabilities.edit_catalogue ? (
              <Button variant="secondary" onClick={() => setAdding("new")}>
                Add new
              </Button>
            ) : null}
          </>
        )
      }
      filters={
        <>
          <FilterRow isMobile={isMobile}>
            <ReferenceSearch
              value={params.query}
              onChange={params.setQuery}
              placeholder="Search scenarios"
              label="Search scenarios"
              isMobile={isMobile}
            />
          </FilterRow>
          <FilterLine
            isMobile={isMobile}
            sort={{ options: SORT_OPTIONS, value: sort, onChange: sortBy }}
          >
            <FilterSelect
              label="Players"
              allLabel="1v1 and multiplayer"
              options={[
                { id: "all", label: "All", count: counts("all") },
                { id: "1v1", label: "1v1", count: counts("1v1") },
                { id: "multiplayer", label: "Multiplayer", count: counts("multiplayer") },
              ]}
              value={players}
              onChange={(next) => params.set({ players: next === "all" ? null : next })}
              isMobile={isMobile}
            />
          </FilterLine>
        </>
      }
      summary={
        isMobile ? undefined : `${rows.length} ${rows.length === 1 ? "scenario" : "scenarios"}`
      }
    >
      {list.error && !list.data ? (
        <p className="m-0 text-sm text-danger">
          {getErrorMessage(list.error, "Unable to load the scenarios")}
        </p>
      ) : null}
      <ReferenceList
        nameLabel="Scenario"
        nameSort={isMobile ? undefined : columnSort("name")}
        columns={
          isMobile
            ? undefined
            : [
                { label: "Source", className: SOURCE, sort: columnSort("source") },
                { label: "Weight", className: WEIGHT, sort: columnSort("weight") },
              ]
        }
        isEmpty={!list.isLoading && rows.length === 0}
        empty={all.length ? "No scenarios match." : "The campaign has no scenarios."}
      >
        {list.isLoading ? <ReferenceRowBones cells={2} /> : null}
        {rows.map((row) => (
          <ScenarioRow
            key={row.id}
            campaignId={campaignId}
            row={row}
            open={params.isOpen(String(row.id))}
            onToggle={() => params.toggle(String(row.id))}
            canManage={canManage}
            isMobile={isMobile}
          />
        ))}
      </ReferenceList>
      <AddScenarioDialog
        campaignId={campaignId}
        open={adding === "pick"}
        onOpenChange={(open) => setAdding(open ? "pick" : null)}
        listed={all}
        onAdded={reveal}
      />
      <ScenarioFormDialog
        campaignId={campaignId}
        open={adding === "new"}
        onOpenChange={(open) => setAdding(open ? "new" : null)}
        onSaved={reveal}
      />
    </ReferencePage>
  );
}
