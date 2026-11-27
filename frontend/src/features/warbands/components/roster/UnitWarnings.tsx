import { TriangleAlert } from "lucide-react";

import type { ServerWarning } from "../../types/companion-types";

/**
 * What the server warns of on a unit's card, in its words (a wizard in armour, William, 27 Nov
 * 2026), closed or open: a guide, never a block.
 */
export default function UnitWarnings({ warnings }: { warnings?: ServerWarning[] }) {
  if (!warnings?.length) return null;
  return (
    <div role="alert" className="flex flex-col gap-1">
      {warnings.map((warning) => (
        <p
          key={warning.code}
          className="m-0 flex items-start gap-1.5 text-xs font-semibold text-danger"
        >
          <TriangleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {warning.message}
        </p>
      ))}
    </div>
  );
}
