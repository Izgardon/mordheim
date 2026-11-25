/** What a battle menu row does when it's picked. */
export type BattleMenuAction =
  | "finish-mine"
  | "edit"
  | "add"
  | "neutral"
  | "notes"
  | "cancel"
  | "end";

export type BattleMenuItem = {
  action: BattleMenuAction;
  label: string;
  /** What the row does, in a few words (William, 25 Nov 2026: "shorten all subtitles"). */
  detail: string;
  danger?: boolean;
};

/** The menu's two parts: what you do in the fight, then the rows that end it. */
export type BattleMenuSection = { id: "fight" | "end"; label?: string; items: BattleMenuItem[] };

/** What the player may do in this battle, from the server's capabilities. */
export type BattleMenuFlags = {
  canFinishMine: boolean;
  /** You have a warband in this fight and it isn't over: the actions that change it. */
  canAct: boolean;
  /** You have a warband in this fight (finished or not): your battle notes. */
  fighting: boolean;
  canEndForEveryone: boolean;
  canCancel: boolean;
};

const when = <T>(flag: boolean, rows: T[]) => (flag ? rows : []);

/**
 * The battle menu's rows (William, 25 Nov 2026: "Cancel should be very bottom, end my battle
 * should then be above end for everyone ... a clearer divide between the top menu items and the
 * game ending items"): Edit stats, Add a unit, Add a neutral group and Battle notes, then under
 * End, End my battle, End the fight for everyone and Cancel the battle last. There is no Leave
 * battle: the top bar's back arrow leaves. A part with no rows is left out.
 */
export function battleMenu(flags: BattleMenuFlags): BattleMenuSection[] {
  const fight: BattleMenuItem[] = [
    ...when<BattleMenuItem>(flags.canAct, [
      { action: "edit", label: "Edit stats", detail: "This battle only" },
      { action: "add", label: "Add a unit", detail: "Your warband or a neutral group" },
      { action: "neutral", label: "Add a neutral group", detail: "Monsters or bystanders" },
    ]),
    ...when<BattleMenuItem>(flags.fighting, [
      { action: "notes", label: "Battle notes", detail: "Only you see them" },
    ]),
  ];
  const end: BattleMenuItem[] = [
    ...when<BattleMenuItem>(flags.canFinishMine, [
      {
        action: "finish-mine",
        label: "End my battle",
        detail: "To your Post battle; others play on",
      },
    ]),
    ...when<BattleMenuItem>(flags.canEndForEveryone, [
      {
        action: "end",
        label: "End the fight for everyone",
        detail: "Pick winners; all go to Post battle",
        danger: true,
      },
    ]),
    ...when<BattleMenuItem>(flags.canCancel, [
      {
        action: "cancel",
        label: "Cancel the battle",
        detail: "For everyone; nothing is kept",
        danger: true,
      },
    ]),
  ];
  return [
    { id: "fight" as const, items: fight },
    { id: "end" as const, label: "End", items: end },
  ].filter((section) => section.items.length > 0);
}
