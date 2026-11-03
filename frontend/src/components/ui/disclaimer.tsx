import { cn } from "@/lib/utils";

const LINK = "font-semibold text-text2 underline-offset-2 hover:text-head hover:underline";

/**
 * The fan-site notice mordheimer and Broheim carry (William: "a disclaimer like mordheimers and
 * broheims that we arent affiliated with games workshop"): on the sign-in page, Account and the
 * Rules reference.
 */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("m-0 text-xs text-faint", className)}>
      Mordheim Chronicler is an unofficial fan tool, not affiliated with or endorsed by Games
      Workshop. Mordheim, Warhammer and all associated names and marks are trademarks of Games
      Workshop Ltd, used without permission. No challenge to their status is intended.
    </p>
  );
}

/** Where the catalogue comes from, beside the notice. */
export function DataCredit({ className }: { className?: string }) {
  return (
    <p className={cn("m-0 text-xs text-faint", className)}>
      Warband, item and rules data from{" "}
      <a
        href="https://www.mordheimer.net"
        target="_blank"
        rel="noopener noreferrer"
        className={LINK}
      >
        mordheimer.net
      </a>{" "}
      and{" "}
      <a href="https://broheim.net" target="_blank" rel="noopener noreferrer" className={LINK}>
        broheim.net
      </a>
      .
    </p>
  );
}
