import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type TabOption<T extends string> = {
  id: T;
  label: string;
  disabled?: boolean;
  icon?: LucideIcon;
};

type MobileTabsProps<T extends string> = {
  tabs: ReadonlyArray<TabOption<T>>;
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
  listClassName?: string;
  showDivider?: boolean;
};

export default function MobileTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  listClassName,
  showDivider = false,
}: MobileTabsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -120 : 120, behavior: "smooth" });
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative min-w-0">
        {canScrollLeft && (
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 z-10 flex h-full items-center pl-0.5 pr-3"
            style={{ background: "linear-gradient(to right, hsl(0 0% 5%) 40%, transparent)" }}
          >
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        <div ref={scrollRef} className="scrollbar-hidden w-full overflow-x-auto">
          <div
            className={cn(
              "flex min-w-max items-center gap-2 px-2 pb-1 pt-0.5",
              listClassName
            )}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={cn(
                    "mobile-tab-chip flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] transition disabled:pointer-events-none disabled:opacity-60",
                    isActive && "mobile-tab-chip--active"
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {canScrollRight && (
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 z-10 flex h-full items-center pl-3 pr-0.5"
            style={{ background: "linear-gradient(to left, hsl(0 0% 5%) 40%, transparent)" }}
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
      {showDivider ? <div className="mt-1 border-b border-border/60" /> : null}
    </div>
  );
}
