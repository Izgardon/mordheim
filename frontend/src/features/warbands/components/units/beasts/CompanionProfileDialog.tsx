import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { BeastKindLabel } from "@/features/bestiary/components/BeastKindIcon";
import UnitStatsTable from "../../shared/unit_details/UnitStatsTable";
import CompanionAbilityLines from "./CompanionAbilityLines";

import type { UnitMount, UnitPet } from "../../../types/companion-types";

type CompanionProfileDialogProps = {
  kind: "mount" | "pet";
  companion: UnitMount | UnitPet;
  unitName: string;
  /** Offer Switch off (editors). */
  canSwitchOff: boolean;
  busy: boolean;
  onSwitchOff: () => void;
  onClose: () => void;
};

/** A mount's or pet's profile, opened from its chip on the unit card, with Switch off. */
export default function CompanionProfileDialog({
  kind,
  companion,
  unitName,
  canSwitchOff,
  busy,
  onSwitchOff,
  onClose,
}: CompanionProfileDialogProps) {
  const bonus = "rating_bonus" in companion ? companion.rating_bonus : null;
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{companion.name}</DialogTitle>
          <DialogDescription>
            {kind === "mount" ? `Ridden by ${unitName}.` : `${unitName}'s pet.`}
          </DialogDescription>
        </DialogHeader>
        <BeastKindLabel kind={kind} className="text-sm" />
        {companion.has_profile && companion.stats ? (
          <UnitStatsTable stats={companion.stats} variant="summary" showTooltips={false} />
        ) : (
          <p className="text-sm text-muted-foreground">No profile</p>
        )}
        {bonus ? <p className="text-sm text-foreground">Rider rating: +{bonus}</p> : null}
        <CompanionAbilityLines
          skills={companion.skills}
          specials={companion.specials}
          spells={companion.spells}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canSwitchOff ? (
            <Button onClick={onSwitchOff} disabled={busy}>
              {busy ? "Switching off..." : "Switch off"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
