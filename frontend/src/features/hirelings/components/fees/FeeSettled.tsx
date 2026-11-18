import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A fee nothing charges (a fee in his rules, a hired sword paid in something other than gold): its
 * words from the server and a **Paid** button, which records what was settled on the hire's ledger
 * row and moves no gold, no resource and no counter (William, 18 Nov 2026).
 */
export default function FeeSettled({
  settle,
  paid,
  onChange,
}: {
  /** The server's words for what the fee asks (`fee.settle`); the row is only shown for some. */
  settle: string;
  paid: boolean;
  onChange: (paid: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-accent-line bg-accent-soft p-2.5">
      <span className="min-w-40 flex-1 text-[13px] text-ink">{settle}</span>
      <Button
        size="sm"
        variant={paid ? "primary" : "secondary"}
        aria-pressed={paid}
        onClick={() => onChange(!paid)}
      >
        {paid ? <Check aria-hidden="true" /> : null}
        Paid
      </Button>
    </div>
  );
}
