import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { getErrorMessage } from "@/lib/get-error-message";

import { useLocationGroups, useLocationWrites } from "../api/location-queries";
import { useLocationTree } from "../hooks/useLocationTree";
import type { CampaignLocation, LocationGroup } from "../types";
import LocationDialog, { type LocationEditing } from "./LocationDialog";
import type { VisitFrom } from "./LocationDetail";
import LocationGroupDialog from "./LocationGroupDialog";
import LocationGroupRow, { type GroupManage } from "./LocationGroupRow";

type Removing = { group: LocationGroup } | { location: CampaignLocation } | null;

/**
 * The campaign's locations as a tree: a row per group, opening to its description, restrictions
 * and locations, each a row opening to its rules, tables and Visit (with `visit`). Those who
 * manage locations (`canManage`) add, edit and remove groups and locations here.
 */
export default function LocationTree({
  campaignId,
  canManage,
  visit,
  enabled = true,
  initialSearch,
}: {
  campaignId: number;
  canManage: boolean;
  visit?: VisitFrom | null;
  /** Read the tree (the panel reads it only while it is open). */
  enabled?: boolean;
  /** Searched for this at first: a location a link names. */
  initialSearch?: string;
}) {
  const groups = useLocationGroups(campaignId, { enabled });
  const all = groups.data ?? [];
  const tree = useLocationTree(all, initialSearch, enabled);
  const writes = useLocationWrites(campaignId);
  const [editingGroup, setEditingGroup] = useState<LocationGroup | null | undefined>(undefined);
  const [editing, setEditing] = useState<LocationEditing>(undefined);
  const [removing, setRemoving] = useState<Removing>(null);
  const [removeError, setRemoveError] = useState("");
  const manage: GroupManage | null = canManage
    ? {
        editGroup: setEditingGroup,
        removeGroup: (group) => setRemoving({ group }),
        addLocation: (group) => setEditing({ groupId: group.id }),
        editLocation: (location) => setEditing({ location }),
        removeLocation: (location) => setRemoving({ location }),
      }
    : null;
  const removingName =
    removing && ("group" in removing ? removing.group.name : removing.location.name);
  const confirmRemove = () => {
    if (!removing) return;
    const done = {
      onSuccess: () => setRemoving(null),
      onError: (failure: unknown) =>
        setRemoveError(getErrorMessage(failure, "Couldn't remove it.")),
    };
    setRemoveError("");
    if ("group" in removing) writes.removeGroup.mutate(removing.group.id, done);
    else writes.removeLocation.mutate(removing.location.id, done);
  };

  return (
    <div className="flex flex-col gap-3">
      {canManage ? (
        <Button variant="secondary" className="self-start" onClick={() => setEditingGroup(null)}>
          Add group
        </Button>
      ) : null}
      <Input
        type="search"
        aria-label="Search locations"
        placeholder="Search locations"
        value={tree.search}
        onChange={(event) => tree.setSearch(event.target.value)}
      />
      {groups.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(groups.error)}</p>
      ) : null}
      {groups.isPending && enabled ? (
        <p className="m-0 text-sm text-muted-foreground">Finding the locations…</p>
      ) : (
        <ReferenceList
          isEmpty={!tree.shown.length}
          empty={all.length ? "No location matches." : "No locations yet."}
        >
          {tree.shown.map((group) => (
            <LocationGroupRow
              key={group.id}
              campaignId={campaignId}
              group={group}
              open={tree.groupOpen(group.id)}
              onToggle={() => tree.toggleGroup(group.id)}
              isOpen={tree.placeOpen}
              onToggleLocation={tree.togglePlace}
              visit={visit}
              manage={manage}
            />
          ))}
        </ReferenceList>
      )}
      <LocationGroupDialog
        group={editingGroup}
        onClose={() => setEditingGroup(undefined)}
        writes={writes}
      />
      <LocationDialog
        campaignId={campaignId}
        editing={editing}
        groups={all}
        writes={writes}
        onClose={() => setEditing(undefined)}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={removing && "group" in removing ? "Remove the group" : "Remove the location"}
        description={
          <p className="m-0 text-ink">
            {removing && "group" in removing
              ? `Remove ${removingName} and its locations? They leave the list for everyone in the campaign.`
              : `Remove ${removingName}? It leaves the list for everyone in the campaign.`}
          </p>
        }
        error={removeError}
        confirmText="Remove"
        isConfirming={writes.removeGroup.isPending || writes.removeLocation.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
