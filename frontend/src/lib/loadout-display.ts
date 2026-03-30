const HIRED_SWORD_PREFIX = /^Hired sword -\s*/i;

export function getLoadoutDropdownDisplayName(name?: string | null) {
  if (typeof name !== "string") {
    return "";
  }

  return name.replace(HIRED_SWORD_PREFIX, "").trim();
}
