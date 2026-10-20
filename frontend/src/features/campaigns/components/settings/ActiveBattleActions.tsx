import { Button } from "@components/button";

import type { ActiveBattleTools } from "../../hooks/useActiveBattleTools";
import type { CampaignActiveBattle } from "../../types/campaign-types";

type ToolButton = { label: string; destructive: boolean; run: () => void };

/**
 * The owner tools that apply to a battle now (BATL-NEW-03), as the server's `actions` say: End a
 * stuck fight, Confirm results, Close postbattle, Cancel. An older server without `actions` gets
 * Close in postbattle and Cancel otherwise, as before.
 */
export default function ActiveBattleActions({
  entry,
  tools,
}: {
  entry: CampaignActiveBattle;
  tools: ActiveBattleTools;
}) {
  const { battle } = entry;
  const actions = entry.actions ?? {
    end: false,
    confirm_results: false,
    close_postbattle: battle.status === "postbattle",
    cancel: battle.status !== "postbattle",
  };
  const buttons = [
    actions.end
      ? { label: "End battle", destructive: false, run: () => tools.askResults(entry, "end") }
      : null,
    actions.confirm_results
      ? {
          label: "Confirm results",
          destructive: false,
          run: () => tools.askResults(entry, "confirm"),
        }
      : null,
    actions.close_postbattle
      ? { label: "Close", destructive: true, run: () => tools.askClose(entry) }
      : null,
    actions.cancel
      ? { label: "Cancel", destructive: true, run: () => tools.askCancel(entry) }
      : null,
  ].filter((button): button is ToolButton => button !== null);

  return (
    <div className="flex flex-col items-end gap-1">
      {buttons.map((button) => (
        <Button
          key={button.label}
          type="button"
          variant={button.destructive ? "destructive" : "default"}
          size="sm"
          className="h-7 whitespace-nowrap px-2 text-[0.58rem]"
          onClick={(event) => {
            event.stopPropagation();
            button.run();
          }}
        >
          {button.label}
        </Button>
      ))}
    </div>
  );
}
