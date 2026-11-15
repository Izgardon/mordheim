import { readFileSync } from "node:fs";
import { join } from "node:path";

/** What `manage.py seed_e2e --emit` wrote: the credentials and the ids behind them. */
export type SeedUser = { id: number; email: string; name: string; warband_id: number | null };
export type Seed = {
  campaign: { id: number; name: string; join_code: string };
  password: string;
  users: Record<string, SeedUser>;
  battles: Record<string, number>;
  fresh_gold: number;
};

export const SEED_PATH = join(__dirname, ".seed.json");

let cached: Seed | undefined;

export function seed(): Seed {
  cached ??= JSON.parse(readFileSync(SEED_PATH, "utf8")) as Seed;
  return cached;
}
