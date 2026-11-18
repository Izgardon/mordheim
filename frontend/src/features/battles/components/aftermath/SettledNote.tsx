import type { ReactNode } from "react";

/**
 * Over an aftermath step already applied (William, 18 Nov 2026): it is in the warband, so this says
 * so and where to change it instead. A step whose results reached a unit is still editable here and
 * changes the battle's record; the gold and items found are read-only, because they left the
 * aftermath (`aftermath-locks.ts`).
 */
export default function SettledNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="m-0 border border-accent-line bg-panel px-3.5 py-2.5 text-[13px] text-ink"
    >
      {children}
    </p>
  );
}
