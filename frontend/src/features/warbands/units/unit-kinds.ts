/**
 * The unit kind registry (design 0.28 §5.2): heroes, henchmen groups and hired swords declare
 * their differences here, and the shared roster code reads them instead of being copied per kind.
 */
import { heroKind } from "./kinds/hero";
import { henchmenKind } from "./kinds/henchmen";
import { hirelingKind } from "./kinds/hireling";

import type { UnitKindKey } from "../types/units";
import type { UnitKindConfig } from "./unit-kind-types";

export { heroKind, henchmenKind, hirelingKind };
export type { UnitKindConfig } from "./unit-kind-types";

export const unitKinds: { [K in UnitKindKey]: UnitKindConfig<K> } = {
  hero: heroKind,
  henchmen_group: henchmenKind,
  hireling: hirelingKind,
};
