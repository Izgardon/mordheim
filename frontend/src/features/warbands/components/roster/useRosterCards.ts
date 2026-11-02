import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { UnitKindKey } from "../../types/units";

const RECRUITS: UnitKindKey[] = ["hero", "henchmen_group", "hireling"];

const scrollTo = (key: string) =>
  requestAnimationFrame(() =>
    document.getElementById(`unit-${key}`)?.scrollIntoView?.({ block: "start" })
  );

/**
 * Which roster card is open and which is in Edit, and the inline recruit form. A link opens a
 * card (`?unit=hero-12`, from Search everything) or puts it straight into Edit (`&edit=1`, after
 * a hire or a camp recruit), and `?recruit=hireling` opens the form; those two are read once.
 */
export function useRosterCards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get("unit");
  const linkedEdit = searchParams.get("edit") === "1";
  const param = searchParams.get("recruit") as UnitKindKey | null;
  const linkedRecruit = param && RECRUITS.includes(param) ? param : null;
  const [openKey, setOpenKey] = useState<string | null>(linked);
  const [editKey, setEditKey] = useState<string | null>(linked && linkedEdit ? linked : null);
  const [recruiting, setRecruiting] = useState<UnitKindKey | null>(linkedRecruit);

  useEffect(() => {
    if (!linked) return;
    setOpenKey(linked);
    if (linkedEdit) setEditKey(linked);
    scrollTo(linked);
  }, [linked, linkedEdit]);

  useEffect(() => {
    if (linkedRecruit) setRecruiting(linkedRecruit);
  }, [linkedRecruit]);

  useEffect(() => {
    if (!linkedEdit && !linkedRecruit) return;
    const params = new URLSearchParams(searchParams);
    params.delete("edit");
    params.delete("recruit");
    setSearchParams(params, { replace: true });
  }, [linkedEdit, linkedRecruit, searchParams, setSearchParams]);

  return {
    openKey,
    editKey,
    recruiting,
    setRecruiting,
    toggle: (key: string) => {
      setOpenKey((current) => (current === key ? null : key));
      setEditKey(null);
    },
    startEdit: (key: string) => {
      setOpenKey(key);
      setEditKey(key);
    },
    stopEdit: () => setEditKey(null),
    /** A unit just recruited: the form closes and its card opens in Edit. */
    recruited: (key: string) => {
      setRecruiting(null);
      setOpenKey(key);
      setEditKey(key);
      scrollTo(key);
    },
  };
}
