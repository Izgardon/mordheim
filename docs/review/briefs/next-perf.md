# Next, performance investigation: why local loading is slow

You're on branch `next-perf` in `.worktrees/next-perf`, which branches from `next` at `f33a5a19`. Two other agents are working at the same time:

- one is rebuilding items on `next` (backend `apps/items`, the store and Wargear);
- one is polishing styles on `next-polish` (tokens, layout, skeletons).

Commit only to `next-perf`, and keep your fixes away from their areas where you can. I'll merge.

William: "The loading speed on my local seems quite slow, can you start an investigation. Happening on most routes it seems."

## His setup

- **Location:** the repo is in `C:\Users\wsess\OneDrive\Documents\Coding\mordheim`, inside OneDrive, on Windows 11.
- **Stack:** Docker Desktop runs `docker-compose.yml`:
  - Django `runserver` with the source bind-mounted;
  - Vite dev with the source bind-mounted, `CHOKIDAR_USEPOLLING=true` and `CHOKIDAR_INTERVAL=100`;
  - Postgres 16;
  - soketi.
- **His main stack:** runs `main` on port 5173.
- **The preview he's trying now:** port 5174, from `.worktrees/preview` (`f33a5a19`), against database `mordheim_preview`. Its containers are `mordheim-preview-be` (the `mordheim-lint` image running `runserver`) and `mordheim-preview-fe`. Don't stop or change them. You may read their logs and point a browser at 5174 to measure, but run your own stack for experiments.

## Investigate

Measure first, then rank the causes by how much time each costs. Separate what William's environment costs from what the app costs.

**1. Backend**
- Time every API call each main route makes:
  - campaigns;
  - overview;
  - warband;
  - Aftermath;
  - Battles;
  - battle;
  - reference pages;
  - settings.
- Count the queries behind each call (the existing query-budget tests show how).
- Find the slow endpoints and why: N+1 queries, heavy serialisers, big payloads, missing indexes.
- Compare `runserver` against gunicorn in the same container.

**2. Frontend data flow**
For each route, list the requests in order and find:
- waterfalls, where a request waits on another for no reason;
- duplicate requests;
- refetching on every navigation (TanStack Query `staleTime` and refetch settings);
- auth `me` and refresh calls on every route;
- realtime auth calls;
- whatever blocks the first paint.

**3. Dev server**
- Count the modules Vite serves on first load and on a route change, and measure transform time.
- Measure what the bind mount from a Windows (OneDrive) folder costs Docker Desktop. Compare a copy of the frontend inside a Docker volume or the WSL filesystem.
- Measure the polling cost (`CHOKIDAR_INTERVAL=100`).
- Check for OneDrive sync interference.
- Compare `vite build` plus `vite preview` against dev, to show how fast the app itself is.

**4. Bundle**
- Chunk sizes and route splitting.
- Large dependencies.

## Fix

**App-level fixes.** Make the clear, low-risk ones on `next-perf`, each its own commit with its measured gain:
- query counts and N+1s;
- payload trimming;
- `staleTime` defaults;
- removing waterfalls (parallel fetches, prefetching on hover or route);
- avoiding refetch storms;
- splitting heavy chunks.

Add a backend test wherever you change a query count.

**Environment recommendations.** For example: move the repo out of OneDrive into the WSL filesystem, a different polling interval, Docker settings, running Vite on the host. Write these up for William with measured numbers, but don't change his `docker-compose.yml` or anything on his machine without asking. You may propose a `docker-compose` change as a separate commit, if it's clearly safe and opt-in.

## Rules

- Light testing. The gate is typecheck, lint, format, build, vitest and the backend gate.
- Small commits in the repo's style, with no attribution lines. No push or merge. Never bare `git stash`.
- Never run python on the Windows host, not even `--version`. Containers only.
- Never touch Neon or any remote database. Use local docker databases only, and remove what you create when you're done.
- No real emails.
- Don't drop databases you didn't create.

**Scripts** (in the scratchpad): `wt-perfbe.sh`, `perfbe-gate.sh`, `wt-feperf.sh`, `perffe-gate.sh`.
- Their database is `mordheim_perf`; create it as a copy of the dev database.
- Their node_modules volume is `mordheim_frontend_node_modules_perf`; run `npm ci` in it first.
- Name your containers `mordheim-perf-*` and use free ports.

## Report

Write `scratchpad/next-perf-report.md`:

- the measurements (tables: route, requests, total time, slowest call, queries);
- the causes ranked by cost;
- the fixes made, with before and after numbers;
- the environment recommendations, with numbers;
- what you'd still do.
