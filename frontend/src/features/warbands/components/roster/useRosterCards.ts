import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { RecruitKind } from "../../hooks/units/useRecruit";
import type { UnitKindKey } from "../../types/units";
import type { PendingList } from "./unit-view";

/**
 * Lands on a unit just hired from outside the roster (the hire drawer, the hired swords page): his
 * card collapsed like every other, scrolled to (William, 21 Nov 2026), `?recruited=<kind>-<id>`.
 */
export const RECRUITED_PARAM = "recruited";
export const recruitedLink = (kind: UnitKindKey, id: number) => `${RECRUITED_PARAM}=${kind}-${id}`;

/**
 * Opens a unit's card in Edit from outside the roster (the camp's Recruit): the link the roster
 * reads, `?unit=<kind>-<id>&edit=1`. With no id (the unit wasn't found) it does nothing.
 */
export function useOpenInEdit() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (kind: UnitKindKey, id: number | undefined) => {
    if (id === undefined) return;
    const params = new URLSearchParams(searchParams);
    params.set("unit", `${kind}-${id}`);
    params.set("edit", "1");
    setSearchParams(params, { replace: true });
  };
}

/** The id of the unit in `after` that `before` didn't have (a batch answers every unit of a kind). */
export const newUnitId = (before: { id: number }[], after: { id: number }[]) =>
  after.find((unit) => !before.some((known) => known.id === unit.id))?.id;

/** Scrolls to the card, waiting (up to about two seconds) for it to render: a hire's card only
 * arrives with the sheet read again after it. */
const scrollTo = (key: string, framesLeft = 120) =>
  requestAnimationFrame(() => {
    const card = document.getElementById(`unit-${key}`);
    if (card) card.scrollIntoView?.({ block: "start" });
    else if (framesLeft > 0) scrollTo(key, framesLeft - 1);
  });

/**
 * Which roster card is open and which is in Edit, and the inline recruit form (Add hero, Add
 * group). A link opens a card (`?unit=hero-12`, from Search everything) or puts it straight into
 * Edit (`&edit=1`, after a camp recruit, read once); `?recruited=` lands on a hire's card, closed.
 */
export function useRosterCards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get("unit");
  const linkedEdit = searchParams.get("edit") === "1";
  const [openKey, setOpenKey] = useState<string | null>(linked);
  const [editKey, setEditKey] = useState<string | null>(linked && linkedEdit ? linked : null);
  const [recruiting, setRecruiting] = useState<RecruitKind | null>(null);
  // the pick a closed card's "Skill to choose" opened it on
  const [picking, setPicking] = useState<{ key: string; list: PendingList } | null>(null);

  useEffect(() => {
    if (!linked) return;
    setOpenKey(linked);
    if (linkedEdit) setEditKey(linked);
    scrollTo(linked);
  }, [linked, linkedEdit]);

  const landed = searchParams.get(RECRUITED_PARAM);
  useEffect(() => {
    if (!landed) return;
    setOpenKey(null);
    setEditKey(null);
    scrollTo(landed);
    const params = new URLSearchParams(searchParams);
    params.delete(RECRUITED_PARAM);
    setSearchParams(params, { replace: true });
  }, [landed, searchParams, setSearchParams]);

  useEffect(() => {
    if (!linkedEdit) return;
    const params = new URLSearchParams(searchParams);
    params.delete("edit");
    setSearchParams(params, { replace: true });
  }, [linkedEdit, searchParams, setSearchParams]);

  return {
    openKey,
    editKey,
    recruiting,
    setRecruiting,
    toggle: (key: string) => {
      setOpenKey((current) => (current === key ? null : key));
      setEditKey(null);
      setPicking(null);
    },
    /** Opens the card on the box of its first pick on `list` (a closed card's picks to choose). */
    openAtPick: (key: string, list: PendingList) => {
      setOpenKey(key);
      setEditKey(null);
      setPicking({ key, list });
    },
    /** The list a card was opened to pick from, while it is the one open. */
    pickingOn: (key: string) => (picking?.key === key ? picking.list : undefined),
    startEdit: (key: string) => {
      setOpenKey(key);
      setEditKey(key);
      setPicking(null);
    },
    stopEdit: () => setEditKey(null),
    /**
     * A unit just recruited: the form closes and his card sits collapsed like every other, scrolled
     * to (William, 20 Nov 2026: "after creating a unit from a template it should go straight to the
     * minimised unit card not edit form").
     */
    recruited: (key: string) => {
      setRecruiting(null);
      setOpenKey(null);
      setEditKey(null);
      scrollTo(key);
    },
  };
}
