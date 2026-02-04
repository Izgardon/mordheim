import { useCallback, useState } from "react";

import type { HeroFormEntry, WarbandHero } from "../types/warband-types";

type UseHeroFormsParams = {
  heroes: WarbandHero[];
  mapHeroToForm: (hero: WarbandHero) => HeroFormEntry;
};

export function useHeroForms({ heroes, mapHeroToForm }: UseHeroFormsParams) {
  const [heroForms, setHeroForms] = useState<HeroFormEntry[]>([]);
  const [removedHeroIds, setRemovedHeroIds] = useState<number[]>([]);
  const [expandedHeroId, setExpandedHeroId] = useState<number | null>(null);

  const initializeHeroForms = useCallback((sourceHeroes?: WarbandHero[]) => {
    const resolvedHeroes = sourceHeroes ?? heroes;
    setHeroForms(resolvedHeroes.map(mapHeroToForm));
    setRemovedHeroIds([]);
  }, [heroes, mapHeroToForm]);

  const resetHeroForms = useCallback(() => {
    setHeroForms([]);
    setRemovedHeroIds([]);
    setExpandedHeroId(null);
  }, []);

  const updateHeroForm = useCallback(
    (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => {
      setHeroForms((prev) => prev.map((hero, idx) => (idx === index ? updater(hero) : hero)));
    },
    []
  );

  const removeHeroForm = useCallback((index: number) => {
    setHeroForms((prev) => {
      const hero = prev[index];
      if (hero?.id) {
        setRemovedHeroIds((current) => [...current, hero.id as number]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const appendHeroForm = useCallback((hero: HeroFormEntry) => {
    setHeroForms((prev) => [...prev, hero]);
  }, []);

  return {
    heroForms,
    setHeroForms,
    removedHeroIds,
    updateHeroForm,
    removeHeroForm,
    appendHeroForm,
    expandedHeroId,
    setExpandedHeroId,
    initializeHeroForms,
    resetHeroForms,
  };
}

