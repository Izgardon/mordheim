export type WarbandUpdateDetail = {
  warbandId: number;
};

export type WarbandUpdateOptions = {
  emitUpdate?: boolean;
};

export function emitWarbandUpdate(warbandId: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<WarbandUpdateDetail>("warband:updated", {
      detail: { warbandId },
    })
  );
}
