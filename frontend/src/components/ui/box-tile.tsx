import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * item: carried gear; mount: a mount (accent); skill, special and spell: each with its own accent;
 * pending: a pick an advance left; quiet: a plain rule.
 */
export type BoxTileKind = "item" | "mount" | "skill" | "special" | "spell" | "pending" | "quiet";

const KIND_STYLES: Record<BoxTileKind, { box: string; name: string; type: string; icon: string }> =
  {
    item: {
      box: "border-border bg-raised",
      name: "text-ink",
      type: "text-muted-foreground",
      icon: "text-accent-text",
    },
    mount: {
      box: "border-accent-line bg-accent-soft",
      name: "text-accent-hi",
      type: "text-accent-text",
      icon: "text-accent-hi",
    },
    skill: {
      box: "border-border border-l-kind-skill bg-transparent",
      name: "text-ink",
      type: "text-muted-foreground",
      icon: "text-kind-skill",
    },
    special: {
      box: "border-border border-l-kind-special bg-transparent",
      name: "text-ink",
      type: "text-muted-foreground",
      icon: "text-kind-special",
    },
    spell: {
      box: "border-border border-l-kind-spell bg-transparent",
      name: "text-ink",
      type: "text-muted-foreground",
      icon: "text-kind-spell",
    },
    pending: {
      box: "border-dashed border-accent-line bg-transparent",
      name: "text-accent-text",
      type: "text-muted-foreground",
      icon: "text-accent-text",
    },
    quiet: {
      box: "border-border bg-transparent",
      name: "text-ink",
      type: "text-muted-foreground",
      icon: "text-muted-foreground",
    },
  };

type BoxTileProps = {
  name: string;
  /** The line under the name: an item's kind, a skill's list, a spell's lore. */
  type?: string;
  kind?: BoxTileKind;
  /** What the entry is, before its name (a game icon). */
  icon?: ReactNode;
  /** Selected (its detail is open): the border turns accent. */
  pressed?: boolean;
  /** Makes the tile a button that toggles `pressed`. */
  onClick?: () => void;
  className?: string;
};

/**
 * An item, skill, special or spell box in a unit's rows, told apart by icon and accent. At
 * most 200 px wide (William): a long name or second line ends in "…", the full text in its title.
 */
export function BoxTile({
  name,
  type,
  kind = "item",
  icon,
  pressed = false,
  onClick,
  className,
}: BoxTileProps) {
  const styles = KIND_STYLES[kind];
  const accented = kind === "skill" || kind === "special" || kind === "spell";
  const classes = cn(
    "flex min-h-12 min-w-[118px] max-w-[200px] items-center gap-2 border px-[11px] py-1.5 text-left",
    accented && "border-l-[3px] pl-[9px]",
    styles.box,
    pressed && "border-primary",
    className
  );
  const content = (
    <>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn("flex shrink-0 [&_svg]:h-[18px] [&_svg]:w-[18px]", styles.icon)}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-px">
        <span title={name} className={cn("truncate text-[13px] font-bold", styles.name)}>
          {name}
        </span>
        {type ? (
          <span title={type} className={cn("truncate text-[11px]", styles.type)}>
            {type}
          </span>
        ) : null}
      </span>
    </>
  );

  return onClick ? (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-kind={kind}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {content}
    </button>
  ) : (
    <div data-kind={kind} className={classes}>
      {content}
    </div>
  );
}
