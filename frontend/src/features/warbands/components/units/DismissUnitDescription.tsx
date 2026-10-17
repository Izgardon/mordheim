type DismissUnitDescriptionProps = {
  /** "dismiss", "disband". */
  verb: string;
  name: string;
  /** A queued recruit has nothing to lose: dropping it just takes it out of the queue. */
  isQueued?: boolean;
  /** When the unit goes: "when you save" in an edit, "now" for an immediate write. */
  when?: string;
};

/**
 * What dismissing a unit costs (decision 3, ROST-TWEAK-02/03): it goes when you save, nothing
 * is refunded, and the items it carries go with it.
 */
export default function DismissUnitDescription({
  verb,
  name,
  isQueued = false,
  when = "when you save",
}: DismissUnitDescriptionProps) {
  const unitName = <span className="font-semibold text-foreground">{name}</span>;
  if (isQueued) {
    return <span>Remove the queued recruit {unitName}? Nothing has been paid for it yet.</span>;
  }
  return (
    <span className="block space-y-2">
      <span className="block">
        Are you sure you want to {verb} {unitName}? The unit is removed {when}, and no gold is
        refunded.
      </span>
      <span className="block font-semibold text-foreground">
        All items this unit carries are lost. Move them to the stash first to keep them.
      </span>
    </span>
  );
}
