import { unitApi } from "../units/unit-api";

const groups = unitApi("henchmen_group");

export const listWarbandHenchmenGroups = groups.list;
export const listWarbandHenchmenGroupDetails = groups.listDetails;
export const getWarbandHenchmenGroupDetail = groups.detail;
export const getWarbandHenchmenGroupKillHistory = groups.killHistory;
export const createWarbandHenchmenGroup = groups.create;
export const updateWarbandHenchmenGroup = groups.update;
export const deleteWarbandHenchmenGroup = groups.remove;
export const levelUpWarbandHenchmenGroup = groups.levelUp;
