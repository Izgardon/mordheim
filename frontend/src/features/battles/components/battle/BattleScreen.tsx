import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Crosshair,
  Dices,
  Ellipsis,
  Swords,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";
import BattleNotesSheet from "@/features/battles/components/shared/BattleNotesSheet";
import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleScreen as Screen } from "@/features/battles/hooks/useBattleScreen";
import { battleNumberLabel } from "@/features/battles/utils/battle-number";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import { BottomBar, BottomBarButton } from "@/layouts/mobile/BottomBar";
import { cn } from "@/lib/utils";

import BattleDiceSheet from "./BattleDiceSheet";
import BattleFeed from "./BattleFeed";
import BattleMenuSheet, { type BattleMenuRow } from "./BattleMenuSheet";
import BattleRulesSheet from "./BattleRulesSheet";
import CombatSheet, { type CombatOption } from "./CombatSheet";
import { EndFightSheet, FinishSheet } from "./FinishSheets";
import GearSheet from "./GearSheet";
import GroupCard from "./GroupCard";
import KillSheet, { type Killer } from "./KillSheet";
import RoundSheet from "./RoundSheet";
import { NeutralGroupUnits, OtherWarband } from "./SideUnits";
import SideStrip from "./SideStrip";
import UnitCard from "./UnitCard";
import UnitNoteSheet, { type NoteTarget } from "./UnitNoteSheet";
import type { GearTab } from "./UnitCardParts";
import {
  AddNeutralGroupSheet,
  AddUnitSheet,
  EditStatsSheet,
  type EditableUnit,
} from "./UnitSheets";
import {
  allViews,
  battleSections,
  canScore,
  nextStatus,
  sideId,
  type BattleUnitView,
} from "./battle-units";

type Panel =
  | "menu"
  | "dice"
  | "rules"
  | "notes"
  | "edit"
  | "add"
  | "neutral"
  | "leave"
  | "cancel"
  | "end";

const TYPE_SUFFIX: Record<string, string> = {
  hireling: "hired sword",
  pet: "animal",
  custom: "temporary",
};

/**
 * The battle screen (design E's E-Mobile-Battle). On a phone it fills the screen: the
 * top bar (back, the battle and "Round N · live", Next round), the strip of warbands and neutral
 * groups, the feed in its own box, the selected side's units and the bottom bar (Rules, Melee,
 * Ranged, Dice, Menu). On the web the same pieces sit wider: the tools in the header, the strip
 * and the cards in the main column, the feed as a side column.
 */
export default function BattleScreen({ screen, isMobile }: { screen: Screen; isMobile: boolean }) {
  const { campaign, openTool } = useOutletContext<CampaignLayoutContext>();
  const { battle, me, round, sides, sections, feed, canAct, config, items, neutralGroups } = screen;
  const { campaignId, battleId, battleState, rosters } = battle;
  const { participants } = battleState;
  const userId = screen.user?.id;
  const mySide = me ? sideId.warband(me.warband.id) : (sides[0]?.id ?? "");
  const [selected, setSelected] = useState(mySide);
  const side =
    sides.find((entry) => entry.id === selected) ??
    sides.find((entry) => entry.id === mySide) ??
    sides[0];
  const [panel, setPanel] = useState<Panel | null>(null);
  const [addGroupKey, setAddGroupKey] = useState<string | undefined>(undefined);
  const [killer, setKiller] = useState<Killer | null>(null);
  const [gear, setGear] = useState<{ unit: PrebattleUnit; tab: GearTab } | null>(null);
  const [combat, setCombat] = useState<"melee" | "ranged" | null>(null);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const openNote = (view: BattleUnitView, name = view.unit.displayName) =>
    setNoteTarget({ key: view.unit.key, name, notes: view.info?.notes ?? "" });
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
    const yours: CombatOption[] = sections
      ? allViews(sections)
          .filter((view) => view.status !== "out_of_action")
          .map((view) => ({ key: view.unit.key, name: view.unit.displayName, stats: view.stats }))
      : [];
    const theirs: CombatOption[] = otherSides.flatMap((entry): CombatOption[] =>
      entry.kind === "neutral"
        ? entry.group.creatures.map((creature) => ({
            key: creature.key,
            name: `${creature.name} (neutral)`,
            stats: entry.group.stats ?? {},
          }))
        : allViews(battleSections(entry.participant, rosters[entry.participant.user.id])).map(
            (view) => ({
              key: view.unit.key,
              name: `${view.unit.displayName} (${entry.name})`,
              stats: view.stats,
            })
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
  const fightingOthers = participants.filter(
    (entry) => entry.status === "in_battle" && entry.user.id !== userId
  );
  const menuRows: BattleMenuRow[] = [
    ...(screen.canFinishMine
      ? [
          {
            label: "End my battle",
            detail: "I won, I lost or decide when it ends",
            onSelect: () => screen.finishing.setIsOpen(true),
          },
        ]
      : []),
    ...(canAct
      ? [
          {
            label: "Edit stats",
            detail: "Temporary changes for this battle",
            onSelect: () => setPanel("edit"),
          },
          {
            label: "Add a unit",
            detail: "To your warband or a neutral group",
            onSelect: () => {
              setAddGroupKey(undefined);
              setPanel("add");
            },
          },
          {
            label: "Add a neutral group",
            detail: "Monsters or bystanders nobody plays",
            onSelect: () => setPanel("neutral"),
          },
        ]
      : []),
    ...(me
      ? [
          {
            label: "Battle notes",
            detail: "Scenario, objectives, house rules",
            onSelect: () => setPanel("notes"),
          },
        ]
      : []),
    { label: "Chat", detail: "The campaign chat", onSelect: () => openTool("chat") },
    {
      label: "Notifications",
      detail: "Invites, nudges and the rest",
      onSelect: () => openTool("bell"),
    },
    ...(screen.canNudge
      ? fightingOthers.map((entry) => {
          const wait = screen.nudging.waitFor(entry.user.id);
          return {
            label: `Nudge ${entry.user.label}`,
            detail:
              wait > 0
                ? `Again in ${Math.ceil(wait / 60000)} min`
                : "A reminder that the battle waits for him",
            disabled: wait > 0 || screen.nudging.sendingTo === entry.user.id,
            onSelect: () => void screen.nudging.nudge(entry.user.id, entry.user.label),
          };
        })
      : []),
    ...(manages && battleState.battle.status === "active"
      ? [
          {
            label: "End the fight for everyone",
            detail: "Battle manager: for a stuck fight",
            onSelect: () => setPanel("end"),
          },
        ]
      : []),
    ...(screen.canCancelBattle
      ? [
          {
            label: "Cancel the battle",
            detail: "For everyone; nothing is kept",
            danger: true,
            onSelect: () => setPanel("cancel"),
          },
        ]
      : []),
    {
      label: "Leave battle",
      detail: "Back to the campaign; Rejoin brings you back",
      danger: true,
      onSelect: () => setPanel("leave"),
    },
  ];

  const killerFor = (name: string, models: BattleUnitView[]) => setKiller({ name, models });
  const card = (view: BattleUnitView) => (
    <UnitCard
      key={view.unit.key}
      view={view}
      typeLine={[view.unit.unitType, TYPE_SUFFIX[view.unit.kind]].filter(Boolean).join(" · ")}
      canAct={canAct}
      saving={Boolean(config.savingUnitKeys[view.unit.key])}
      onKill={canScore(view.unit) ? () => killerFor(view.unit.displayName, [view]) : undefined}
      onCycle={() => void screen.setStatus(view, nextStatus(view.status))}
      onWounds={(delta) => void config.adjustUnitWounds(view.unit, delta)}
      onDismount={(dismounted) => void screen.setDismounted(view.unit.key, dismounted)}
      onOpen={(tab) => setGear({ unit: view.unit, tab })}
      onNote={() => openNote(view)}
    />
  );

  const mine = sections ? (
    <div
      className={cn(
        "grid gap-2.5",
        isMobile ? "" : "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]"
      )}
    >
      {sections.heroes.map(card)}
      {sections.swords.map(card)}
      {sections.pets.map(card)}
      {sections.groups.map((entry) => (
        <GroupCard
          key={entry.group.id}
          entry={entry}
          canAct={canAct}
          savingKeys={config.savingUnitKeys}
          onKill={() => killerFor(entry.group.name, entry.members)}
          onCycle={(key) => {
            const member = entry.members.find((candidate) => candidate.unit.key === key);
            if (member) void screen.setStatus(member, nextStatus(member.status));
          }}
          onWounds={(key, delta) => {
            const member = entry.members.find((candidate) => candidate.unit.key === key);
            if (member) void config.adjustUnitWounds(member.unit, delta);
          }}
          onOpen={(tab) => setGear({ unit: entry.members[0].unit, tab })}
          onNote={(key) => {
            const member = entry.members.find((candidate) => candidate.unit.key === key);
            if (member) openNote(member, entry.group.name);
          }}
        />
      ))}
      {sections.temporary.map(card)}
      {canAct ? (
        <button
          type="button"
          onClick={() => {
            setAddGroupKey(undefined);
            setPanel("add");
          }}
          className="col-span-full min-h-12 border border-dashed border-strong text-[13px] font-bold text-accent-text"
        >
          Add a unit
        </button>
      ) : null}
    </div>
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
    <OtherWarband side={side} roster={rosters[side.participant.user.id]} />
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
      className={isMobile ? "h-[118px]" : "h-[min(60vh,560px)]"}
    />
  );
  const strip = <SideStrip sides={sides} selectedId={side?.id ?? ""} onSelect={setSelected} />;

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
        canAct={canAct}
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
      <BattleDiceSheet {...panelProps("dice")} />
      <BattleRulesSheet
        {...panelProps("rules")}
        campaignId={campaignId}
        scenario={scenario}
        scenarioLink={battleState.battle.scenario_link}
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
          notes={me.battle_notes ?? ""}
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
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-6 pt-2.5">
          {feedBox}
          {config.actionError ? (
            <p className="m-0 text-sm text-danger">{config.actionError}</p>
          ) : null}
          {shown}
        </div>
        <div className="shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
          <BottomBar label="Battle tools">
            <BottomBarButton
              label="Rules"
              icon={BookOpen}
              aria-haspopup="dialog"
              onClick={() => setPanel("rules")}
            />
            <BottomBarButton
              label="Melee"
              icon={Swords}
              aria-haspopup="dialog"
              onClick={() => setCombat("melee")}
            />
            <BottomBarButton
              label="Ranged"
              icon={Crosshair}
              aria-haspopup="dialog"
              onClick={() => setCombat("ranged")}
            />
            <BottomBarButton
              label="Dice"
              icon={Dices}
              aria-haspopup="dialog"
              className="font-bold text-accent-hi"
              onClick={() => setPanel("dice")}
            />
            <BottomBarButton
              label="Menu"
              icon={Ellipsis}
              aria-haspopup="dialog"
              onClick={() => setPanel("menu")}
            />
          </BottomBar>
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
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="toolbar"
          aria-label="Battle tools"
        >
          <Button variant="secondary" onClick={() => setPanel("rules")}>
            <BookOpen aria-hidden="true" /> Rules
          </Button>
          <Button variant="secondary" onClick={() => setCombat("melee")}>
            <Swords aria-hidden="true" /> Melee
          </Button>
          <Button variant="secondary" onClick={() => setCombat("ranged")}>
            <Crosshair aria-hidden="true" /> Ranged
          </Button>
          <Button variant="secondary" onClick={() => setPanel("dice")}>
            <Dices aria-hidden="true" /> Dice
          </Button>
          <Button variant="secondary" onClick={() => setPanel("menu")}>
            <Ellipsis aria-hidden="true" /> Menu
          </Button>
          {nextRoundButton}
        </div>
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
