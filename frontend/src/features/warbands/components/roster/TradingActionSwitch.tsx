import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** A hero's trading action: the switch asks before it gives the action or takes it away. */
export default function TradingActionSwitch({
  on,
  canEdit,
  onChange,
}: {
  on: boolean;
  canEdit: boolean;
  onChange: (on: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Switch checked={on} disabled={!canEdit} onCheckedChange={() => setConfirming(true)}>
        Trading action
      </Switch>
      {confirming ? (
        <>
          <Button
            size="sm"
            onClick={() => {
              setConfirming(false);
              onChange(!on);
            }}
          >
            {on ? "Take it away" : "Give the trading action"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : null}
    </div>
  );
}
