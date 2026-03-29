export type DetailEntry = {
  id: number;
  type: "item" | "skill" | "spell" | "special";
  name: string;
  dc?: string | number | null;
};

export type PopupPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};
