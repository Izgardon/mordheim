import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

import { SEED_PATH } from "./fixtures/seed";

/**
 * The database every test reads: `seed_e2e` deletes the campaign the last run left and builds it
 * again, then writes the ids the tests navigate to. Running it here is what makes the suite
 * repeatable - a test spends gold and finishes a post-game, and the next run still starts from
 * the same place.
 */
export default function globalSetup() {
  execFileSync("uv", ["run", "python", "manage.py", "seed_e2e", "--reset", "--emit", SEED_PATH], {
    cwd: resolve(dirname(SEED_PATH), "../../backend"),
    env: { ...process.env, DJANGO_DEBUG: "1" },
    stdio: "inherit",
  });
}
