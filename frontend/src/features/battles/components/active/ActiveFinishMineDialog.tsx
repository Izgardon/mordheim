import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeclaredResult } from "@/features/battles/api/battles-api";
import type { FinishMineState } from "@/features/battles/hooks/useFinishMine";
import { cn } from "@/lib/utils";

const CHOICES: { value: DeclaredResult; label: string; hint: string }[] = [
  { value: "won", label: "I won", hint: "You start on the winners' side." },
  { value: "lost", label: "I lost", hint: "Out first, routed, or beaten." },
  {
    value: "undecided",
    label: "Decide when the battle ends",
    hint: "The last player to finish places you.",
  },
];

/**
 * Finish my battle (decision 4): how it went, then your postbattle while the others play on. The
 * last player to finish confirms everyone's results.
 */
export default function ActiveFinishMineDialog({ finishing }: { finishing: FinishMineState }) {
  const { result, isFinishing, error } = finishing;
  return (
    <Dialog open={finishing.isOpen} onOpenChange={finishing.setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finish my battle</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            Your fight is over and your postbattle opens now, while the others play on. You can't go
            back to the fight. Wins and losses are recorded when the battle ends.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="How your battle went" className="space-y-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={result === choice.value}
              onClick={() => finishing.setResult(choice.value)}
              className={cn(
                "battle-inline-panel flex min-h-11 w-full flex-col items-start rounded-xl border border-border/60 px-3 py-2 text-left text-sm text-foreground transition",
                result === choice.value && "border-amber-300/80 bg-amber-900/25"
              )}
            >
              <span className="font-semibold">{choice.label}</span>
              <span className="text-xs text-muted-foreground">{choice.hint}</span>
            </button>
          ))}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => finishing.setIsOpen(false)}>
            Keep fighting
          </Button>
          <Button
            type="button"
            onClick={() => void finishing.finish()}
            disabled={isFinishing || !result}
          >
            {isFinishing ? "Finishing..." : "Finish my battle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
