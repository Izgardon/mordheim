import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { CriticalHitTable } from "@/features/battles/data/critical-hits";

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * The tables for one kind of attack: Melee's four critical hit tables, or Ranged's missile table
 * and the Misfire chart.
 */
export function CriticalHitsSheet({
  open,
  onOpenChange,
  kicker,
  title,
  tables,
}: SheetProps & { kicker: string; title: string; tables: CriticalHitTable[] }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} kicker={kicker} title={title}>
      {tables.map((table) => (
        <section key={table.id} aria-label={table.label} className="flex flex-col">
          <h3 className="pb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            {table.heading ?? table.label}
          </h3>
          <dl className="flex flex-col">
            {table.entries.map((entry) => (
              <div
                key={entry.roll}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 border-t border-line py-2"
              >
                <dt className="font-mono text-sm font-bold text-accent-text">{entry.roll}</dt>
                <dd className="m-0 text-sm text-text2">{entry.result}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </BottomSheet>
  );
}
