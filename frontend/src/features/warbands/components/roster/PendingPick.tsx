import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { SearchCombobox } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import {
  skillOptions,
  specialOption,
  spellOption,
  warnedLast,
} from "@/features/catalogue/search-options";
import { useWhoCan } from "@/features/items/api/who-can-queries";
import { useCatalogue } from "@/lib/catalogue-queries";

import { buildAvailableSkillsPayload, parseAvailableSkills } from "../../utils/warband-utils";
import type { PendingList } from "./unit-view";

const NOUN = { skills: "skill", spells: "spell", specials: "boon or bane" } as const;
const PLURAL = { skills: "skills", spells: "spells", specials: "boons and banes" } as const;

/**
 * A pick an advance left for later ("Skill to choose", or a spell, a boon or bane), made from the card
 * on the searchable select. The warband type's special skills come first (the server's who-can/);
 * skills outside the unit's skill lists and entries outside the campaign's settings carry a
 * warning and can still be picked.
 */
export default function PendingPick({
  campaignId,
  warbandId,
  list,
  access,
  large,
  onPick,
  onClose,
}: {
  campaignId: number;
  warbandId: number;
  list: PendingList;
  /** The unit's `available_skills`, for skills. */
  access?: unknown;
  /** Whether the unit is Large: a Large unit's skill warns for any other. */
  large?: boolean | null;
  onPick: (entryId: number) => void;
  onClose: () => void;
}) {
  const skills = useCatalogue("skills", campaignId, { enabled: list === "skills" }).data;
  const spells = useCatalogue("spells", campaignId, { enabled: list === "spells" }).data;
  const specials = useCatalogue("specials", campaignId, { enabled: list === "specials" }).data;
  const settings = useSettingsById();
  const warbandSkills = useWhoCan(campaignId, list === "skills" ? warbandId : null).specialSkillIds;
  const options =
    list === "skills"
      ? skillOptions(skills ?? [], {
          settings,
          large,
          access: buildAvailableSkillsPayload(parseAvailableSkills(access)),
          specials: warbandSkills,
        })
      : list === "spells"
        ? warnedLast((spells ?? []).map((spell) => spellOption(spell, settings)))
        : warnedLast((specials ?? []).map((special) => specialOption(special, settings)));

  return (
    <div className="flex flex-col gap-2.5 border border-accent-line bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-semibold text-head">
          Pick a new {NOUN[list]}
        </span>
        <IconButton aria-label="Close" className="h-9 w-9" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      <SearchCombobox
        inline
        autoFocus
        label={`Search ${PLURAL[list]}`}
        placeholder={`Search ${PLURAL[list]}`}
        emptyText={`No ${NOUN[list]} matches.`}
        options={options}
        onPick={(option) => onPick(Number(option.id))}
        onDismiss={onClose}
      />
    </div>
  );
}
