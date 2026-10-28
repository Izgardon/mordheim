/**
 * One vocabulary for the three roster unit kinds (IMP-37). Heroes, henchmen groups and hired
 * swords share one generic implementation; `UnitKindKey` picks the kind, and these maps pick its
 * wire and form shapes. The keys match the server's item-transfer `source_type` values.
 */
import type { UnitTypeOption } from "@components/unit-selection-section";

import type {
  HenchmenGroup,
  HenchmenGroupFormEntry,
  HenchmenGroupPayload,
  HeroFormEntry,
  NewHenchmenGroupForm,
  NewHeroForm,
  NewHirelingForm,
  HirelingFormEntry,
  WarbandHero,
  WarbandHeroPayload,
  WarbandHireling,
  WarbandHirelingPayload,
} from "./warband-types";

export type UnitKindKey = "hero" | "henchmen_group" | "hireling";

type UnitShapes = {
  hero: {
    unit: WarbandHero;
    form: HeroFormEntry;
    newForm: NewHeroForm;
    payload: WarbandHeroPayload;
  };
  henchmen_group: {
    unit: HenchmenGroup;
    form: HenchmenGroupFormEntry;
    newForm: NewHenchmenGroupForm;
    payload: HenchmenGroupPayload;
  };
  hireling: {
    unit: WarbandHireling;
    form: HirelingFormEntry;
    newForm: NewHirelingForm;
    payload: WarbandHirelingPayload;
  };
};

/** A unit as the sheet (and the unit endpoints' writes) return it: always the detail shape. */
export type Unit<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["unit"];
export type UnitForm<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["form"];
export type UnitPayload<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["payload"];
/** The kind's "Add <unit>" form. */
export type UnitNewForm<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["newForm"];

/** The section and pending-purchase key each kind already uses ("heroes", "henchmen", ...). */
export type UnitSectionKey = Exclude<UnitTypeOption, "stash">;

/** The kind's list in a warband update (`WarbandUpdate`). */
export type UnitListKey = "heroes" | "henchmenGroups" | "hirelings";

/** The kind's list in the sheet payload (the server's `kind.collection`). */
export type UnitCollectionKey = "heroes" | "henchmen_groups" | "hirelings";
