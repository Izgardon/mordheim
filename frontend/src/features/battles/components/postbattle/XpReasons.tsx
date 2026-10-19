import { Info } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";

export type XpReason = { label: string; xp: number };

/** "survived +1, 2 kills +2, winning leader +1" ("no level-ups" stands alone). */
export const reasonsText = (reasons: XpReason[]) =>
  reasons
    .map((reason) =>
      reason.xp === 0 ? reason.label : `${reason.label} ${reason.xp > 0 ? "+" : ""}${reason.xp}`
    )
    .join(", ");

/**
 * Why the server suggests this XP (BATL-NEW-09): its reasons in a tooltip that opens on hover,
 * focus or a tap. The field stays editable.
 */
export default function XpReasons({
  unitName,
  xp,
  reasons,
}: {
  unitName: string;
  xp: number;
  reasons: XpReason[] | undefined;
}) {
  if (!reasons || reasons.length === 0) {
    return null;
  }
  const text = reasonsText(reasons);
  return (
    <Tooltip
      trigger={
        <span
          role="img"
          tabIndex={0}
          aria-label={`Why ${xp} XP for ${unitName}: ${text}`}
          className="flex h-11 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
      }
      content={<span className="text-xs">Suggested: {text}</span>}
      maxWidth={260}
    />
  );
}
