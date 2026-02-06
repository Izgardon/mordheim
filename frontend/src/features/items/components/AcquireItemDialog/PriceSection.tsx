type PriceSectionProps = {
  cost: number;
  variable?: string | null;
};

export default function PriceSection({ cost, variable }: PriceSectionProps) {
  const hasVariable = Boolean(variable && variable.trim());

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center rounded-2xl border border-border/60 bg-background/80 px-4 py-2 shadow-[0_8px_18px_rgba(5,20,24,0.18)]">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          Price: {cost}
          {hasVariable ? <span className="text-muted-foreground"> + {variable}</span> : null}
        </span>
      </div>
    </div>
  );
}
