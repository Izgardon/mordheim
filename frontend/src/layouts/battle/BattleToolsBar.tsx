import { useState } from "react";
import { BookOpen, Crosshair, Dices, Ellipsis, Swords } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  CRITICAL_HIT_TABLES,
  MELEE_CRITICAL_TABLES,
  RANGED_CRITICAL_TABLES,
} from "@/features/battles/data/critical-hits";
import BattleRulesSheet from "@/features/battles/components/battle/BattleRulesSheet";
import type { BattleScenario } from "@/features/scenarios/components/ScenarioSheet";
import { MISFIRE_TABLE } from "@/features/battles/data/misfire";

import { BottomBar, BottomBarButton } from "../mobile/BottomBar";
import { SheetButtonRow, SheetRows } from "../mobile/SheetRows";
import { CriticalHitsSheet } from "./BattleSheets";

/** An action the battle page puts in the Menu (finish my battle, notes, leave the battle). */
export type BattleMenuAction = {
  label: string;
  detail?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Lossy or final: shown in danger colours. */
  danger?: boolean;
};

/** What the Rules sheet shows of the battle: its scenario and its warbands' own rules. */
export type BattleRulesInfo = {
  scenario: BattleScenario;
  warbands: { id: number; name: string }[];
};

type BattleToolsBarProps = {
  campaignId: number;
  /** The page's battle, for the Rules sheet; null before the page has read it. */
  rules: BattleRulesInfo | null;
  /** The page's own actions, first in the Menu. */
  actions: BattleMenuAction[];
  /** Opens the dice roller (`CampaignTools`). */
  onOpenDice: () => void;
};

type Sheet = "rules" | "melee" | "ranged" | "menu";

const crits = (ids: string[]) => CRITICAL_HIT_TABLES.filter((table) => ids.includes(table.id));

/**
 * The phone's bottom bar on a battle route (design E): Rules, Melee, Dice, Ranged, Menu, Dice in the
 * middle as on the battle screen (William, 24 Nov 2026). Melee and
 * Ranged hold the crit tables (Ranged the Misfire chart too); the Menu holds the battle's actions only, as the active
 * battle's does (William, 24 Nov 2026: trimmed of chat and the rest; the top bar goes back).
 */
export default function BattleToolsBar({
  campaignId,
  rules,
  actions,
  onOpenDice,
}: BattleToolsBarProps) {
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
          label="Dice"
          icon={Dices}
          aria-haspopup="dialog"
          className="text-accent-hi"
          onClick={onOpenDice}
        />
        <BottomBarButton
          label="Ranged"
          icon={Crosshair}
          aria-haspopup="dialog"
          onClick={() => setSheet("ranged")}
        />
        <BottomBarButton
          label="Menu"
          icon={Ellipsis}
          aria-haspopup="dialog"
          onClick={() => setSheet("menu")}
        />
      </BottomBar>

      {/* the active battle's Rules sheet, the same five pills (William, 24 Nov 2026) */}
      <BattleRulesSheet
        {...sheetProps("rules")}
        campaignId={campaignId}
        scenario={rules?.scenario ?? null}
        warbands={rules?.warbands ?? []}
      />
      <CriticalHitsSheet
        {...sheetProps("melee")}
        kicker="Critical hits"
        title="Melee"
        tables={crits(MELEE_CRITICAL_TABLES)}
      />
      <CriticalHitsSheet
        {...sheetProps("ranged")}
        kicker="Critical hits and misfires"
        title="Ranged"
        tables={[...crits(RANGED_CRITICAL_TABLES), MISFIRE_TABLE]}
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
        </SheetRows>
      </BottomSheet>
    </>
  );
}
