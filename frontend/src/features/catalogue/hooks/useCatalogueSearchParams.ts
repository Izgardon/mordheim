import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/** A query-string change: a value sets the parameter, null or "" removes it. */
export type SearchParamChanges = Record<string, string | null>;

const applied = (current: URLSearchParams, changes: SearchParamChanges) => {
  const next = new URLSearchParams(current);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === "") {
      next.delete(name);
    } else {
      next.set(name, value);
    }
  }
  return next;
};

/**
 * A catalogue page's filters in the query string (CAT-NEW-02): `tab`, `subtype`, `type`, `q`,
 * `archived`, a card list's `page` and the open `entry`, so Back and shared links restore them.
 * Filter changes replace the current history entry (typing a search adds none); opening an entry
 * pushes one, so Back closes it.
 */
export function useCatalogueSearchParams() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const set = useCallback(
    (changes: SearchParamChanges) =>
      setParams((current) => applied(current, changes), { replace: true }),
    [setParams]
  );

  return {
    params,
    /** The parameter's value, or `fallback` when it is absent. */
    get: (name: string, fallback = "") => params.get(name) ?? fallback,
    set,
    /** Opens what `changes` name (an entry) as a new history entry, keeping the filters. */
    open: (changes: SearchParamChanges) =>
      navigate({ pathname: location.pathname, search: `?${applied(params, changes)}` }),
    /**
     * Back from what `open` showed: the previous page in the app's history, or, for a link opened
     * fresh (no history in the app, BUG-150), the same page without `names`, its filters kept.
     */
    back: (...names: string[]) => {
      if (location.key !== "default") {
        navigate(-1);
        return;
      }
      const remaining = applied(params, Object.fromEntries(names.map((name) => [name, null])));
      const search = remaining.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "" },
        { replace: true }
      );
    },
  };
}
