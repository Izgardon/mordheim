/**
 * The warband's gold in the page header. While a section has recruits or purchases queued, it
 * shows what will be left after Save, e.g. "440 gc (60 pending)", in red below zero (decision 1).
 */
export default function GoldLabel({ gold, pending = 0 }: { gold: number; pending?: number }) {
  if (pending <= 0) {
    return <span>{gold}</span>;
  }
  const remaining = gold - pending;
  return (
    <span className="whitespace-nowrap">
      <span className={remaining < 0 ? "text-red-400" : undefined}>{remaining} gc</span>{" "}
      <span className="text-[10px] font-normal opacity-80">({pending} pending)</span>
    </span>
  );
}
