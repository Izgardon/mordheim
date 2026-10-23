import { useState } from "react";

import type { BattleRosterMount } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

const CHIP =
  "battle-chip inline-flex items-center rounded-full px-3 text-[0.62rem] uppercase tracking-[0.16em]";

/**
 * A rider's Dismounted toggle in an active battle (step 5): off his mount for the rest of the
 * battle, or back on it, as one request his player sends. The others see the state only; a unit
 * on foot shows nothing.
 */
export default function ActiveDismountToggle({
  unitKey,
  name,
  mount,
  dismounted,
  editable,
  onSetDismounted,
}: {
  unitKey: string;
  name: string;
  mount?: BattleRosterMount | null;
  dismounted: boolean;
  /** His player, in action, with nothing of his saving. */
  editable: boolean;
  onSetDismounted?: (unitKey: string, dismounted: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!mount) return null;
  if (!onSetDismounted || !editable) {
    return dismounted ? (
      <span className={cn(CHIP, "h-6 text-amber-200/90")}>Dismounted</span>
    ) : null;
  }

  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      await onSetDismounted(unitKey, !dismounted);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to update the rider"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        // Every action is a 44 px touch target (BATL-UX-05).
        className={cn(
          CHIP,
          "min-h-11 transition disabled:opacity-50",
          dismounted ? "text-amber-200" : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={dismounted}
        aria-label={`${name}: Dismounted`}
        title={
          dismounted
            ? `Back on the ${mount.name}`
            : `Off the ${mount.name} for the rest of the battle`
        }
        disabled={busy}
        onClick={() => void toggle()}
      >
        Dismounted
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-500">
          {error}
        </span>
      ) : null}
    </span>
  );
}
