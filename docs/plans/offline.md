# Working offline: what's possible and what to build

Research (27 Nov 2026). For William, who plays at the table on phones, often where the signal is poor.

**Done since (27 Nov 2026), bug fixes only:** the double buy (purchases, hires and roster Saves carry a request key:
`Idempotency-Key`, `apps/warbands/services/request_keys.py`, `frontend/src/lib/request-key.ts`); a list paused
offline with nothing read is loading and says "No connection" (`lib/query-offline.ts`: `useCatalogue`, the entry
detail, who-can, the warband lists); a page whose code didn't download says "No connection" when the app's site
can't be reached, and "The app was updated" only when it can (`lib/chunk-failure.ts`); and a failed pusher-js
download is tried again on the next subscribe or the `online` event (`lib/realtime/client.ts`).

**Phase 1 done (27 Nov 2026), with a plain offline bar:** the phone keeps the reads a player needs at the table in
IndexedDB and shows them before anything is read (`frontend/src/lib/offline/`, `PersistQueryClientProvider` in
`app/provider.tsx`). What was built, against the design below:
- **Kept** (`kept-queries.ts`, an allowlist of key shapes): your campaigns, the settings, and per campaign its detail,
  players, campaign rules, charts, house rules, the post-game rules, scenarios and a scenario, locations,
  encampments, the exploration chart, the warband lists and a list, each catalogue list (not the archived variant)
  and catalogue entry, the open battles, your warband, and any warband's sheet, rules, stash and who-can (the
  reference pages' "What <warband> can buy" waits for it), and a battle's state and rosters while it isn't ended or
  cancelled. **Left out:** members (emails), chat, trades, bounties and their targets, every preview behind a
  confirm button, share codes, search, history, the chronicle, ledgers and logs.
- A kept read lives a week (`maxAge`, and the same `gcTime` set as the query is made and on restore, since a read
  dropped from memory would leave the phone at the next save); one older than a week is not written. Saves are at
  most every two seconds and flushed when the app goes to the background; writes are never kept
  (`shouldDehydrateMutation: () => false`: phase 3).
- **The buster** is the build (`__APP_BUILD__` in `vite.config.js`: Vercel's commit SHA, else the build time), so a
  deploy starts empty and the first online visit fills it again.
- **Whose:** the saved copy carries the token's user id, and a restore for anyone else (or nobody) deletes it. Sign-out,
  a session ended and any account switch (`auth-store.tsx` `dropUserData`, now also a switch before the last
  profile loaded) wipe it with the memory cache.
- **A battle** is no longer `gcTime: 0`: it reads afresh on every visit (`refetchOnMount: "always"`, asking only
  for newer events) and is kept while not over, read only offline (every write still goes to the server).
- An installed app asks once for persistent storage (`navigator.storage.persist()`); a browser tab doesn't.
- **The bar** (`components/offline/OfflineBar.tsx`, `lib/offline/use-offline.ts`): "You're offline. Showing what
  this phone last saw." in the campaign banners' style, under the top bar (campaign shell, Home/Account/workshop
  frame, the phone's battle screen), while `navigator.onLine` is false or TanStack's online manager is offline.
  Weak signal (requests timing out with the browser still online) doesn't show it yet.
- **Measured** (the demo campaign, iPhone 13 and desktop in Playwright): 1.3 MB for the warband sheet, Wargear,
  the campaign rules and an active battle (Wargear's item list is most of it). Reloaded with the API unreachable,
  each page showed from the phone; offline, each showed with the bar.

Still open: writes that refuse at once offline, the bar for weak signal, "Not saved on this phone yet" wording, and
phases 3 and 4.

**Phase 2 done (28 Nov 2026), William: "Just do the next part, not battle taps yet":** a service worker serves the
app shell, so the installed app opens with no signal and shows what phase 1 kept. No queued writes, no battle taps
(phase 3). What was built, against (b) below:
- **Fonts first, in their own commit:** Fraunces (variable, with its optical sizes), Manrope and Space Mono come with
  the build through `@fontsource` (`src/index.css`), and the CSP drops `fonts.googleapis.com` and `fonts.gstatic.com`.
- **The worker** (`vite-plugin-pwa` 2.0.0, `workbox-build`/`workbox-window` 7.4.1; `frontend/src/lib/pwa/`):
  `generateSW` from `pwa-options.ts`, which `vite.config.js` builds, a production build only. `start.ts` loads
  `register-sw.ts` after the page (not in `npm run dev` or vitest, and never an inline script, which the CSP's
  `script-src 'self'` would block); the entry grew 0.1 KiB.
  - **Precached:** every hashed file, `index.html`, the icons, the manifest and the fonts' Latin and Latin Extended
    files: 253 files, 2.6 MB raw, about 1.3 MB over the wire on first install (11.6 KB of it `sw.js`, the Workbox
    runtime inlined). A deploy downloads only the files that changed.
  - **Pages:** network first with a 3-second limit (`NetworkFirst`, with navigation preload), so an online player
    always gets the newest `index.html`. No page is stored on its own: when the network fails or is slow, the page is
    the worker's own precached `index.html`, whose build files it holds, so the shell and its files never mix builds.
    `navigateFallback` is off (it serves the stored copy first) and so is the precache's `directoryIndex` (it would
    answer `/` from the precache ahead of the network). `/api/` paths are never answered.
  - **Build files** the worker didn't precache (a newer build loaded online before its worker took over) are kept as
    they're fetched (`build-files`, 150 at most, 30 days); the SPA's `index.html`, which a missing file answers with,
    never is.
  - **Nothing else:** the API (`mordheim-1.onrender.com`), Pusher and every other site match no route, so the browser
    fetches them as before; phase 1's IndexedDB does the data.
- **Updates: a prompt, not the plan's quiet `skipWaiting`.** A new worker installs in the background and waits; the
  app then shows a toast in the app's style, "A new version is ready." with Reload, which stays until the player taps
  Reload or closes it. Nothing reloads by itself, and left alone the new version takes over at the next cold start.
  Why a prompt: with `skipWaiting` the new worker takes over the open page at once and deletes the old build's
  precache, so an old page opening a screen it hadn't loaded yet finds its code gone (offline at the table, a dead
  page). Waiting keeps the old build whole on the phone while its page is open. The check runs when the app comes to
  the front, when the signal returns and every hour. The toast hides while offline, because reloading then would open
  the new build with none of the saved reads (their buster is the build), and Reload in one window never reloads
  another.
- **No stale deploys:** online, every launch and reload reads the newest `index.html`, whatever worker is waiting.
  `vercel.json` serves `sw.js` and the manifest `no-cache` (the manifest as `application/manifest+json`), and the
  hashed files stay immutable. A page's code that still fails to load says "The app was updated" or "No connection"
  as before (`lib/chunk-failure.ts`; its reach check is a `HEAD`, which the worker never answers).
- **The buster** (`__APP_BUILD__`) still empties the saved reads when a new build first runs. Offline the worker
  opens its own build, which is the build that saved them, so they show.
- **A cold open with no signal starts offline** (`query-client.ts`): TanStack's online manager assumed online until
  an `offline` event that never comes, so a list not kept on the phone fetched, failed and showed "Failed to fetch"
  over "No spells match." It now pauses and says "No connection: this list loads when you're back online."
- **CSP:** `worker-src 'self'` (the worker is the app's only one; `blob:` and `data:` are gone), no font hosts.
- **The kill switch:** `SW_SELF_DESTROY=1` on a Vercel build (vite-plugin-pwa's `selfDestroying`) publishes a
  `sw.js` that unregisters itself, empties its caches and reloads the open pages once. For a broken worker only.
- **Measured** (the demo campaign, `vite build` and `vite preview` proxying a local API, Playwright on iPhone 13
  emulation): the worker controls the page straight after sign-in; with the site's server stopped and the browser
  offline, a new page opened the warband sheet in about 300 ms and a full reload of Wargear in about 290 ms, both from
  phase 1's cache with the offline bar; Spells, never opened, said "No connection". After a rebuild, the toast showed
  1.3 s after the signal returned, the page didn't navigate in the 10 s after it, and Reload opened the new build.

Still open after phase 2:
- **A version waiting when the app is closed offline.** If a deploy lands during the last online visit and the
  player neither taps Reload nor reopens the app before losing signal, the next cold open activates the new worker,
  whose build doesn't match the saved reads: the pages say "No connection" until the signal returns. A hand-bumped
  cache version instead of the build would keep them (the risk in (a)).
- The e2e suite runs on the dev server, so it doesn't cover the worker; the check above was a script run against a
  production build.
- Weak signal still waits for each request's timeout before the bar can show; "Not saved on this phone yet" wording;
  phases 3 and 4.
- **iPhone:** a Home Screen app keeps its own storage, apart from Safari's, so the player opens the installed app
  online once (signing in there too). Safari's 7-day deletion doesn't apply to it, but iOS can still clear its worker
  and IndexedDB when the phone runs low on space (it asks once for persistent storage, granted at WebKit's
  judgement). Then it opens like a first visit: online only, until it has been opened online again.

**For William to check on real phones after it deploys** (Android Chrome and iPhone Safari):
1. **Install:** open the site online, sign in, install it (Android: Account → Appearance → Install; iPhone: Share →
   Add to Home Screen), open the installed app and sign in there (an iPhone's installed app has its own storage).
   Visit your warband, Wargear and the campaign rules.
2. **Airplane mode:** with the app open, turn airplane mode on. The offline bar shows and the pages you visited
   still show.
3. **Cold open:** close the app fully (swipe it away), keep airplane mode on and open it from the home screen. It
   should open, not show the phone's "no connection" page, show the offline bar, and show your warband and Wargear.
   A page you never opened says "No connection".
4. **The update notice:** turn airplane mode off and leave the app open while the next deploy goes out (or bring it
   to the front after one). "A new version is ready." with Reload shows at the top, and nothing reloads by itself.
   Tap Reload: the app reloads once on the new version. Closing the toast instead and reopening the app later should
   also give the new version.

## Summary

- **Today, with no signal, the app won't open.** An installed app that the phone has closed in the background (iPhones
  do this a lot) needs the network to load its first page. If the app is still open, pages you saw in the last five
  minutes keep showing. Anything else gives an error, a spinner that never ends, or an empty list that looks real.
- **With weak signal, reads and writes wait up to 20 seconds and then fail.** A purchase that times out may still have
  gone through on the server; tapping Buy again used to buy the item twice. **Fixed:** it now sends the same request
  key and gets the first answer back.
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
| Reference pages (items, skills, spells, specials) | Fails | Shows if seen in the last 5 min; after that it used to be **an empty list**, because a paused query isn't "loading". **Fixed:** loading, with "No connection: this list loads when you're back online." |
| Scenarios, campaign rules, charts | Fails | As above |
| Battle in progress | Fails | Shows while the battle page stays open. Leave it and it's gone: battle data is never kept (`gcTime: 0`, `battle-queries.ts`) |
| A page you haven't opened in this visit | Fails | Fails: its code file can't download. The error page used to say **"The app was updated"**. **Fixed:** "No connection" when the app's site can't be reached |
| Live updates | n/a | Reconnect is handled. A failed pusher-js download used to keep realtime dead until a reload. **Fixed:** tried again on the next subscribe or when the connection returns |

### Writing

- **Battle taps and notes** (wounds, statuses, unit notes, your battle notes) show on screen at once and are saved one
  at a time in the background (`useActiveConfigSave`, `useSerializedSave`, `useNotesAutosave`). With no signal, each
  save fails with an error. The screen keeps showing the change, but it was never saved, and a reload loses it.
- **Kills, out of action, rounds** wait for the server (`useBattleScreen.ts`) and then show "Couldn't change that."
- **Buying** (`POST warbands/<id>/purchases/`) waits up to 20 s and then fails. Two problems:
  - The server may have taken the purchase even though the answer never arrived. Tapping Buy again used to buy it
    twice and charge twice. **Fixed:** purchases, hires and roster Saves carry an `Idempotency-Key`; a repeat gets the
    first answer.
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

**Done, offline or not:** an `Idempotency-Key` header on purchases, hires and roster Saves (the store's upgrades and
camp's veterans too). The server keeps the answer a day, written in the write's own transaction, so the same key gets
the same answer and two at once can't both go through. Not keyed yet: location visits, sales, transfers, resource
sales and the ledger's own rows; a new one is a `once()` around its view and a key from `useRequestKey`.

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
| **0. Say it plainly** | An "offline" bar (from the browser's offline events plus failed or timed-out requests; cleared by the next success, with a cheap check of `/api/health/`). Writes refuse at once offline instead of pausing silently. The three bug fixes are **done** (the empty list, the wrong cause, pusher-js retried) | ~1 day |
| **1. Keep the last-seen data** (option a) — **done** 27 Nov 2026 | The sheet, reference pages, rules, charts, scenarios and an open battle read from the phone on weak or no signal (while the app's files can load) | ~2–3 days |
| **2. Open with no signal** (option b, fonts first) — **done** 28 Nov 2026 | The app opens from a cold start in airplane mode and shows phase 1's data. Online players still always get the newest deploy | ~2.5 days + phone checks |
| **3. Type the battle offline** (option c) | Wounds, statuses, notes, out of action, kills and the post-game draft are saved on the phone and sent later. Refused changes are listed plainly | ~4–6 days |
| **3b. No double buys** | **Done** for purchases, hires and roster Saves; location visits and the other gold writes can take the same `once()` | — |
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
