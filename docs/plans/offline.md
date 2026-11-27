# Working offline: what's possible and what to build

Research only (27 Nov 2026). No code changed. For William, who plays at the table on phones, often where the signal is poor.

## Summary

- **Today, with no signal, the app won't open.** An installed app that the phone has closed in the background (iPhones
  do this a lot) needs the network to load its first page. If the app is still open, pages you saw in the last five
  minutes keep showing. Anything else gives an error, a spinner that never ends, or an empty list that looks real.
- **With weak signal, reads and writes wait up to 20 seconds and then fail.** A purchase that times out may still have
  gone through on the server, so tapping Buy again can buy the item twice. That can happen today.
- **Most of the value can be had safely and cheaply.** You can read your warband sheet, the reference pages, the
  campaign rules and charts, and a battle in progress, all from what the phone last saw. Wounds, statuses, notes and
  out-of-action taps during a battle can be saved on the phone and sent when signal returns.
- **Buying, hiring, level-ups, the post-game's Next and Ready, trades and finishing a battle should stay online-only.**
  The server decides prices, warnings and rolls and writes the gold ledger. Queuing them would mean the player never
  sees the warnings before the action takes effect, and other players' changes could clash with them.
- **Recommended order:** (0) tell the player plainly when they're offline, and fix three small bugs; (1) keep the
  last-seen data on the phone (IndexedDB); (2) add a service worker so the app opens with no signal, without bringing
  back stale deploys; (3) queue the safe battle writes; (4, optional) keep drafts, such as the store basket, on the
  phone to send later. Full local-first sync is not worth it here.
- **Best first step:** phase 1, keeping the read cache on the phone. It is low risk and helps on weak signal straight
  away, and everything after it builds on it. The details are below.

## 1. What fails today

### How it works now

- **Server data** goes through TanStack Query 5.104.1 (`frontend/src/lib/query-client.ts`). Data is kept for 5 minutes
  after the last page using it closes (`gcTime`), is treated as stale after 30 seconds, and is read again when the app
  regains focus. Nothing is saved to disk. A sign-out clears the cache (`auth-store.tsx`, BUG-22: shared devices).
- **No service worker.** `index.html` comes from Vercel each time. The hashed files under `/assets/` are cached by the
  browser for a year (`vercel.json`), and there are 35 lazy-loaded route files (`src/app/router.tsx`).
- **The session** (`lib/session.ts`): tokens and the cached user sit in localStorage, so a reload shows the app
  straight away and checks `/auth/me` in the background. An outage keeps the session rather than signing out. The
  access token lasts 1 day and the refresh token 30 days, renewed on each refresh (`backend/config/settings.py`).
- **Requests** (`lib/api-client.ts`) give up after 20 seconds. The API is on another site
  (`mordheim-1.onrender.com`).
- **Realtime** (`lib/realtime/client.ts`): pusher-js is downloaded on first use, and screens catch up after a
  reconnect (`onConnectionRestored`).
- **TanStack's online check** assumes the phone is online until the browser reports an `offline` event. Once it has,
  queries and `useMutation` writes **pause**: they wait in memory and run when signal returns. Weak signal never
  triggers that event, so requests just time out.

### Reading

| What | Phone killed the app, no signal | App still open, signal drops |
|---|---|---|
| Opening the app at all | **Fails**: the browser's "no connection" page | OK |
| Warband sheet | Fails | Shows if seen in the last 5 min; after that, a spinner that never ends (`useWarbandSheet`) |
| Reference pages (items, skills, spells, specials) | Fails | Shows if seen in the last 5 min; after that **an empty list**, because a paused query isn't "loading" (`useCatalogue` returns no entries, `isLoading` false) |
| Scenarios, campaign rules, charts | Fails | As above |
| Battle in progress | Fails | Shows while the battle page stays open. Leave it and it's gone: battle data is never kept (`gcTime: 0`, `battle-queries.ts`) |
| A page you haven't opened in this visit | Fails | Fails: its code file can't download, and the error page says **"The app was updated"**, which is wrong here (`RouteError.tsx`) |
| Live updates | n/a | Reconnect is handled. But if the pusher-js download itself fails, realtime stays dead until a reload (`clientPromise` keeps the failed import) |

### Writing

- **Battle taps and notes** (wounds, statuses, unit notes, your battle notes) show on screen at once and are saved one
  at a time in the background (`useActiveConfigSave`, `useSerializedSave`, `useNotesAutosave`). With no signal, each
  save fails with an error. The screen keeps showing the change, but it was never saved, and a reload loses it.
- **Kills, out of action, rounds** wait for the server (`useBattleScreen.ts`) and then show "Couldn't change that."
- **Buying** (`POST warbands/<id>/purchases/`) waits up to 20 s and then fails. Two problems:
  - The server may have taken the purchase even though the answer never arrived. There is no protection against
    sending the same request twice (no idempotency key), so tapping Buy again buys it twice and charges twice.
  - The 18 places that use `useMutation` (plots, locations, encampments, ledger, trades, ...) behave differently:
    after an `offline` event they **pause silently** and fire minutes later when signal returns, after the player has
    given up. If iOS closes the app in the meantime, they're lost.
- **There's no "you're offline" indicator** (noted in `docs/review/features/07-frontend-platform.md`).

### What a player would reasonably want offline

1. **Read:** their warband sheet, the reference pages, the campaign's rules, charts and scenarios, and the battle
   they're in, including its rosters and the battle rules.
2. **Type during a battle:** wounds, statuses, out of action, unit notes, their own battle notes, and kills.
3. **Type the post-game:** the draft (injury rolls and exploration dice are already rolled on the phone or typed in).
   Applying it (Next, Ready) needs the server.
4. **Plan a purchase:** fill the basket offline and buy when signal returns. Buying itself needs the server.

## 2. The options, cheapest first

### (a) Keep the last-seen data on the phone

**What:** save chosen parts of the TanStack cache to IndexedDB and load them back when the app starts. Pages then
show what the phone last saw, and refresh in the background when they can.

**Work:**
- `src/app/provider.tsx`: swap `QueryClientProvider` for `PersistQueryClientProvider`.
- A new `src/lib/offline/persister.ts` (about 30 lines with `idb-keyval`). Store the cache as an object, not a JSON
  string: IndexedDB copies objects directly, which is cheaper on a phone than turning a few MB into text. Save at
  most every couple of seconds.
- `src/lib/query-client.ts`:
  - **An allowlist** (`dehydrateOptions.shouldDehydrateQuery`). Include the keys a player reads at the table: campaign
    `detail`, `warbandSheet`, `myWarband`, `catalogue` lists, `campaignRules`, `campaignCharts`, `battleRules`,
    `scenarios`, `scenarioEntry`, `warbandRules`, `warbandTemplate(s)`, `locations`, `encampments`, `explorationChart`,
    `battleState`, `battleRosters`, `settings`, `campaigns`. Leave out the previews (deletion, leave, member removal),
    `sharedCode`, chat, and anything only used on screens with a confirm button.
  - **A longer life for those keys**, around 7 days. TanStack's rule is that a saved query must not be dropped from
    memory before its saved copy expires, so `gcTime` has to be at least the saved copy's `maxAge`.
- `battle-queries.ts`: change `gcTime: 0` to the same longer life and add `refetchOnMount: "always"`. The battle read
  already asks only for events newer than the cached ones (`sinceEventId`), so this keeps "every visit reads afresh"
  and makes coming back cheap.
- `auth-store.tsx` `dropUserData`: wipe the saved copy too, and name the saved copy after the user's id, so one
  player's data never reaches the next player on a shared phone (BUG-22).
- `buster`: when the app's version changes, throw the saved copy away (see the risks).
- Pages that treat "no data, not loading" as "nothing here": `useCatalogue` and its kin should say "Not saved on this
  phone yet" when a query is paused with no data.

**Risks:**
- **Old data in a new app version.** If a deploy changes the shape of a response, data saved by the old version could
  crash the new code. The safe choice is a buster equal to the build id: a deploy throws the saved copy away and the
  first online visit fills it again. (With a service worker, an offline visit runs the old app version with its own
  old data, so nothing is lost at the table.) Later, a hand-bumped "cache version" constant would keep data across
  deploys.
- **Size.** About 370 KB of catalogue lists per campaign (`core/middleware.py`), plus the sheet, rules and scenarios:
  under 2 MB per campaign. The whole book import is 6.8 MB of raw JSON (900 KB zipped), and we'd only save what was
  viewed. IndexedDB handles this easily. localStorage (5 MB, blocking) would not.
- **Start-up time.** Loading a 1–2 MB saved copy adds tens of milliseconds on a phone before queries run (the provider
  holds them while it loads). Measure it on an old iPhone.
- **iPhone storage.** An app added to the Home Screen keeps **its own storage, separate from Safari's**, so a player
  must open the installed app online at least once. Home Screen apps are not subject to Safari's 7-day deletion of
  site data. The phone can still clear it when storage runs low. Call `navigator.storage.persist()` once: WebKit says
  it grants this by judgement, more often for Home Screen apps. The quota is far above what we need.
- **The login token can expire while offline.** This doesn't matter for reading, because nothing is sent. On
  reconnect, the existing refresh path handles a 1-day access token. After 30 days without opening the app, the
  player signs in again.
- **Stale permission flags.** The cached `capabilities` may be out of date. That's fine, because the server still
  checks every write.

**What the player sees:** a slim bar at the top: "No signal · showing what this phone saw at 14:32". The time comes
from the oldest `dataUpdatedAt` on screen.

**Size:** about 2–3 days, including tests (vitest with `fake-indexeddb`, plus a Playwright test using
`context.setOffline(true)`).

### (b) A service worker for the app's files

**What:** a small background script that stores the app's own files (HTML, JS, CSS, icons, fonts) so the app opens
with no signal. It would **not** touch API data; (a) does that.

**Why the app has none today, and how to keep that benefit:** "None means no stale deploys." The usual service-worker
setup serves the stored `index.html` first, so players run last week's version until a reload. To avoid that:

- **For page loads, try the network first, with a 3-second limit.** Online players always get the newest
  `index.html`, and so the newest build. With no signal, or a very slow one, the stored copy opens after 3 seconds at
  most. Workbox: `NetworkFirst` with `networkTimeoutSeconds: 3`. Don't use vite-plugin-pwa's default
  `navigateFallback`, which serves the stored copy first.
- **Store every hashed file of the build in advance** (~2 MB raw, ~620 KB zipped, 224 files). Vite's file names
  change only when the file changes, so a deploy downloads only the changed files. This also fixes the "page not
  opened yet" failure above. Leave large images out.
- **Also keep `/assets/*` files as they're fetched**, with a size cap. If the newest `index.html` arrived but the
  service worker hasn't stored its files yet, the files it loaded online are still there offline.
- **Activate the new version quietly** (`skipWaiting`, `clientsClaim`) and **never reload the page automatically**.
  A forced reload mid-battle would lose what the player is typing. The next launch picks up the new version, and
  the existing "The app was updated" path still catches a missing old file.

**Work:**
- `vite.config.js`: add `vite-plugin-pwa` with `strategies: "generateSW"`, `manifest: false` (keep our
  `public/manifest.webmanifest`), `injectRegister: null`, and register from `src/main.tsx` through
  `virtual:pwa-register`. Its default inline registration script would be **blocked by our CSP**
  (`script-src 'self'`).
- `vercel.json`: `/sw.js` must be served without long caching. Today it would be: only `/assets/…-hash` files are
  marked immutable, and `handle: filesystem` serves it before the SPA fallback. Add a test in
  `vercel-config.test.ts` that pins this.
- **Fonts:** `src/index.css` loads Google Fonts. A service worker's own requests follow the CSP's `connect-src`, which
  doesn't list `fonts.googleapis.com` or `fonts.gstatic.com`, and offline they'd be missing anyway. **Self-host the
  three fonts** (Fraunces, Manrope, Space Mono; all open licence) in `src/assets/fonts/`. They then come with the
  build, and the CSP can drop both Google origins. Do this as a separate PR before the service worker.
- `RouteError.tsx`: offline, say "This page isn't saved on this phone yet" rather than "The app was updated".
- `CLAUDE.md`'s note "No service worker..." gets rewritten to describe the network-first rule.
- Testing: the service worker only exists in a production build, so the e2e test needs `vite build && vite preview`,
  not the dev server. Then check a real iPhone and Android phone: install, go online, turn on airplane mode, reopen.

**Risks:**
- A bad service worker is the worst kind of bug: it can keep serving a broken app. Ship a "kill switch" with it: a
  `/sw.js` that unregisters itself and clears its caches, ready to deploy.
- On iPhones, the service worker's stored files share the same storage rules as (a), and can be cleared under storage
  pressure the same way.
- iPhones don't support Background Sync, so anything queued (option c) sends only while the app is open. That's
  acceptable.
- vite-plugin-pwa 2.0.0 needs Node ≥ 20.19. CI (`node-version: "20"`) and `node:20-alpine` already get that.

**Size:** about 2 days, plus half a day for the fonts and a session on real phones.

### (c) Queue some writes while offline

**What:** save a write on the phone and send it when signal returns. TanStack can do this itself (paused mutations
saved with the cache, a `mutationKey` with `setMutationDefaults` so a reloaded app knows how to send each one,
`resumePausedMutations()` after loading, and `scope: { id }` to send them in order). But today's battle writes don't
go through `useMutation`; they use `useSerializedSave`, which already **merges** waiting changes into one. A small
**outbox per battle** that saves that merged change to IndexedDB is less work and sends fewer requests than moving
every battle write onto `useMutation`.

**Which writes are safe to queue.** A write is safe to send late, and to send twice, when it is about the player's
own data, sets a value rather than adding to a total, and touches no gold.

| Write | Queue it? | Why |
|---|---|---|
| Wounds, statuses, unit notes, your battle notes (`config/`, `unit_information_patch`, `battle_notes`) | **Yes** | Your own participant; each change replaces the old value; the newest wins; already merged |
| Out of action, dismount (`unit-ooa/`, `unit-dismount/`) | **Yes** | Sets a value on your own unit; the server answers "unchanged" to a repeat |
| Post-game draft (`postbattle/`) | **Yes** | Replaces your draft as a whole |
| Kills (`unit-kill/`), item used, other events (`events/`) | **Yes, once they carry a request id** | Each send *adds* one, so a resend after a lost answer counts the kill twice. Add a client-made id (a UUID) stored on the event with a unique constraint per battle, so a repeat returns the first one |
| Next round, start, ready, finish, End battle | No | Involve other players; queuing them could leave the others waiting or skipped |
| Post-game Next and Ready (`postbattle-step/`, `finalize-postbattle/`) | No | They write gold, XP and the ledger, and answer warnings the player must see. Already idempotent, but they must not happen without the player watching |
| Buying, hiring, selling, level-ups, location visits, rarity rolls | No | The server sets the price, the warnings (overspend, trading action, failed rarity) and the ledger row |
| Trades, bounties, encampments, campaign settings | No | Involve other players; likely to clash |

**When a queued write is refused.** The battle may have ended while the phone was offline, and the server then says
no (`only(STATUS_ACTIVE)`). The app must say so plainly, because the change is lost: "3 changes from this phone
weren't saved: the battle had ended. They are listed below." Show the list, so nothing disappears without a word.

**Work:**
- Frontend: a new `features/battles/state/battle-outbox.ts` (stores the merged change and kill list per battle in
  IndexedDB, sends them when back online, oldest first), wired into `useActiveConfigSave` and `useBattleScreen`. Kills
  get a client id and show on screen at once.
- Backend: an optional `client_ref` on `BattleEvent` (migration plus unique constraint), read in `views/combat.py`.
  It's a new field, so it runs on an empty database, and there's no backfill.
- `query-client.ts`: writes that are **not** queued should fail at once when offline (`networkMode: "always"` for
  mutations, or an early "offline" error in `apiRequest` for non-GET requests). Today's silent pause-then-fire-later
  goes away.
- On reconnect: send the outbox first, then refresh the battle (it already refreshes after reconnecting).

**Also worth doing, offline or not:** an `Idempotency-Key` header on purchases, hires and location visits. The
server would remember the answer for a day, so the same key gets the same answer. This fixes today's double-buy
after a timeout on weak signal. It is a backend helper (one small table, one decorator) plus one header in
`apiRequest`.

**What the player sees:**
- The bar says "No signal · 4 changes waiting to send".
- Each unit with a waiting change gets a small clock mark (`pendingKeys` already exists).
- Writes that need the server stay **greyed but clickable**, per the house rule. Tapping one says "Needs signal:
  buying is checked by the server." Start with the main ones (Buy, Hire, Next, Ready, Start battle, End battle)
  through one `useOnline()` hook; elsewhere the early refusal in `apiRequest` gives the same message.

**Size:** about 4–6 days, including the backend id, the "weren't saved" list and tests. Add 1–2 days for the
idempotency key on purchases.

### (d) Full local-first sync

**What:** a database on the phone that syncs both ways with the server (ElectricSQL, PowerSync, Replicache/Zero,
RxDB, CRDTs).

**Why not here:**
- **The server owns the rules.** Costs, XP, level-ups, warnings, rarity, the ledger and finishing a battle would all
  have to run on the phone too, or the phone would show guesses. That breaks the first engineering rule and doubles
  the code.
- **Gold has to be exact.** Every gold change is one ledger row written in the same database transaction. Merging two
  devices' offline gold changes afterwards has no right answer.
- **Many players share a campaign.** Trades, bounties, encampments and battles involve several warbands. Offline edits
  on several phones would clash in ways only a person can settle.
- **The cost.** More than 100 endpoints, their query budgets, the permissions on every endpoint, Pusher events and the
  catalogue's versions would all need redoing. That's months of work for a table game where the phones are online
  most of the time.

What the players need at the table (read everything, type the battle) is covered by (a) + (b) + (c) at a fraction of
the cost.

## 3. Recommended plan

| Phase | Delivers | Size |
|---|---|---|
| **0. Say it plainly** | An "offline" bar (from the browser's offline events plus failed or timed-out requests; cleared by the next success, with a cheap check of `/api/health/`). Writes refuse at once offline instead of pausing silently. Three bug fixes, each with a test that fails first: the empty reference list when a query is paused with no data; "The app was updated" shown when the real cause is no signal; pusher-js never retried after a failed download | ~1 day |
| **1. Keep the last-seen data** (option a) | The sheet, reference pages, rules, charts, scenarios and an open battle read from the phone on weak or no signal (while the app's files can load) | ~2–3 days |
| **2. Open with no signal** (option b, fonts first) | The app opens from a cold start in airplane mode and shows phase 1's data. Online players still always get the newest deploy | ~2.5 days + phone checks |
| **3. Type the battle offline** (option c) | Wounds, statuses, notes, out of action, kills and the post-game draft are saved on the phone and sent later. Refused changes are listed plainly | ~4–6 days |
| **3b. No double buys** | An idempotency key on purchases, hires and location visits (worth doing even without offline) | ~1–2 days |
| **4. Drafts to send later** (optional) | The store basket and a Report result draft survive offline and are sent with one tap once there's signal, so the player still sees the server's warnings | ~2–3 days |

Each phase is its own PR, and the font self-hosting is a separate PR before phase 2, following the rule that a refactor
and a behaviour change never share a PR.

**Optional extra for phase 1 or 2:** on entering a campaign while online, read the main table pages in the background
(the rules, charts, scenarios, your sheet, an open battle's state and rosters), so they're on the phone before the
player needs them. This costs a few extra reads per campaign visit and should be measured against the query budgets.

### The single best first step

**Phase 1, keeping the last-seen data in IndexedDB**, with phase 0's offline bar in the same week:
- **It helps the common case first.** Weak signal is more common than none, and on weak signal the small
  `index.html` usually loads while the large API reads time out. Pages then show at once from the phone instead of
  waiting 20 seconds.
- **It's the foundation.** A service worker without saved data opens an app that has nothing to show on any page,
  which is more confusing than the browser's offline page. The outbox in phase 3 also needs the saved battle to show
  what's waiting.
- **It's low risk.** No change to how the app is deployed. The worst case is old data that the next online read
  replaces, and the sign-out wipe protects shared phones.

## Packages that fit what's installed

| Package | Version | Why this one |
|---|---|---|
| `@tanstack/react-query-persist-client` | **5.104.1** | Pin it to match `@tanstack/react-query` 5.104.1; its peer is `^5.104.1`. It brings `@tanstack/query-persist-client-core` with it. Moving all `@tanstack/*` to 5.108.4 together is fine later |
| `idb-keyval` | **6.3.0** (Jul 2026) | Tiny IndexedDB wrapper for the persister and the outbox; stores objects as they are |
| `vite-plugin-pwa` | **2.0.0** (Oct 2026) | Supports Vite 5 (peer `^3 … ^8`); needs Node ≥ 20.19. Version 2 lists `workbox-build` and `workbox-window` as peers, so install them too |
| `workbox-build`, `workbox-window` | **7.4.1** | Required peers of vite-plugin-pwa 2 |
| `fake-indexeddb` | latest 6.x (dev) | IndexedDB in vitest (jsdom has none) |
| `@fontsource/fraunces`, `@fontsource/manrope`, `@fontsource/space-mono` (or copied woff2 files) | current | Self-hosted fonts for the shell and a tighter CSP |

Not needed: `@tanstack/query-async-storage-persister`, which turns the cache into JSON text each time; a direct
IndexedDB persister skips that. Also not needed: TanStack's `experimental_createQueryPersister`, which saves each query
on its own but is still marked experimental and can't save waiting writes.

## Sources and how they were checked

- **TanStack:** tanstack.com couldn't be reached from this session (blocked by its network settings), so the APIs
  above were checked in the installed `@tanstack/query-core` 5.104.1 source (`onlineManager.ts`, `hydration.ts`,
  `mutationCache.ts`, `queryClient.ts`) and the 5.104.1 tarballs of `query-persist-client-core` and
  `react-query-persist-client`. Versions and dates come from the npm registry.
- **iPhone storage:** WebKit, [Updates to Storage Policy](https://webkit.org/?p=14403) (Home Screen apps' quota, and
  `persist()` granted by judgement); [Apple Developer Forums: Safari iOS PWA data persistence beyond 7 days](https://developer.apple.com/forums/thread/710157)
  (the 7-day rule is Safari's, not a Home Screen app's); [WebKit bug 237350](https://bugs.webkit.org/show_bug.cgi?id=237350);
  [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
  The WebKit storage policy was found by search and not re-read in full; check its numbers on a current iPhone
  before relying on them.
