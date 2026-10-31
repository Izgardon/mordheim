import { useState } from "react";
import { BookOpen, Crosshair, Dices, Ellipsis, Swords } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  MELEE_CRITICAL_TABLES,
  RANGED_CRITICAL_TABLES,
} from "@/features/battles/data/critical-hits";

import type { CampaignTool } from "../shell/CampaignTools";
import { BottomBar, BottomBarButton } from "../mobile/BottomBar";
import { SheetButtonRow, SheetRows } from "../mobile/SheetRows";
import { CriticalHitsSheet, RulesSheet } from "./BattleSheets";

/** An action the battle page puts in the Menu (finish my battle, notes, leave the battle). */
export type BattleMenuAction = {
  label: string;
  detail?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Lossy or final: shown in danger colours. */
  danger?: boolean;
};

type BattleToolsBarProps = {
  /** The page's own actions, first in the Menu. */
  actions: BattleMenuAction[];
  /** Opens the dice roller, the chat or the notifications (`CampaignTools`). */
  onOpenTool: (tool: CampaignTool) => void;
  /** Back to the campaign, without leaving the battle. */
  onExit: () => void;
};

type Sheet = "rules" | "melee" | "ranged" | "menu";

/**
 * The phone's bottom bar on a battle route (design E): Rules, Melee, Ranged, Dice, Menu. Melee and
 * Ranged hold the crit tables; the Menu holds the battle's actions, the chat and the
 * notifications (missing in battle before), and the way back to the campaign.
 */
export default function BattleToolsBar({ actions, onOpenTool, onExit }: BattleToolsBarProps) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const sheetProps = (which: Sheet) => ({
    open: sheet === which,
    onOpenChange: (open: boolean) => setSheet(open ? which : null),
  });
  const fromMenu = (run: () => void) => () => {
    setSheet(null);
    run();
  };

  return (
    <>
      <BottomBar label="Battle tools">
        <BottomBarButton
          label="Rules"
          icon={BookOpen}
          aria-haspopup="dialog"
          onClick={() => setSheet("rules")}
        />
        <BottomBarButton
          label="Melee"
          icon={Swords}
          aria-haspopup="dialog"
          onClick={() => setSheet("melee")}
        />
        <BottomBarButton
          label="Ranged"
          icon={Crosshair}
          aria-haspopup="dialog"
          onClick={() => setSheet("ranged")}
        />
        <BottomBarButton
          label="Dice"
          icon={Dices}
          aria-haspopup="dialog"
          className="text-accent-hi"
          onClick={() => onOpenTool("dice")}
        />
        <BottomBarButton
          label="Menu"
          icon={Ellipsis}
          aria-haspopup="dialog"
          onClick={() => setSheet("menu")}
        />
      </BottomBar>

      <RulesSheet {...sheetProps("rules")} />
      <CriticalHitsSheet {...sheetProps("melee")} title="Melee" tableIds={MELEE_CRITICAL_TABLES} />
      <CriticalHitsSheet
        {...sheetProps("ranged")}
        title="Ranged"
        tableIds={RANGED_CRITICAL_TABLES}
      />

      <BottomSheet {...sheetProps("menu")} kicker="Battle" title="Battle menu">
        <SheetRows>
          {actions.map((action) => (
            <SheetButtonRow
              key={action.label}
              label={action.label}
              detail={action.detail}
              danger={action.danger}
              disabled={action.disabled}
              onSelect={fromMenu(action.onSelect)}
            />
          ))}
          <SheetButtonRow label="Chat" onSelect={fromMenu(() => onOpenTool("chat"))} />
          <SheetButtonRow label="Notifications" onSelect={fromMenu(() => onOpenTool("bell"))} />
          <SheetButtonRow label="Back to the campaign" onSelect={fromMenu(onExit)} />
        </SheetRows>
      </BottomSheet>
    </>
  );
}
