/**
 * One write that runs after a Save's batch has gone through (a purchase's trade or log, a stash
 * removal). It names what it does, so a failure can say what didn't happen, and it runs once:
 * a retry runs only the steps that are left, never the batch again.
 */
export type FollowUp = {
  label: string;
  run: () => Promise<void>;
};

/** Runs the steps in order and stops at the first failure; the steps from there on are left. */
export async function runFollowUps(
  steps: FollowUp[]
): Promise<{ remaining: FollowUp[]; error: unknown }> {
  for (let index = 0; index < steps.length; index += 1) {
    try {
      await steps[index].run();
    } catch (error) {
      return { remaining: steps.slice(index), error };
    }
  }
  return { remaining: [], error: null };
}

/** "buying Sword (10 gc), the loadout log for Sword (Aldric)": each label once, in order. */
export const describeFollowUps = (steps: FollowUp[]) =>
  Array.from(new Set(steps.map((step) => step.label))).join(", ");
