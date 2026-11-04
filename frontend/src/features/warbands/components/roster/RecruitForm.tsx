import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useWarbandHireTemplate } from "../../api/warband-template-queries";
import { useRecruit } from "../../hooks/units/useRecruit";
import type { UnitKindKey } from "../../types/units";
import type { WarbandResource } from "../../types/warband-types";
import ByHandRecruit from "../recruit/ByHandRecruit";
import RecruitAsPicker, { BY_HAND } from "../recruit/RecruitAsPicker";
import TemplateRecruit from "../recruit/TemplateRecruit";

const FIGHTER_KIND = { hero: "hero", henchmen_group: "henchman" } as const;

/**
 * The inline recruit form at the top of its roster section (William: "an inline form rather
 * than a modal"). With a template (the templates plan, phase 2), Add hero and Add group start on
 * Recruit as: a fighter picked fills the hire from the template, with the kit and the tally;
 * someone not in the template, or a hired sword not in the list, is typed by hand. Once saved,
 * the new card opens in Edit for the rest.
 */
export default function RecruitForm({
  kind,
  campaignId,
  warbandId,
  typeName,
  gold,
  resources,
  existingIds,
  canCreateRace,
  onCancel,
  onCreated,
}: {
  kind: UnitKindKey;
  campaignId: number;
  warbandId: number;
  /** The warband's type, which its template is for ("Reiklanders"). */
  typeName: string;
  /** The warband's gold, which the tally takes the hire from. */
  gold: number;
  resources: WarbandResource[];
  /** The ids of the kind on the roster now, to find the new one. */
  existingIds: number[];
  canCreateRace: boolean;
  onCancel: () => void;
  /** The new card's key, to open it in Edit. */
  onCreated: (key: string) => void;
}) {
  const fromTemplate = kind !== "hireling";
  const template = useWarbandHireTemplate(campaignId, warbandId, fromTemplate);
  const { recruitFromTemplate, saving } = useRecruit(kind, warbandId, existingIds);
  const [as, setAs] = useState("");
  const answer = template.data;
  const wanted = kind === "hireling" ? null : FIGHTER_KIND[kind];
  const fighters = (answer?.template?.fighters ?? []).filter((fighter) => fighter.kind === wanted);
  const fighter = fighters.find((entry) => entry.key === as);
  const byHand = !fighters.length || as === BY_HAND;

  let body;
  if (fromTemplate && template.isPending) {
    body = <p className="m-0 text-[13px] text-muted-foreground">Reading the template…</p>;
  } else if (fighter && answer?.template) {
    body = (
      <TemplateRecruit
        key={fighter.key}
        fighter={fighter}
        lists={answer.template.lists}
        listPricesOpen={answer.list_prices_open}
        gold={gold}
        saving={saving}
        onRecruit={(hire) =>
          void recruitFromTemplate(hire).then((key) => (key ? onCreated(key) : undefined))
        }
        onCancel={onCancel}
      />
    );
  } else if (byHand) {
    body = (
      <ByHandRecruit
        kind={kind}
        campaignId={campaignId}
        warbandId={warbandId}
        resources={resources}
        existingIds={existingIds}
        canCreateRace={canCreateRace}
        onCancel={onCancel}
        onCreated={onCreated}
      />
    );
  } else {
    body = (
      <Button type="button" variant="ghost" className="self-start" onClick={onCancel}>
        Cancel
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-accent-line bg-panel p-3.5">
      {fighters.length ? (
        <RecruitAsPicker title={typeName} fighters={fighters} value={as} onPick={setAs} />
      ) : null}
      {body}
    </div>
  );
}
