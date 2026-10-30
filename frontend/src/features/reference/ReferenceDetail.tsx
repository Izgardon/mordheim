import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ReferenceDetailProps = {
  /** The web's heading: the name again, big, with its kind line. */
  title?: string;
  kind?: string;
  isMobile: boolean;
  /** The web's right-hand column (Get this item, who can buy, source); under the rules on a phone. */
  aside?: ReactNode;
  children: ReactNode;
};

/**
 * An open row (E-Web-Items): the rules on the left, the actions and who can use it on the right;
 * on a phone everything in one column under the row.
 */
export function ReferenceDetail({ title, kind, isMobile, aside, children }: ReferenceDetailProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-10 gap-y-5",
        !isMobile &&
          "border-t border-accent-line bg-panel px-6 pb-6 pt-5 shadow-[inset_2px_0_0_var(--color-accent)]",
        isMobile && "flex-col gap-y-3"
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-3.5", !isMobile && "flex-[999_1_520px]")}>
        {!isMobile && title ? (
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
            <h2 className="m-0 font-display text-[26px] font-semibold leading-tight text-head">
              {title}
            </h2>
            {kind ? <span className="text-[13px] text-muted-foreground">{kind}</span> : null}
          </div>
        ) : null}
        {children}
      </div>
      {aside ? (
        <div
          className={cn(
            "flex min-w-0 flex-col gap-5",
            isMobile ? "w-full gap-3" : "flex-[1_1_300px]"
          )}
        >
          {aside}
        </div>
      ) : null}
    </div>
  );
}

/** The italic fluff line under a heading. */
export function Flavour({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 max-w-[68ch] whitespace-pre-line font-display text-[15px] italic leading-normal text-text2">
      {children}
    </p>
  );
}

/** A row of key figures (Range, Strength, Cost): a ruled strip. */
export function FactLine({ facts }: { facts: { label: string; value: ReactNode }[] }) {
  if (!facts.length) return null;
  return (
    <dl className="m-0 flex flex-wrap gap-x-7 gap-y-1.5 border-y border-line py-2.5">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline gap-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
            {fact.label}
          </dt>
          <dd className="m-0 font-mono text-[13px] text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One named rule and its text (a property, a special, a spell's effect). */
export function RuleBlock({ name, children }: { name: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <h3 className="m-0 text-[15px] font-bold text-head">{name}</h3>
      {children ? (
        <div className="max-w-[72ch] whitespace-pre-line text-sm leading-relaxed text-text2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A captioned block of the right-hand column: "Who can buy", "Source". */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{title}</h3>
      {children}
    </section>
  );
}

/** Small labels (who can buy, skill lists); `mine` picks out the ones that are your warband's. */
export function TagList({ tags }: { tags: { label: string; mine?: boolean }[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.label}
          className={cn(
            "border px-[7px] py-0.5 text-xs font-semibold",
            tag.mine
              ? "border-accent-line bg-accent-soft text-accent-hi"
              : "border-border text-text2"
          )}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
