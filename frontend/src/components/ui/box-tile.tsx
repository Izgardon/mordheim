import { cn } from "@/lib/utils";

/** item: carried gear; mount: a mount (accent); injury: a lasting injury (danger); quiet: a rule. */
export type BoxTileKind = "item" | "mount" | "injury" | "quiet";

const KIND_STYLES: Record<BoxTileKind, { box: string; name: string; type: string }> = {
  item: { box: "border-border bg-raised", name: "text-ink", type: "text-muted-foreground" },
  mount: {
    box: "border-accent-line bg-accent-soft",
    name: "text-accent-hi",
    type: "text-accent-text",
  },
  injury: { box: "border-danger-line bg-danger-bg", name: "text-danger", type: "text-danger" },
  quiet: { box: "border-border bg-transparent", name: "text-ink", type: "text-muted-foreground" },
};

type BoxTileProps = {
  name: string;
  /** The line under the name: an item's kind, a skill's list. */
  type?: string;
  kind?: BoxTileKind;
  /** Selected (its detail is open): the border turns accent. */
  pressed?: boolean;
  /** Makes the tile a button that toggles `pressed`. */
  onClick?: () => void;
  className?: string;
};

/** An item, skill, special or injury box in a unit's rows. */
export function BoxTile({
  name,
  type,
  kind = "item",
  pressed = false,
  onClick,
  className,
}: BoxTileProps) {
  const styles = KIND_STYLES[kind];
  const classes = cn(
    "flex min-h-12 min-w-[118px] flex-col justify-center gap-px border px-[11px] py-1.5 text-left",
    styles.box,
    pressed && "border-primary",
    className
  );
  const content = (
    <>
      <span className={cn("text-[13px] font-bold", styles.name)}>{name}</span>
      {type ? <span className={cn("text-[11px]", styles.type)}>{type}</span> : null}
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
