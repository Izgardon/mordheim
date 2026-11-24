import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import BattleNotesSheet from "@/features/battles/components/shared/BattleNotesSheet";
import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleScreen as Screen } from "@/features/battles/hooks/useBattleScreen";
import { battleNumberLabel } from "@/features/battles/utils/battle-number";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { useTabScroll } from "@/lib/use-tab-scroll";
import { cn } from "@/lib/utils";

import BattleFeed from "./BattleFeed";
import BattleMenuSheet, { type BattleMenuRow } from "./BattleMenuSheet";
import { battleMenu } from "./battle-menu";
import BattleRulesSheet from "./BattleRulesSheet";
import BattleTools, { type BattleTool } from "./BattleTools";
import type { CombatOption } from "./CombatPicker";
import CombatSheet from "./CombatSheet";
import { EndFightSheet, FinishSheet } from "./FinishSheets";
import GearSheet from "./GearSheet";
import KillSheet, { type Killer } from "./KillSheet";
import RoundSheet from "./RoundSheet";
import { NeutralGroupUnits, OtherWarband } from "./SideUnits";
import SideStrip from "./SideStrip";
import UnitNoteSheet, { type NoteTarget } from "./UnitNoteSheet";
import type { GearTab } from "./UnitCardParts";
import WarbandUnits, { type WarbandUnitActions } from "./WarbandUnits";
import {
  AddNeutralGroupSheet,
  AddUnitSheet,
  EditStatsSheet,
  type EditableUnit,
} from "./UnitSheets";
import {
  allViews,
  battleSectionLabel,
  battleSections,
  nextStatus,
  sideId,
  type BattleUnitView,
} from "./battle-units";

type Panel = "menu" | "rules" | "notes" | "edit" | "add" | "neutral" | "leave" | "cancel" | "end";

/**
 * The battle screen (design E's E-Mobile-Battle). On a phone it fills the screen: the
 * top bar (back, the battle and "Round N · live", Next round), the strip of warbands and neutral
 * groups, the feed in its own box, the selected side's units and the bottom bar (Rules, Melee,
 * Dice, Ranged, Menu: `BattleTools`). On the web the same pieces sit wider: the tools in the header, the strip
 * and the cards in the main column, the feed as a side column.
 */
export default function BattleScreen({ screen, isMobile }: { screen: Screen; isMobile: boolean }) {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const { battle, me, round, sides, sections, feed, canAct, config, items, neutralGroups } = screen;
  const { campaignId, battleId, battleState, rosters } = battle;
  const { participants } = battleState;
  const userId = screen.user?.id;
  const mySide = me ? sideId.warband(me.warband.id) : (sides[0]?.id ?? "");
  const [selected, setSelected] = useState(mySide);
  // on the web the strip scrolls with the page: picking a side keeps it at the top of the screen
  const sideTabs = useTabScroll();
  const side =
    sides.find((entry) => entry.id === selected) ??
    sides.find((entry) => entry.id === mySide) ??
    sides[0];
  const [panel, setPanel] = useState<Panel | null>(null);
  const [addGroupKey, setAddGroupKey] = useState<string | undefined>(undefined);
  const [killer, setKiller] = useState<Killer | null>(null);
  // `theirs`: another warband's unit, so the sheet offers nothing (item use included)
  const [gear, setGear] = useState<{ unit: PrebattleUnit; tab: GearTab; theirs?: boolean } | null>(
    null
  );
  const [combat, setCombat] = useState<"melee" | "ranged" | null>(null);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const openNote = (view: BattleUnitView, name = view.unit.displayName) =>
    setNoteTarget({ key: view.unit.key, name, notes: view.info?.notes ?? "" });
  const openTool = (tool: BattleTool) => {
    if (tool === "melee" || tool === "ranged") setCombat(tool);
    else setPanel(tool);
  };
  const panelProps = (which: Panel) => ({
    open: panel === which,
    onOpenChange: (open: boolean) => setPanel(open ? which : null),
  });

  // The next round: an ask from someone else pops up until you agree or say Not yet.
  const request = battleState.battle.round_request ?? null;
  const live = request && request.round === round + 1 ? request : null;
  const requestId = live ? `${live.round}:${live.asked_by}` : "";
  const iAgreed = Boolean(live && userId !== undefined && live.agreed.includes(userId));
  const [roundSheet, setRoundSheet] = useState<"asked" | "incoming" | null>(null);
  const [dismissed, setDismissed] = useState("");
  const incoming = Boolean(live && !iAgreed && canAct && dismissed !== requestId);
  const roundMode = roundSheet ?? (incoming ? "incoming" : null);
  const lastRound = useRef(round);
  useEffect(() => {
    if (round !== lastRound.current) {
      lastRound.current = round;
      setRoundSheet(null);
      toast(`Round ${round} began.`, {
        description: "Knocked down models stood up; stunned ones are knocked down.",
      });
    }
  }, [round]);
  useEffect(() => {
    if (!requestId) setRoundSheet((current) => (current === "incoming" ? null : current));
  }, [requestId]);

  const nextRound = async () => {
    if (!live) {
      const answer = await screen.changeTheRound("ask");
      if (answer && (answer.battle.round ?? 1) === round) setRoundSheet("asked");
      return;
    }
    if (live.asked_by === userId || iAgreed) {
      setRoundSheet("asked");
    } else {
      setDismissed("");
      setRoundSheet("incoming");
    }
  };

  const otherSides = sides.filter((entry) => entry.id !== mySide);
  const combatOptions = useMemo(() => {
    const option = (view: BattleUnitView, side?: string): CombatOption => {
      const heading = battleSectionLabel(view.unit);
      return {
        key: view.unit.key,
        name: view.unit.displayName,
        stats: view.stats,
        section: side ? `${side} · ${heading}` : heading,
      };
    };
    const yours: CombatOption[] = sections
      ? allViews(sections)
          .filter((view) => view.status !== "out_of_action")
          .map((view) => option(view))
      : [];
    // with more than one other side, each heading names whose models they are
    const several = otherSides.length > 1;
    const theirs: CombatOption[] = otherSides.flatMap((entry): CombatOption[] =>
      entry.kind === "neutral"
        ? entry.group.creatures.map((creature) => ({
            key: creature.key,
            name: creature.name,
            stats: entry.group.stats ?? {},
            section: `${entry.name} (neutral)`,
          }))
        : allViews(battleSections(entry.participant, rosters[entry.participant.user.id])).map(
            (view) => option(view, several ? entry.name : undefined)
          )
    );
    return { yours, theirs };
  }, [otherSides, rosters, sections]);

  const editable: EditableUnit[] = sections
    ? [
        ...[...sections.heroes, ...sections.swords, ...sections.pets, ...sections.temporary].map(
          (view) => ({
            key: view.unit.key,
            name: view.unit.displayName,
            keys: [view.unit.key],
            view,
          })
        ),
        ...sections.groups.map(({ group, members }) => ({
          key: `group:${group.id}`,
          name: `${group.name} (every member)`,
          keys: members.map((member) => member.unit.key),
          view: members[0],
        })),
      ]
    : [];

  const manages = campaignCapabilities(campaign).manage_battles;
  const menuRows: BattleMenuRow[] = battleMenu({
    canFinishMine: screen.canFinishMine,
    canAct,
    fighting: Boolean(me),
    canEndForEveryone: manages && battleState.battle.status === "active",
    canCancel: screen.canCancelBattle,
  }).map((row) => ({
    ...row,
    onSelect: () => {
      if (row.action === "finish-mine") {
        screen.finishing.setIsOpen(true);
        return;
      }
      if (row.action === "add") setAddGroupKey(undefined);
      setPanel(row.action);
    },
  }));

  const killerFor = (name: string, models: BattleUnitView[]) => setKiller({ name, models });
  const myActions: WarbandUnitActions = {
    canAct,
    savingKeys: config.savingUnitKeys,
    onKill: killerFor,
    onStatus: (view) => void screen.setStatus(view, nextStatus(view.status)),
    onWounds: (unit, delta) => void config.adjustUnitWounds(unit, delta),
    onDismount: (key, dismounted) => void screen.setDismounted(key, dismounted),
    onNote: (view, name) => openNote(view, name),
    onAdd: () => {
      setAddGroupKey(undefined);
      setPanel("add");
    },
  };
  const openGear = (unit: PrebattleUnit, tab: GearTab, theirs = false) =>
    setGear({ unit, tab, theirs });

  const mine = sections ? (
    <WarbandUnits
      sections={sections}
      isMobile={isMobile}
      onOpen={(unit, tab) => openGear(unit, tab)}
      actions={myActions}
    />
  ) : (
    <p className="m-0 text-sm text-muted-foreground">You aren't fighting in this battle.</p>
  );

  const shown = !side ? null : side.kind === "neutral" ? (
    <NeutralGroupUnits
      group={side.group}
      canAct={canAct}
      onCycle={(key, next) => void screen.changeCreature(key, { status: next })}
      onWounds={(key, wounds) => void screen.changeCreature(key, { wounds })}
      onAdd={() => {
        setAddGroupKey(side.group.key);
        setPanel("add");
      }}
      onRemove={() => void screen.removeGroup(side.group.key)}
    />
  ) : side.mine ? (
    mine
  ) : (
    <OtherWarband
      side={side}
      roster={rosters[side.participant.user.id]}
      isMobile={isMobile}
      onOpen={(unit, tab) => openGear(unit, tab, true)}
    />
  );

  const scenario = battleState.battle.scenario || `Battle #${battleId}`;
  const numbered = battleNumberLabel(battleState.battle.number);
  const roundLine = (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "h-[7px] w-[7px]",
          battleState.battle.status === "active" ? "bg-good" : "bg-muted-foreground"
        )}
      />
      {[
        isMobile ? numbered : "",
        `Round ${round}`,
        battleState.battle.status === "active" ? "live" : battleState.battle.status,
      ]
        .filter(Boolean)
        .join(" · ")}
    </div>
  );
  const nextRoundButton = (
    <button
      type="button"
      disabled={!canAct}
      onClick={() => void nextRound()}
      className="flex min-h-11 shrink-0 items-center gap-1.5 border border-accent-line bg-accent-soft px-3 text-[13px] font-bold text-accent-hi disabled:opacity-50"
    >
      Next round
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
  const back = () => screen.leave();
  const feedBox = (
    <BattleFeed
      lines={feed}
      onUndo={(id) => void screen.undo(id).catch(() => undefined)}
      className={isMobile ? "max-h-[118px]" : "h-[min(60vh,560px)]"}
    />
  );
  const strip = (
    <SideStrip
      sides={sides}
      selectedId={side?.id ?? ""}
      barRef={sideTabs.barRef}
      onSelect={(id) => {
        if (!isMobile) sideTabs.pick();
        setSelected(id);
      }}
    />
  );

  const sheets = (
    <>
      <KillSheet
        killer={killer}
        round={round}
        sides={otherSides}
        rosters={rosters}
        onOpenChange={(open) => (open ? null : setKiller(null))}
        onSave={screen.recordKill}
      />
      <GearSheet
        campaignId={campaignId}
        target={gear}
        canAct={canAct && !gear?.theirs}
        usedCount={screen.getUsedSingleUseItemCount}
        busyKey={items.activeItemActionKey}
        onOpenChange={(open) => (open ? null : setGear(null))}
        onUse={(unit, itemId) => {
          const item =
            unit.singleUseItems?.find((entry) => entry.id === itemId) ??
            unit.items
              ?.filter((entry) => entry.id === itemId)
              .map((entry) => ({ id: entry.id, name: entry.name, quantity: entry.count }))[0];
          if (item) void items.logItemUse(unit, item);
        }}
        onUndoUse={(unit, itemId) => void items.undoItemUse(unit, itemId).catch(() => undefined)}
      />
      <RoundSheet
        mode={roundMode}
        round={round}
        request={live}
        participants={participants}
        neutralGroups={neutralGroups}
        userId={userId}
        canForce={screen.canForceRound}
        onOpenChange={(open) => {
          if (open) return;
          if (roundMode === "incoming") setDismissed(requestId);
          setRoundSheet(null);
        }}
        onNotYet={() => {
          setDismissed(requestId);
          setRoundSheet(null);
        }}
        onAction={screen.changeTheRound}
      />
      <CombatSheet
        kind={combat}
        yours={combatOptions.yours}
        theirs={combatOptions.theirs}
        onOpenChange={(open) => (open ? null : setCombat(null))}
      />
      <UnitNoteSheet
        target={noteTarget}
        readOnly={!canAct}
        onOpenChange={(open) => (open ? null : setNoteTarget(null))}
        onSave={config.saveUnitNotes}
      />
      <BattleRulesSheet
        {...panelProps("rules")}
        campaignId={campaignId}
        scenario={scenario}
        scenarioLink={battleState.battle.scenario_link}
        warbands={participants.map((participant) => participant.warband)}
      />
      <BattleMenuSheet {...panelProps("menu")} kicker={scenario} rows={menuRows} />
      <FinishSheet finishing={screen.finishing} />
      <EditStatsSheet {...panelProps("edit")} units={editable} onSave={config.saveUnitOverride} />
      <AddUnitSheet
        {...panelProps("add")}
        draft={config.customUnitDraft}
        groups={neutralGroups}
        canAddToWarband={Boolean(me)}
        initialGroup={addGroupKey}
        onAddToWarband={config.addCustomUnit}
        onAddCreature={screen.addCreature}
      />
      <AddNeutralGroupSheet
        {...panelProps("neutral")}
        campaignId={campaignId}
        onAdd={async (group) => {
          await screen.addGroup(group);
          const groups = battle.battleStateRef.current?.battle.neutral_groups ?? [];
          const added = groups[groups.length - 1];
          if (added) setSelected(sideId.neutral(added.key));
        }}
      />
      <EndFightSheet
        {...panelProps("end")}
        campaignId={campaignId}
        battleId={battleId}
        participants={participants}
        applyBattleResponse={battle.applyBattleResponse}
      />
      {me ? (
        <BattleNotesSheet
          {...panelProps("notes")}
          notes={battleState.your_notes ?? ""}
          onSave={config.saveBattleNotes}
        />
      ) : null}
      <ConfirmDialog
        {...panelProps("leave")}
        description="Back to the campaign? The battle goes on; Rejoin brings you back to it."
        confirmText="Leave"
        cancelText="Stay"
        onConfirm={back}
      />
      <ConfirmDialog
        {...panelProps("cancel")}
        description="Cancel this battle for everyone? Nothing in it is kept."
        confirmText="Cancel battle"
        cancelText="Keep fighting"
        isConfirming={screen.creatorCancel.isCanceling}
        error={screen.creatorCancel.error}
        onConfirm={() => void screen.creatorCancel.cancel()}
      />
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-30 flex flex-col bg-page text-ink">
        <header className="flex shrink-0 items-center gap-1 border-b border-line bg-rail pb-2 pl-1 pr-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
          <IconButton look="plain" aria-label="Back to the campaign" onClick={back}>
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <h1 className="m-0 truncate font-display text-[17px] font-semibold text-head">
              {scenario}
            </h1>
            {roundLine}
          </div>
          {nextRoundButton}
        </header>
        <div className="shrink-0 border-b border-line bg-bar px-3 py-2">{strip}</div>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-3 pb-6 pt-2.5">
          {feedBox}
          {config.actionError ? (
            <p className="m-0 text-sm text-danger">{config.actionError}</p>
          ) : null}
          {shown}
        </div>
        <div className="shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
          <BattleTools isMobile onOpen={openTool} />
        </div>
        {sheets}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            {campaign?.name ?? "Battle"} · {numbered || "battle"}
          </span>
          <h1 className="m-0 font-display text-[28px] font-semibold text-head">{scenario}</h1>
          {roundLine}
        </div>
        <BattleTools isMobile={false} onOpen={openTool}>
          {nextRoundButton}
        </BattleTools>
      </header>
      {strip}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(300px,360px)] items-start gap-6">
        <main className="flex min-w-0 flex-col gap-2.5">
          {config.actionError ? (
            <p className="m-0 text-sm text-danger">{config.actionError}</p>
          ) : null}
          {shown}
        </main>
        <aside className="sticky top-4 flex flex-col gap-3">{feedBox}</aside>
      </div>
      {sheets}
    </div>
  );
}
