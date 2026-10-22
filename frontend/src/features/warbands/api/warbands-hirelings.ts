import { unitApi } from "../units/unit-api";

const hirelings = unitApi("hireling");

export const listWarbandHirelings = hirelings.list;
export const listWarbandHirelingDetails = hirelings.listDetails;
export const getWarbandHirelingDetail = hirelings.detail;
export const getWarbandHirelingKillHistory = hirelings.killHistory;
export const createWarbandHireling = hirelings.create;
export const updateWarbandHireling = hirelings.update;
export const deleteWarbandHireling = hirelings.remove;
export const levelUpWarbandHireling = hirelings.levelUp;
export const batchWarbandHirelings = hirelings.batch;
