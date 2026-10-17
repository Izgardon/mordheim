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
  HiredSwordFormEntry,
  WarbandHero,
  WarbandHeroPayload,
  WarbandHiredSword,
  WarbandHiredSwordPayload,
} from "./warband-types";

export type UnitKindKey = "hero" | "henchmen_group" | "hired_sword";

type UnitShapes = {
  hero: { unit: WarbandHero; form: HeroFormEntry; payload: WarbandHeroPayload };
  henchmen_group: {
    unit: HenchmenGroup;
    form: HenchmenGroupFormEntry;
    payload: HenchmenGroupPayload;
  };
  hired_sword: {
    unit: WarbandHiredSword;
    form: HiredSwordFormEntry;
    payload: WarbandHiredSwordPayload;
  };
};

/**
 * A unit as the list and detail endpoints return it. Summary and detail payloads still share one
 * type per kind (the detail adds `race`, `deeds`, ...), so cards sniff for detail fields through
 * `UnitKindConfig.hasDetail` until the sheet endpoint serves one shape (design 0.28 §7 q2).
 */
export type Unit<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["unit"];
export type UnitForm<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["form"];
export type UnitPayload<K extends UnitKindKey = UnitKindKey> = UnitShapes[K]["payload"];

/** The section and pending-purchase key each kind already uses ("heroes", "henchmen", ...). */
export type UnitSectionKey = Exclude<UnitTypeOption, "stash">;
