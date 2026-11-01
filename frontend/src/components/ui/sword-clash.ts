/**
 * One strike of the swords (design E): the swing, the clash and the settle. The CSS animation
 * reads this length from the svg (`--sword-clash-ms`, set by `SwordClashSpinner`), and the
 * battle's entrance stays up at least this long, so the two can't drift apart.
 */
export const SWORD_CLASH_MS = 1400;

/** With reduced motion the swords are one still frame, held at least this long. */
export const SWORD_CLASH_REDUCED_MS = 400;

/** Boot shows the plain page first, and the swords only once it has taken this long. */
export const BOOT_SWORDS_DELAY_MS = 600;

/** The swords' screen fades out over this as it hands over to the page under it. */
export const SWORDS_FADE_MS = 200;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** How long a strike holds the screen: one full animation, or the still frame's minimum. */
export const swordClashMinMs = () =>
  prefersReducedMotion() ? SWORD_CLASH_REDUCED_MS : SWORD_CLASH_MS;
