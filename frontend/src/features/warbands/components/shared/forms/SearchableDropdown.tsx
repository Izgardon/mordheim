import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { useEffect, useRef } from "react";

type SearchableDropdownProps<T> = {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  inputClassName: string;
  items: T[];
  isOpen: boolean;
  autoFocusInput?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelectItem: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  renderActions?: (item: T) => React.ReactNode;
  getItemKey: (item: T) => string | number;
  emptyMessage?: string;
  canCreate?: boolean;
  onCreateClick?: () => void;
  createLabel?: string;
};

export default function SearchableDropdown<T>({
  query,
  onQueryChange,
  placeholder,
  inputClassName,
  items,
  isOpen,
  autoFocusInput = false,
  onFocus,
  onBlur,
  onSelectItem,
  renderItem,
  renderActions,
  getItemKey,
  emptyMessage = "No matches yet.",
  canCreate = false,
  onCreateClick,
  createLabel = "Create",
}: SearchableDropdownProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const itemClassName =
    "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-xs text-foreground transition-colors";
  const interactiveItemClassName =
    `${itemClassName} hover:bg-[#21170f] hover:text-[color:var(--color-icon-strong)]`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        onBlur?.();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onBlur]);

  useEffect(() => {
    if (!autoFocusInput || !isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const input = containerRef.current?.querySelector("input");
      input?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [autoFocusInput, isOpen]);

  const handleFocus = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onFocus?.();
  };

  const handleBlur = () => {
    blurTimeoutRef.current = window.setTimeout(() => {
      onBlur?.();
    }, 120);
  };

  return (
    <div ref={containerRef} className="relative">
      <ActionSearchInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        inputClassName={inputClassName}
        onFocus={handleFocus}
        onBlur={handleBlur}
        actionLabel={canCreate ? createLabel : undefined}
        actionAriaLabel={canCreate ? `${createLabel} new` : undefined}
        actionClassName="bg-background/70 text-foreground hover:border-primary/60"
        onAction={canCreate ? onCreateClick : undefined}
      />
      <ActionSearchDropdown open={isOpen} className="mt-1 rounded-xl">
        <div className="max-h-60 w-full overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="space-y-2 p-0">
              {items.map((item) =>
                renderActions ? (
                  <div
                    key={getItemKey(item)}
                    className={itemClassName}
                  >
                    {renderItem(item)}
                    {renderActions(item)}
                  </div>
                ) : (
                  <button
                    key={getItemKey(item)}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelectItem(item)}
                    className={interactiveItemClassName}
                  >
                    {renderItem(item)}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </ActionSearchDropdown>
    </div>
  );
}
