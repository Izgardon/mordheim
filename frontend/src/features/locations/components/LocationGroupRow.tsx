import { Button } from "@/components/ui/button";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";

import { locationCount, locationSub } from "../location-filter";
import type { CampaignLocation, LocationGroup } from "../types";
import LocationDetail, { type VisitFrom } from "./LocationDetail";

/** What those who manage locations do from a group's row. */
export type GroupManage = {
  editGroup: (group: LocationGroup) => void;
  removeGroup: (group: LocationGroup) => void;
  addLocation: (group: LocationGroup) => void;
  editLocation: (location: CampaignLocation) => void;
  removeLocation: (location: CampaignLocation) => void;
};

/**
 * One group: open, its description and restrictions, then its locations, each a row of its own
 * that opens to its rules, tables and Visit.
 */
export default function LocationGroupRow({
  campaignId,
  group,
  open,
  onToggle,
  isOpen,
  onToggleLocation,
  visit,
  manage,
}: {
  campaignId: number;
  group: LocationGroup;
  open: boolean;
  onToggle: () => void;
  isOpen: (locationId: number) => boolean;
  onToggleLocation: (locationId: number) => void;
  visit?: VisitFrom | null;
  manage?: GroupManage | null;
}) {
  return (
    <ReferenceRow
      id={`g${group.id}`}
      open={open}
      onToggle={onToggle}
      name={group.name}
      sub={locationCount(group)}
    >
      <div className="flex flex-col gap-3">
        {group.description ? (
          <p className="m-0 whitespace-pre-line text-sm text-text2">{group.description}</p>
        ) : null}
        {group.restrictions ? (
          <p className="m-0 whitespace-pre-line text-sm font-semibold text-ink">
            {group.restrictions}
          </p>
        ) : null}
        {manage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => manage.addLocation(group)}>
              Add location
            </Button>
            <Button size="sm" variant="ghost" onClick={() => manage.editGroup(group)}>
              Edit group
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => manage.removeGroup(group)}
            >
              Remove group
            </Button>
          </div>
        ) : null}
        {group.locations.length ? (
          <ReferenceList isEmpty={false}>
            {group.locations.map((place) => (
              <ReferenceRow
                key={place.id}
                id={`l${place.id}`}
                open={isOpen(place.id)}
                onToggle={() => onToggleLocation(place.id)}
                name={place.name}
                sub={locationSub(place)}
              >
                <LocationDetail
                  campaignId={campaignId}
                  location={place}
                  visit={visit}
                  actions={
                    manage ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => manage.editLocation(place)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger"
                          onClick={() => manage.removeLocation(place)}
                        >
                          Remove
                        </Button>
                      </>
                    ) : null
                  }
                />
              </ReferenceRow>
            ))}
          </ReferenceList>
        ) : null}
      </div>
    </ReferenceRow>
  );
}
