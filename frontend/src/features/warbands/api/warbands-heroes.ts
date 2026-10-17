import { unitApi } from "../units/unit-api";

const heroes = unitApi("hero");

export const listWarbandHeroes = heroes.list;
export const listWarbandHeroDetails = heroes.listDetails;
export const getWarbandHeroDetail = heroes.detail;
export const getWarbandHeroKillHistory = heroes.killHistory;
export const createWarbandHero = heroes.create;
export const updateWarbandHero = heroes.update;
export const deleteWarbandHero = heroes.remove;
export const levelUpWarbandHero = heroes.levelUp;
export const batchWarbandHeroes = heroes.batch;
