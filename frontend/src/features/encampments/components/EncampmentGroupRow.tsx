import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";

import { encampmentCount, holdingLine } from "../encampment-filter";
import type { CampaignEncampment, EncampmentGroup, EncampmentTaker } from "../types";
import EncampmentDetail from "./EncampmentDetail";

/** What those who manage encampments do from a group's row. */
export type GroupManage = {
  editGroup: (group: EncampmentGroup) => void;
  removeGroup: (group: EncampmentGroup) => void;
  addEncampment: (group: EncampmentGroup) => void;
  editEncampment: (encampment: CampaignEncampment) => void;
  removeEncampment: (encampment: CampaignEncampment) => void;
};

/** An encampment's name, with Fortified beside it where it is. */
function NameOf({ camp }: { camp: CampaignEncampment }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {camp.name}
      {camp.fortified ? <ChipLabel className="min-h-[22px] px-2">Fortified</ChipLabel> : null}
    </span>
  );
}

/** One group: open, its description, then its encampments edge to edge, each a row of its own. */
export default function EncampmentGroupRow({
  campaignId,
  group,
  takers,
  open,
  onToggle,
  isOpen,
  onToggleCamp,
  manage,
}: {
  campaignId: number;
  group: EncampmentGroup;
  takers: EncampmentTaker[];
  open: boolean;
  onToggle: () => void;
  isOpen: (id: number) => boolean;
  onToggleCamp: (id: number) => void;
  manage?: GroupManage | null;
}) {
  return (
    <ReferenceRow
      id={`g${group.id}`}
      open={open}
      onToggle={onToggle}
      name={group.name}
      sub={encampmentCount(group)}
    >
      <div className="flex flex-col gap-3">
        {group.description ? (
          <p className="m-0 whitespace-pre-line text-sm text-text2">{group.description}</p>
        ) : null}
        {manage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => manage.addEncampment(group)}>
              Add encampment
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
        {group.encampments.length ? (
          <div className="-mx-3">
            <ReferenceList isEmpty={false}>
              {group.encampments.map((camp) => (
                <ReferenceRow
                  key={camp.id}
                  id={`e${camp.id}`}
                  open={isOpen(camp.id)}
                  onToggle={() => onToggleCamp(camp.id)}
                  name={<NameOf camp={camp} />}
                  sub={holdingLine(camp)}
                >
                  <EncampmentDetail
                    campaignId={campaignId}
                    encampment={camp}
                    takers={takers}
                    actions={
                      manage ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => manage.editEncampment(camp)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            onClick={() => manage.removeEncampment(camp)}
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
          </div>
        ) : null}
      </div>
    </ReferenceRow>
  );
}
