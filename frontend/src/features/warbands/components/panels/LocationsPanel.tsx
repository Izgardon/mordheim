import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { useCampaignLocations } from "@/features/campaigns/api/campaign-queries";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";

import { useLocationRemoval } from "../../hooks/campaign/useLocationRemoval";
import type { WarbandHero } from "../../types/warband-types";
import LocationCard from "./LocationCard";
import LocationForm from "./LocationForm";

type LocationsPanelProps = {
  campaignId: number;
  /** Your warband: Send a hero logs to it. Without one (or `canEdit`), the panel only reads. */
  warbandId: number;
  heroes: WarbandHero[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens searched for this (Explore's "Read and roll" names the location it found). */
  initialSearch?: string;
};

/** The card being edited, or "new" while one is added. */
type Editing = number | "new" | null;

/**
 * The campaign's locations (design E): search, area chips built from the areas in use, an area
 * tag and flags on each, a D6 roll for those with results, and Send a hero. With
 * `manage_locations` (William, 1 Nov 2026: not in settings any more), Add location, and Edit and
 * Remove on each, the form in place of the card.
 */
export default function LocationsPanel(props: LocationsPanelProps) {
  const { campaignId } = props;
  const locations = useCampaignLocations(campaignId, { enabled: props.open });
  const canManage = useCampaignCapabilities(campaignId).manage_locations;
  const removal = useLocationRemoval(campaignId);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [sending, setSending] = useState<number | null>(null);
  const { open, initialSearch } = props;
  useEffect(() => {
    if (open && initialSearch) setSearch(initialSearch);
  }, [open, initialSearch]);

  const all = locations.data ?? [];
  const areas = [
    ...new Set(
      all.map((location) => location.area?.trim()).filter((name): name is string => !!name)
    ),
  ].sort();
  const query = search.trim().toLowerCase();
  const shown = all.filter(
    (location) =>
      (area === null || location.area?.trim() === area) &&
      `${location.name} ${location.area ?? ""} ${location.content}`.toLowerCase().includes(query)
  );
  const form = (location: CampaignLocation | null) => (
    <LocationForm
      campaignId={campaignId}
      editing={location}
      areas={areas}
      onClose={() => setEditing(null)}
    />
  );

  return (
    <SidePanel open={open} onOpenChange={props.onOpenChange} kicker="Campaign" title="Locations">
      {canManage ? (
        editing === "new" ? (
          <div className="border border-accent-line bg-surface px-3.5 py-3">{form(null)}</div>
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => setEditing("new")}>
            Add location
          </Button>
        )
      ) : null}
      <Input
        type="search"
        aria-label="Search locations"
        placeholder="Search locations"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {areas.length ? (
        <div role="group" aria-label="Area" className="flex flex-wrap gap-1.5">
          <Chip pressed={area === null} onClick={() => setArea(null)}>
            All
          </Chip>
          {areas.map((name) => (
            <Chip key={name} pressed={area === name} onClick={() => setArea(name)}>
              {name}
            </Chip>
          ))}
        </div>
      ) : null}
      {locations.isPending ? (
        <p className="text-sm text-muted-foreground">Finding the locations…</p>
      ) : null}
      {locations.data && !shown.length ? (
        <p className="text-sm text-text2">
          {all.length ? "No location matches." : "No locations yet."}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((location) =>
          editing === location.id ? (
            <li key={location.id} className="border border-accent-line bg-surface px-3.5 py-3">
              {form(location)}
            </li>
          ) : (
            <LocationCard
              key={location.id}
              location={location}
              warbandId={props.warbandId}
              heroes={props.heroes}
              canSend={props.canEdit}
              sending={sending === location.id}
              onToggleSend={() => setSending(sending === location.id ? null : location.id)}
              onEdit={canManage ? () => setEditing(location.id) : undefined}
              onRemove={canManage ? () => removal.ask(location) : undefined}
            />
          )
        )}
      </ul>
      <ConfirmDialog
        open={Boolean(removal.removing)}
        onOpenChange={(next) => !next && removal.ask(null)}
        title="Remove the location"
        description={
          <p className="m-0 text-ink">{`Remove ${removal.removing?.name ?? "this location"}? It leaves the Locations panel for everyone in the campaign.`}</p>
        }
        error={removal.error}
        confirmText={removal.busy ? "Removing…" : "Remove"}
        isConfirming={removal.busy}
        onConfirm={() => void removal.confirm()}
      />
    </SidePanel>
  );
}
