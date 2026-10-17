/**
 * Routes `unitApi(kind).<method>` to the per-kind api mock of the same endpoint, so tests keep
 * asserting on `api.updateWarbandHero`, `api.levelUpWarbandHenchmenGroup` and friends while the
 * roster code calls the generic `units/unit-api`.
 *
 *   vi.mock("@/features/warbands/units/unit-api", async () =>
 *     (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
 *   );
 */
import type { UnitApi } from "@/features/warbands/units/unit-api";
import type { UnitKindKey } from "@/features/warbands/types/units";

type UnitApiMethod = keyof UnitApi<UnitKindKey>;

const ENDPOINT_NAMES: Record<UnitKindKey, Record<UnitApiMethod, string>> = {
  hero: {
    list: "listWarbandHeroes",
    listDetails: "listWarbandHeroDetails",
    detail: "getWarbandHeroDetail",
    killHistory: "getWarbandHeroKillHistory",
    create: "createWarbandHero",
    update: "updateWarbandHero",
    remove: "deleteWarbandHero",
    levelUp: "levelUpWarbandHero",
    batch: "batchWarbandHeroes",
  },
  henchmen_group: {
    list: "listWarbandHenchmenGroups",
    listDetails: "listWarbandHenchmenGroupDetails",
    detail: "getWarbandHenchmenGroupDetail",
    killHistory: "getWarbandHenchmenGroupKillHistory",
    create: "createWarbandHenchmenGroup",
    update: "updateWarbandHenchmenGroup",
    remove: "deleteWarbandHenchmenGroup",
    levelUp: "levelUpWarbandHenchmenGroup",
    batch: "batchWarbandHenchmenGroups",
  },
  hired_sword: {
    list: "listWarbandHiredSwords",
    listDetails: "listWarbandHiredSwordDetails",
    detail: "getWarbandHiredSwordDetail",
    killHistory: "getWarbandHiredSwordKillHistory",
    create: "createWarbandHiredSword",
    update: "updateWarbandHiredSword",
    remove: "deleteWarbandHiredSword",
    levelUp: "levelUpWarbandHiredSword",
    batch: "batchWarbandHiredSwords",
  },
};

type AnyFunction = (...args: unknown[]) => unknown;

export function unitApiModuleMock(api: object) {
  const mocks = api as Record<string, AnyFunction | undefined>;
  const forKind = (kind: UnitKindKey) =>
    Object.fromEntries(
      Object.entries(ENDPOINT_NAMES[kind]).map(([method, name]) => [
        method,
        // Read the mock at call time: tests swap implementations between cases.
        (...args: unknown[]) => (mocks[name] as AnyFunction)(...args),
      ])
    );
  return {
    UNIT_URL_SEGMENTS: {
      hero: "heroes",
      henchmen_group: "henchmen-groups",
      hired_sword: "hired-swords",
    },
    unitApi: (kind: UnitKindKey) => forKind(kind),
  };
}
