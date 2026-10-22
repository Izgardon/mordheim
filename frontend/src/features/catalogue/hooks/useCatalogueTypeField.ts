import { useCallback, useMemo, useState } from "react";
import type { FocusEvent } from "react";

type UseCatalogueTypeFieldOptions = {
  /** The form's type text. */
  value: string;
  /** A typed value is uncommitted until it is picked from the list or added. */
  onChange: (value: string, committed: boolean) => void;
  /** The types the catalogue already uses. */
  typeOptions: readonly string[];
  /** One more to offer: the edited entry's own type. */
  extraOption?: string | null;
};

/**
 * The "search or add" type box of the skill, spell and special forms: the catalogue's types
 * plus any added here, deduplicated in any case and sorted, filtered by what is typed. A typed
 * type counts only once it is picked or added (the form refuses an uncommitted one).
 */
export function useCatalogueTypeField({
  value,
  onChange,
  typeOptions,
  extraOption,
}: UseCatalogueTypeFieldOptions) {
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const allOptions = useMemo(() => {
    const unique = new Map<string, string>();
    const push = (option: string) => {
      const trimmed = option.trim();
      const key = trimmed.toLowerCase();
      if (trimmed && !unique.has(key)) {
        unique.set(key, trimmed);
      }
    };
    typeOptions.forEach(push);
    customTypes.forEach(push);
    if (extraOption) {
      push(extraOption);
    }
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [customTypes, extraOption, typeOptions]);

  const trimmed = value.trim();
  const query = trimmed.toLowerCase();
  const options = useMemo(
    () =>
      query ? allOptions.filter((option) => option.toLowerCase().includes(query)) : allOptions,
    [allOptions, query]
  );
  const exists = Boolean(trimmed && allOptions.some((option) => option.toLowerCase() === query));

  const select = (option: string) => {
    onChange(option, true);
    setIsMenuOpen(false);
  };

  const add = () => {
    if (!trimmed) {
      return;
    }
    if (!exists) {
      setCustomTypes((prev) => [trimmed, ...prev]);
    }
    onChange(trimmed, true);
    setIsMenuOpen(false);
  };

  const reset = useCallback((keepAdded = false) => {
    if (!keepAdded) {
      setCustomTypes([]);
    }
    setIsMenuOpen(false);
  }, []);

  return {
    value,
    options,
    canAdd: Boolean(trimmed && !exists),
    isMenuOpen,
    openMenu: () => setIsMenuOpen(true),
    closeMenu: () => setIsMenuOpen(false),
    /** Focus leaving the box and its list closes the list. */
    handleBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setIsMenuOpen(false);
      }
    },
    type: (next: string) => onChange(next, false),
    select,
    add,
    /** Back to the catalogue's types, list closed; `keepAdded` keeps the types added here. */
    reset,
  };
}

export type CatalogueTypeFieldState = ReturnType<typeof useCatalogueTypeField>;
