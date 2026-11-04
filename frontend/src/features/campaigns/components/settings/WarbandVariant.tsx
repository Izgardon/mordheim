import { Chip } from "@/components/ui/chip";
import { useRaiseOutline } from "@/features/warbands/api/warband-template-queries";
import type { Warband } from "@/features/warbands/types/warband-types";

import { CAPTION } from "./settings-ui";

/**
 * The warband's template variant (the templates plan, phase 2): its type's preset, else the one
 * picked when it was raised, changed here. Shown only when its type's template has variants.
 */
export default function WarbandVariant({
  warband,
  canEdit,
  saving,
  onPick,
}: {
  warband: Warband;
  canEdit: boolean;
  saving: boolean;
  onPick: (variant: string) => void;
}) {
  const outline = useRaiseOutline(
    warband.campaign_id,
    warband.warband_type?.id ?? null,
    warband.template_variant ?? ""
  ).data?.template;
  if (!outline?.variants.length) return null;
  const current = warband.template_variant || outline.preset_variant;
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-4">
      <span className={CAPTION}>Variant</span>
      <div role="radiogroup" aria-label="Variant" className="flex flex-wrap gap-1.5">
        {outline.variants.map((entry) => (
          <Chip
            key={entry.key}
            role="radio"
            aria-checked={current === entry.key}
            pressed={current === entry.key}
            disabled={!canEdit || saving}
            onClick={() => (entry.key === current ? undefined : onPick(entry.key))}
          >
            {entry.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
