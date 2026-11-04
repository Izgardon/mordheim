import { Input } from "@/components/ui/input";

import type { TemplateFighter, TemplateList } from "../../types/hire-template-types";
import HireKit from "../recruit/HireKit";
import RecruitAsPicker, { BY_HAND } from "../recruit/RecruitAsPicker";
import { fighterLines, listNames } from "../recruit/hire-draft";

const fieldLabel = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Camp's Recruit for a new group: with a template, Recruit as its henchmen (the type, race,
 * profile and rules come from the fighter; his lists to look at, as the store kits him out after
 * the battle) or someone not in it; the group's name, and its type when typed by hand.
 */
export default function CampNewGroup({
  typeName,
  fighters,
  lists,
  as,
  onAs,
  name,
  onName,
  type,
  onType,
}: {
  typeName: string;
  fighters: TemplateFighter[];
  lists: TemplateList[];
  /** The picked fighter's key, BY_HAND, or "" before a pick. */
  as: string;
  onAs: (key: string) => void;
  name: string;
  onName: (name: string) => void;
  type: string;
  onType: (type: string) => void;
}) {
  const fighter = fighters.find((entry) => entry.key === as);
  const byHand = !fighters.length || as === BY_HAND;
  return (
    <>
      {fighters.length ? (
        <RecruitAsPicker title={typeName} fighters={fighters} value={as} onPick={onAs} />
      ) : null}
      {fighter || byHand ? (
        <div className="grid grid-cols-2 gap-2.5">
          <label className={fieldLabel}>
            Group name
            <Input value={name} onChange={(e) => onName(e.target.value)} />
          </label>
          {fighter ? null : (
            <label className={fieldLabel}>
              Type
              <Input value={type} onChange={(e) => onType(e.target.value)} />
            </label>
          )}
        </div>
      ) : null}
      {fighter ? (
        <HireKit
          lists={listNames(fighter, lists)}
          lines={fighterLines(fighter, lists)}
          offLines={fighter.off_lines}
          open={false}
          picks={[]}
          onToggle={() => undefined}
        />
      ) : null}
    </>
  );
}
