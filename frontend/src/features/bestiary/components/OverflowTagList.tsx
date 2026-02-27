import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Tag = { key: string; label: string };

type Props = {
  tags: Tag[];
  tagClassName?: string;
};

/**
 * Renders a single-row list of tags. If the tags would wrap to a second line,
 * shows as many as fit on the first row (minus one slot) plus a "+N" badge.
 */
export default function OverflowTagList({ tags, tagClassName }: Props) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [firstRowCount, setFirstRowCount] = useState(tags.length);

  useLayoutEffect(() => {
    const container = measureRef.current;
    if (!container || tags.length === 0) return;

    const measure = () => {
      const children = Array.from(container.children) as HTMLElement[];
      if (!children.length) return;
      const firstTop = children[0].offsetTop;
      let count = 0;
      for (const el of children) {
        if (el.offsetTop <= firstTop + 4) count++;
        else break;
      }
      setFirstRowCount(count);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [tags]);

  const hasOverflow = tags.length > firstRowCount;
  const displayCount = hasOverflow ? Math.max(firstRowCount - 1, 1) : tags.length;
  const hiddenCount = tags.length - displayCount;

  return (
    <div className="relative">
      {/* Hidden measurement layer — always mounted so ResizeObserver can re-measure */}
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute inset-x-0 top-0 flex flex-wrap gap-1"
        aria-hidden="true"
      >
        {tags.map((t) => (
          <span key={t.key} className={tagClassName}>
            {t.label}
          </span>
        ))}
      </div>

      {/* Visible display layer */}
      <div className="flex flex-nowrap gap-1 overflow-hidden">
        {tags.slice(0, displayCount).map((t) => (
          <span key={t.key} className={cn(tagClassName, "shrink-0")}>
            {t.label}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <span className={cn(tagClassName, "shrink-0")}>+{hiddenCount}</span>
        ) : null}
      </div>
    </div>
  );
}
