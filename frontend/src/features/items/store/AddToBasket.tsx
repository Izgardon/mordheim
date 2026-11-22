import { cn } from "@/lib/utils";

import type { Recipient } from "./useStoreBasket";

type AddToBasketProps = {
  recipients: Recipient[];
  /** The unit the store was opened for: its button is highlighted. */
  firstKey: string | null;
  each: number;
  free: boolean;
  isMobile: boolean;
  /** Off: a rare item not yet found (nor No search ticked); the buttons wait. */
  enabled: boolean;
  onAdd: (recipient: Recipient) => void;
};

/** One button per recipient with its total (a henchmen group ×members), which puts it in the basket. */
export default function AddToBasket(props: AddToBasketProps) {
  const buttons = props.recipients.map((recipient) => {
    const mine = recipient.key === props.firstKey;
    const total = props.free ? "free" : `${props.each * recipient.count} gc`;
    const count = recipient.count > 1 ? ` ×${recipient.count}` : "";
    return (
      <button
        key={recipient.key}
        type="button"
        disabled={!props.enabled}
        onClick={() => props.onAdd(recipient)}
        className={cn(
          "border px-3 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50",
          props.isMobile ? "min-h-11" : "min-h-[38px]",
          mine
            ? "border-primary bg-primary text-on-accent"
            : "border-accent-line bg-page text-accent-hi enabled:hover:bg-accent-soft"
        )}
      >
        {recipient.label}
        {count} · {total}
      </button>
    );
  });
  return <div className="flex flex-wrap gap-1.5">{buttons}</div>;
}
