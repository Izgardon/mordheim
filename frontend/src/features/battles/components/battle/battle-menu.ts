/** What a battle menu row does when it's picked. */
export type BattleMenuAction =
  | "finish-mine"
  | "edit"
  | "add"
  | "neutral"
  | "notes"
  | "leave"
  | "cancel"
  | "end";

export type BattleMenuItem = {
  action: BattleMenuAction;
  label: string;
  detail?: string;
  danger?: boolean;
};

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

/**
 * The battle menu's rows, in order (William, 18 Nov 2026, from his phone: "leave the battle
 * should move up one and not be red, end the fight for everyone should be red and at the bottom").
 * Leaving is yours alone and reversible, so it is the plain row above the ones that end the fight
 * for everybody else too; those are red and last. Chat and Notifications are gone from here
 * ("Don't need chat, notifications or nudge"); Nudge went with the feature.
 */
export function battleMenu(flags: BattleMenuFlags): BattleMenuItem[] {
  return [
    ...(flags.canFinishMine ? [{ action: "finish-mine", label: "End my battle" } as const] : []),
    ...(flags.canAct
      ? ([
          { action: "edit", label: "Edit stats" },
          { action: "add", label: "Add a unit" },
          { action: "neutral", label: "Add a neutral group" },
        ] as const)
      : []),
    ...(flags.fighting ? [{ action: "notes", label: "Battle notes" } as const] : []),
    {
      action: "leave",
      label: "Leave battle",
      detail: "Back to the campaign; Rejoin brings you back",
    },
    ...(flags.canCancel
      ? [
          {
            action: "cancel",
            label: "Cancel the battle",
            detail: "For everyone; nothing is kept",
            danger: true,
          } as const,
        ]
      : []),
    ...(flags.canEndForEveryone
      ? [{ action: "end", label: "End the fight for everyone", danger: true } as const]
      : []),
  ];
}
