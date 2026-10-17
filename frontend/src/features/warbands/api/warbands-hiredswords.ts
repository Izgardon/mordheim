import { unitApi } from "../units/unit-api";

const hiredSwords = unitApi("hired_sword");

export const listWarbandHiredSwords = hiredSwords.list;
export const listWarbandHiredSwordDetails = hiredSwords.listDetails;
export const getWarbandHiredSwordDetail = hiredSwords.detail;
export const getWarbandHiredSwordKillHistory = hiredSwords.killHistory;
export const createWarbandHiredSword = hiredSwords.create;
export const updateWarbandHiredSword = hiredSwords.update;
export const deleteWarbandHiredSword = hiredSwords.remove;
export const levelUpWarbandHiredSword = hiredSwords.levelUp;
