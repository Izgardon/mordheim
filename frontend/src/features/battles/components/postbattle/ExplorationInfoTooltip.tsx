import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
/** The exploration table (dice total to shards found, the server's), behind an info button. */
export default function ExplorationInfoTooltip({
  rows,
}: {
  rows: { diceResult: string; shardsFound: string }[];
}) {
  return (
    <Tooltip
      trigger={
        <Button
          type="button"
          variant="icon"
          size="icon"
          className="h-8 w-8 border-none bg-transparent p-0 shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Show exploration shard table"
        >
          <Info className="h-4 w-4" />
        </Button>
      }
      minWidth={260}
      contentClassName="tooltip-unfurl fixed z-[60] overflow-y-auto rounded-sm border border-border/70 bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      content={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Shards Found
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border border-border/60 bg-black/20 text-foreground">
                <th className="border border-border/60 px-3 py-2 font-semibold">Dice Result</th>
                <th className="border border-border/60 px-3 py-2 font-semibold">Shards Found</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.diceResult} className="border border-border/60">
                  <td className="border border-border/60 px-3 py-2 text-foreground">
                    {row.diceResult}
                  </td>
                  <td className="border border-border/60 px-3 py-2 text-foreground">
                    {row.shardsFound}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
}
