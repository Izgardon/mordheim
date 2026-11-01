/**
 * The campaign battle number as the pages show it: "Battle 6", or "" for a battle the server
 * hasn't numbered (an older server). The server works it out (the most games any of its warbands
 * has played, this one included) and fixes it when the battle starts.
 */
export function battleNumberLabel(number: number | null | undefined, prefix = "Battle") {
  return number ? `${prefix} ${number}` : "";
}

/** "Before battle 6" for a numbered battle, else the fallback ("Before the battle"). */
export function numberedOr(number: number | null | undefined, prefix: string, fallback: string) {
  return number ? `${prefix} ${number}` : fallback;
}
