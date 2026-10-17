# Frontend platform (cross-cutting)

> Scope: `frontend/src/main.tsx`, `src/app/` (provider, router, `routes/routes.tsx`, `NotFound.tsx`), `src/stores/app-store.tsx`, `src/features/auth/stores/auth-store.tsx`, `src/components/ProtectedRoute.tsx`, `ScrollToTop.tsx`, `src/layouts/desktop`, `src/layouts/mobile`, `src/lib/` (`api-client.ts`, `realtime.ts`, `use-media-query.ts`, helpers), `src/features/realtime/` (chat, dice roller and notifications menus, `useNotifications`), `src/features/notifications/`, `src/components/ui/` (shadcn primitives and shared components), `src/components/dice/DiceRoller.tsx`, `src/utils/`, `src/config/`, `src/types/`, `src/test/setup.ts`, test organisation, `vite.config.js`, `tsconfig*.json`, `package.json`, `vercel.json`, `index.html`, `index.css`. Feature screens are cited only where they show a platform problem.
>
> Method: full read of the files above. Measured a production build (`vite build --outDir /tmp/review-dist` inside `mordheim-frontend-1`, plus a sourcemap build attributed per package), ran `tsc --noEmit` in the container, diffed every duplicated test pair, and checked the third-party asset URLs with `curl -I`. Request counts are traced from code. They agree with the live-run log quoted in AUTH-PERF-03 (17 API calls for one overview load). No browser profiling was done.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | **Poor.** There is no server-state layer. Every mount refetches, the same endpoints are fetched from several places, mobile pull-to-refresh does a full page reload, and everything ships in one 2.42 MB chunk. The client multiplies backend load several times over what a cached client would send. |
| Bugs | **Fair.** Auth edge cases are covered in AUTH. Platform defects: a 960 px layout flip remounts the page, mobile top-bar overrides get reset, async notification actions fail silently, realtime fails silently, and scroll reset is a no-op. |
| Code quality | **Fair to poor.** The folder structure is sound. But `tsc --noEmit` fails with 98 errors and nothing enforces it: no lint, no formatter, no CI. The store is one mega-context, the realtime factories are copy-pasted, 12 test files exist twice, and data fetching is ad hoc (266 effects, 152 copies of the error-message block). |
| UI/UX | **Fair.** The theme is strong. But there are no error boundaries or toasts, the full-screen loading gates give no cold-start messaging, unknown URLs bounce to `/`, realtime events force navigation, the shared widgets have accessibility gaps, and three breakpoint systems coexist. |
| Tests | **Thin on the platform.** 53 test files, but only 41 unique. The api-client, auth store, realtime, notifications, `CampaignLayout`, routing and dice have no tests. There is no MSW, no coverage, no e2e and no CI. |

**Top 5**

1. **FE-PERF-01 (P1).** There is no server-state cache or deduplication. Opening a campaign makes about 20 requests in 4 sequential waves, and every page revisit refetches all of it.
2. **FE-PERF-02 (P1).** Mobile pull-to-refresh calls `window.location.reload()`. That repeats the whole boot: JS parse, `/auth/me`, about 20 API calls and 2 Pusher handshakes.
3. **FE-PERF-03 (P1).** All JS ships in one 2.42 MB chunk (540 KB gzip), with no route splitting. 640 KB of it is a Lottie player used only for the loading spinner, which also pulls 1.5 MB of WASM from a CDN.
4. **FE-CQ-01 (P1).** `tsc --noEmit` reports 98 errors. The type errors include real defects: wrong argument counts, and missing modules that silently become `any`. The build doesn't typecheck, and there is no lint or CI.
5. **FE-PERF-05 (P2).** Every realtime subscription opens its own Pusher WebSocket. Subscriptions are torn down and re-created on unrelated state changes, and each re-creation costs a channel-auth POST to Render and can drop events.

**Already reported by other areas (platform root cause lives here; not re-filed)**

| ID | What | Platform angle |
| --- | --- | --- |
| AUTH-BUG-01 (P1) | Any transient `/auth/me` or refresh failure logs the user out | `auth-store.tsx:50-55`, `api-client.ts:56-59`. Most likely to fire exactly when Render is slow |
| AUTH-BUG-02 (P2) | A token refresh unmounts the whole app in every tab | `ProtectedRoute.tsx:19-21` swaps the tree for `LoadingScreen` |
| AUTH-BUG-03 (P2) | The app store isn't reset on sign-out | `app-store.tsx:83-117` has no reset path. Fix: `key={user?.id}` |
| AUTH-BUG-08 (P3) | Pusher auth uses the token captured at socket creation | Fixed by the shared realtime client in FE-PERF-05 |
| AUTH-PERF-02 (P2) | Login fires `/auth/me` 3 times | `storage.ts:10-36` dispatches one event per key |
| AUTH-PERF-03 (P2) | Cross-origin API means a CORS preflight per URL | Fix with a Vercel `/api` rewrite in `vercel.json` |
| AUTH-SEC-02 (P1) | Stored XSS in locations plus tokens in localStorage | Also needs a CSP; see FE-SEC-01 |
| CAMP-PERF-01 (P0) | Battle list fetched twice on mount and up to 4× per tab return | An instance of FE-PERF-01 and FE-PERF-06 |
| CAMP-PERF-02 / CAT-PERF-01 (P1) | `CampaignLayout` blocks on 5 catalogues | An instance of FE-PERF-01 |
| CAMP-PERF-06 (P2) | `/permissions/me` fetched by 9 pages | An instance of FE-PERF-01 |
| CAMP-PERF-09 / ROST-PERF-08 (P2) | Store writes re-render the whole campaign tree | Root cause is FE-PERF-04 |
| CAMP-BUG-08 (P2) | A failed chat send loses the message | See FE-BUG-03 for the rest of the realtime menus |
| BATL-PERF-02 (P1) | Each battle action triggers N-1 full refetches | The pattern is FE-PERF-06 |
| BATL-PERF-08 / BATL-PERF-10 | Postbattle boots 2 dice engines; each battle page opens its own Pusher connection | Root causes are FE-PERF-07 and FE-PERF-05 |
| BATL-CQ-07 | 7 battle test files exist twice | 12 pairs app-wide: FE-CQ-02 |

## How it works

- **Boot.**
  - `main.tsx` renders `AppProvider` (`app/provider.tsx`), which installs a global capture-phase `submit` listener that calls `preventDefault()`, then `AuthProvider` → `AppStoreProvider` → `RouterProvider` (`createBrowserRouter(routes)`, `app/router.tsx:7`).
  - There is no `StrictMode`, no error boundary and no `errorElement`.
  - All 22 route components are imported statically (`routes.tsx:9-30`), so the whole app is one chunk.
- **Routes.**
  - Public: `/`, `/forgot-password`, `/reset-password`.
  - `/campaigns` and `/campaigns/:id` each wrap their own `<ProtectedRoute>` (`routes.tsx:57-70`).
  - `/campaigns/:id` → `CampaignLayout` with 14 children, including `battles/:battleId/{prebattle,active,postbattle}` under `BattleLayout`.
  - `*` → `<Navigate to="/">` (`routes.tsx:98-101`). `NotFound.tsx` exists but is unused.
- **Auth.**
  - Access (1 day) and refresh (30 day) JWTs live in localStorage (`utils/storage.ts`). Every write dispatches `auth:tokens-changed`.
  - `AuthProvider` hydrates the user from `/auth/me/` and re-syncs on that event and on the cross-tab `storage` event.
  - `apiRequest` (`lib/api-client.ts`) adds the bearer token. On a 401 it runs a single-flight refresh and retries once.
  - `apiRequest` has no caching, deduplication, abort or timeout support.
- **Global state.**
  - `AppStoreProvider` (`stores/app-store.tsx`, 532 lines) is one React Context with 17 state slices and 32 setters.
  - The slices: current warband plus loading and error flags, `campaignStarted`, three notification lists, current battle session, trade session, and six per-campaign catalogue caches (skills, spells, specials, items, item properties, races).
  - The value is `useMemo`'d, but any slice change produces a new value. There are 44 consumer files and 0 `React.memo` components in the codebase.
- **Campaign shell.** `CampaignLayout.tsx` (724 lines):
  1. loads the campaign;
  2. then loads 5 catalogue lists and blocks rendering until all settle;
  3. loads the user's warband and summary into the store;
  4. derives the resumable battle from `/campaigns/:id/battles/` on mount, `focus`, `visibilitychange`, `online` and `battle:*` window events;
  5. passes `{campaign, lookups, setMobileTopBar, setCampaign, showRejoinBattleButton}` through the outlet context (16 consumers);
  6. picks `DesktopLayout` or `MobileLayout` with `useMediaQuery("(max-width: 960px)")`.
- **Data fetching.**
  - 21 per-feature API modules (155 `apiRequest` calls), called from `useEffect`s inside components and hooks (266 effects).
  - Stale-response protection is ad hoc: 16 `active`/`cancelled` flags, and one request-version implementation in `useWarbandLoader`.
- **Realtime.** `lib/realtime.ts` has five factories. Each creates its own `new Pusher(...)` client plus one private channel:
  - user notifications: `useNotifications` called from `ProtectedRoute`;
  - campaign chat: `CampaignChatMenu`, mounted in the top bar;
  - battle: `useBattleState` on each battle route;
  - trade: `useWarbandTradeSession`;
  - campaign pings: the factory exists but is never used.

  Events reach the rest of the app through window `CustomEvent`s: `battle:invite`, `battle:prebattle-opened`, `battle:status-updated`, `battle:result-request` and `warband:updated`.
- **Layouts.**
  - `DesktopLayout`: rail, top bar and a scrolling `.desktop-shell__content`.
  - `MobileLayout`: a fixed shell with an inner scroll container, pull-to-refresh (which does a full reload), a bottom nav (`WarbandMobileNav`) and a top bar that pages override through `setMobileTopBar`.
  - `Dialog` becomes a bottom sheet below 960 px.
- **Dice.** `DiceRoller` wraps `@3d-dice/dice-box`: BabylonJS on a canvas plus an Ammo physics Web Worker, with assets under `public/assets/{dice-box,ammo,themes}`. It has 11 call sites, mostly inside dialogs.
- **Tooling.**
  - Vite 5.1, TS 5.3 with `strict: true` (not enforced), Vitest 2 + Testing Library 14 + jsdom.
  - No ESLint, no Prettier, no CI.
  - The build script is plain `vite build`.

## Performance

### FE-PERF-01 · P1 · No server-state layer: every mount refetches, and the same endpoints are fetched from many places
- **Where:** `lib/api-client.ts:67-149` (no cache or dedup); `features/campaigns/routes/CampaignLayout.tsx:316-405,457-489,508-577`; `features/campaigns/hooks/useCampaignOverview.ts:94-224`; `features/campaigns/components/overview/BattleActionPanel.tsx:58-101`; `features/warbands/hooks/warband/useWarbandLoader.ts:122-208`; `features/realtime/hooks/useNotifications.ts:181`; plus the call sites in the table.
- **What:** Server data is copied into component state or the app store by hand-written effects. Nothing is shared or deduplicated, and nothing is reused across navigation. The store's catalogue cache exists, but `CampaignLayout` bypasses it (`auto: false` plus explicit `loadX()`, lines 345-405), and dialogs refetch around it.

  **Same endpoint, several sources:**

  | Endpoint | Fetched from | When |
  | --- | --- | --- |
  | `GET /campaigns/:id/battles/` (full history, 78 queries and 102 KB per call per CAMP-PERF-01) | `CampaignLayout.tsx:521`, `BattleActionPanel.tsx:60` | mount, plus every `focus`, `visibilitychange`, `online` and 3 `battle:*` events, **in each component** |
  | `GET /campaigns/:id/permissions/me/` | `Bestiary.tsx:69`, `HiredSwords.tsx:59`, `Encampments.tsx:74`, `Locations.tsx:73`, `Items.tsx:318`, `HouseRules.tsx:103`, `Skills.tsx:128`, `Spells.tsx:114`, `useCampaignMemberPermissions.ts:32` | every page mount (players) |
  | `GET /warbands/?campaign_id=` and `GET /warbands/:id/summary/` | `CampaignLayout.tsx:469-471` (into the store) and `useWarbandLoader.ts:156-165` (again, despite `initialWarband` from the store) | every Warband visit |
  | skills and spells lists | `useCampaignSkills/Spells` (cached), plus `NewSkillDialog.tsx:61`, `NewHiredSwordSkillDialog.tsx:50`, `NewSpellDialog.tsx:64`, `NewHiredSwordSpellDialog.tsx:55` | every dialog open, cache ignored |
  | 5 catalogue lists (about 900 rows locally: 245 items, 253 skills, 185 spells, 187 specials, 26 races) | `CampaignLayout.tsx:390-396` | every `CampaignLayout` mount, cache ignored |
  | `GET /notifications/` | `useNotifications.ts:181` | every `ProtectedRoute` mount, and every change of `currentBattleSession.battleId`, `tradeSession.requestId`/`status` or the `user` object (deps at 322-338) |
  | `GET /warbands/:id/summary/` | 7 call sites (`CampaignLayout`, `useWarbandLoader`, `useWarbandSave`, `useWarbandHenchmenSave`, `useWarbandHiredSwordsSave`, `useWarbandUpdateListener`, `Warband.tsx`) | after almost every mutation |

  **Cost per user action (traced from code):**

  | Action | API requests to Render |
  | --- | --- |
  | Open a campaign (authenticated, cold) | About 18 REST + 2 Pusher auth, in 4 sequential waves: `/auth/me` → [`/notifications/`, `/campaigns/:id/`, `/campaigns/:id/battles/`, Pusher auth] → [5 catalogues, `/warbands/?campaign_id`] → [`/warbands/:id/summary/`]. After the loading gate lifts: overview [players, completed trades, battle history, pivotal moments, top killers, bulletin, battles again] + chat Pusher auth. With a resumable battle, add 1 battles call, 1 `/notifications/` and 1 Pusher reconnect (store change → effect deps) |
  | Revisit Overview | 7 (`useCampaignOverview.ts:94-224` + `BattleActionPanel.tsx:74-76`) |
  | Visit Warband | ≥7 (5 in the loader, 2 of which duplicate store data, + warchest + permissions) |
  | Visit any catalogue page as a player | 1 permissions call (plus the list, if not cached) |
  | Return to the tab (`focus` + `visibilitychange` both fire) | 2 battle-list calls on every campaign page, 4 on Overview |
  | `/campaigns` ↔ `/campaigns/:id` | +1 `/notifications/` and +1 Pusher connection and auth, each way (separate `ProtectedRoute` per route) |
  | Pull to refresh (mobile) | All of the above again (FE-PERF-02) |

- **Impact:** This is the frontend's main contribution to the Render slowness. A group of 5 players flicking between Overview, Warband and Wargear on phones generates tens of requests per minute per player, nearly all redundant. Each one is a fresh Neon round-trip on a small instance (see INFRA). Users also wait for data they had seconds ago.
- **Fix:** Adopt TanStack Query as the server-state layer. ENGINEERING_RULES §2 already proposes this. The incremental path is under "Target architecture" in Code quality. Suggested settings:
  - `staleTime`: 5 min for catalogues and permissions, 30 s for the battle list, `Infinity` with invalidation for the warband.
  - One query key per resource, so `CampaignLayout` and `BattleActionPanel` share `['battles', campaignId]`, and the Warband page reads `['warband', campaignId]` seeded from the layout's fetch.
  - `refetchOnWindowFocus` respecting `staleTime`, which replaces the hand-rolled focus and visibility listeners.

  Quick wins before the migration:
  - Delete the duplicate battle-list fetch (CAMP-PERF-01).
  - Return `permissions` with the campaign (CAMP-PERF-06).
  - Let `useWarbandLoader` skip the warband and summary fetch when `initialWarband` is fresh.
  - Make the dialogs read `lookups` from the outlet context.
- **Effort:** L (migration); S each for the quick wins · **Confidence:** Confirmed (code trace; consistent with the live-run count in AUTH-PERF-03)

### FE-PERF-02 · P1 · Mobile pull-to-refresh reloads the whole page
- **Where:** `layouts/mobile/mobile-refresh.ts:1-3` (`window.location.reload()`); `layouts/mobile/MobileLayout.tsx:111-128` (`handleTouchEnd`); test `layouts/mobile/__tests__/MobileLayout.test.tsx:16`
- **What:** Pulling past 72 px reloads the document. The SPA reboots from scratch:
  - re-download (if not HTTP-cached) and re-parse the 2.42 MB bundle;
  - re-download the Lottie WASM;
  - `/auth/me`, then the full campaign-entry waterfall (about 20 requests, FE-PERF-01);
  - two new Pusher WebSockets with their auth POSTs;
  - lost UI state (open tabs, expanded rows, scroll).
- **Impact:** Most screens don't receive live updates, so mobile users pull to refresh to see other players' changes, often at the gaming table. Each pull costs the backend about 20 requests and the user several seconds of "Preparing the campaign...". It is the most expensive possible way to fetch fresh data.
- **Fix:** Replace the reload with a refresh event:
  - Short term: `window.dispatchEvent(new Event("app:refresh"))`, handled by the active route's loaders.
  - With TanStack Query: `queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] })` and await `refetchQueries({ type: "active" })` before hiding the "Refreshing..." label.

  Keep a hard reload only as a fallback, for example after an error boundary trips.
- **Effort:** S (after FE-PERF-01) / M (before) · **Confidence:** Confirmed

### FE-PERF-03 · P1 · One 2.42 MB entry chunk; heavy libraries and every route load on first paint
- **Where:** `app/routes/routes.tsx:9-30` (static imports, no `React.lazy`); `components/ui/loading-screen.tsx:1,16-21` (`@lottiefiles/dotlottie-react`); `components/dice/DiceRoller.tsx:19` (static `@3d-dice/dice-box`); framer-motion in 6 warband card files; `vite.config.js` (no `build` options); `features/campaigns/components/overview/BulletinBoardTab.tsx:5` (PNG import)
- **What:** Measured production build (`vite build` in the container, sourcemap attribution):

  | Asset | Size (min) | Gzip | Loaded |
  | --- | --- | --- | --- |
  | `index-*.js` (entry) | **2,420 KB** | **540 KB** | always, including the logged-out landing page |
  | `index-*.css` | 151 KB | 27 KB | always |
  | `world.onscreen-*.js` (dice-box) | 391 KB | 88 KB | first dice roll |
  | `Dice-*.js` (dice-box) | 691 KB | 168 KB | first dice roll |
  | `world.offscreen-*.js` | 1,447 KB | 412 KB | never (`offscreen: false`) |
  | `wanted_poster-*.png` | **1,627 KB** | n/a | Overview bulletin tab |

  **Entry chunk composition:**

  | Source | Size | Note |
  | --- | --- | --- |
  | `@lottiefiles/dotlottie-react` | **640 KB** | 26% of the bundle |
  | `features/warbands` | 345 KB | |
  | `@3d-dice/dice-box` | 193 KB | |
  | `features/battles` | 165 KB | |
  | `features/campaigns` | 150 KB | |
  | `react-dom` | 127 KB | |
  | `framer-motion` | 107 KB | |
  | `features/rules` | 79 KB | static rules HTML, CAT-PERF-10 |
  | `features/items` | 72 KB | |
  | `pusher-js` | 62 KB | |
  | `features/bestiary` | 43 KB | |
  | `components/ui` | 41 KB | |
  | router | 57 KB | |

  The Lottie player is used only by `LoadingScreen`. At runtime it also fetches its 1.5 MB WASM from `cdn.jsdelivr.net` (falling back to `unpkg.com`) and the animation from `lottie.host`, which is three origins just for a spinner.
- **Impact:**
  - First visit and every deploy (new hashes) cost 540 KB gzip of JS, plus about 1.5 MB WASM before the spinner animates.
  - On a mid-range phone, parse and compile of 2.4 MB is roughly 1–2 s of main-thread time.
  - The landing page needs about 15% of that code.
  - Pull-to-refresh (FE-PERF-02) pays the parse cost every time.
- **Fix:**
  1. Replace `DotLottieReact` with a CSS or SVG spinner (or lazy-load it). That alone saves 640 KB and 3 third-party requests.
  2. Lazy-load routes: `const Warband = lazy(() => import(...))` for every route in `routes.tsx`, inside a `<Suspense fallback={<RouteSkeleton/>}>` in `RootLayout` and `CampaignLayout`.
  3. Load `DiceRoller` via `lazy()`, and load dice-box with `await import("@3d-dice/dice-box")` on first roll (see FE-PERF-07).
  4. Use framer-motion's `LazyMotion` + `m`, or CSS transitions.
  5. Lazy-load `pusher-js` after auth.
  6. Convert `wanted_poster.png` to WebP or AVIF, about 100–200 KB.
  7. Add a CI size budget (for example `size-limit`: entry ≤ 250 KB gzip).

  Estimate: the landing page entry drops to about 300–350 KB min (about 100 KB gzip), and a campaign page to about 600–700 KB across chunks.
- **Effort:** M · **Confidence:** Confirmed (measured)

### FE-PERF-04 · P2 · One mega-context: any store write re-renders the whole campaign tree
- **Where:** `stores/app-store.tsx:29-79` (49-field value), `422-521` (value memo with 49 deps), `526-532` (`useAppStore` returns everything); consumers: 44 files, including `CampaignLayout.tsx:109-118` and `useNotifications(false)` at `:119-130`; per-unit consumers such as `features/warbands/hooks/shared/useExperienceBar.ts:29` (reads only `campaignStarted`) and `useUnitItemMenu.ts:62`; new outlet context object every render at `CampaignLayout.tsx:595-603`
- **What:**
  - There are no selectors, so a component that needs `campaignStarted` re-renders when a trade notification arrives.
  - `CampaignLayout` is a consumer near the top of the tree. It passes a fresh `context={{...}}` to `<Outlet>`, so all 16 `useOutletContext` routes re-render too, and nothing below is memoised (0 `React.memo` in `src/`).
  - Writes are frequent:
    - 5 catalogue cache writes on entry;
    - 2–3 writes per `loadWarband` (`setWarbandLoading` ×2, `setWarband`);
    - every notification;
    - a new `currentBattleSession` object on every focus or visibility refresh while a battle is resumable (`CampaignLayout.tsx:522-524`);
    - roster mirroring on every unit edit (ROST-PERF-08).
- **Impact:** Whole-page re-renders of 1,000–1,800-line route trees (`Warband`, `BattlePostbattle`) on low-end phones, multiplied by each per-card store consumer. This doesn't load the backend, but it makes the UI feel slow when the backend is already slow. It also feeds FE-BUG-02 and the mobile edit-mode loop (ROST-PERF-07).
- **Fix:**
  1. Short term:
     - `useMemo` the outlet context.
     - Split the context into `NotificationsContext`, `BattleSessionContext`, `TradeSessionContext` and `CurrentWarbandContext`, each with its own provider and memoised value.
     - Pass `campaignStarted` as a prop to `ExperienceBar`.
  2. Medium term: move UI and session state to Zustand with selector hooks (`useSessionStore(s => s.currentBattleSession)`), and move catalogue caches and the warband into TanStack Query (CAT-CQ-03).
  3. Make `setCurrentBattleSession` bail out when `battleId`, `campaignId` and `status` are unchanged.
- **Effort:** M · **Confidence:** Confirmed (code); impact Likely (not profiled)

### FE-PERF-05 · P2 · One Pusher WebSocket per subscription, re-created on unrelated state changes
- **Where:** `lib/realtime.ts:104-111`, `155-162`, `197-204`, `239-246`, `278-285` (5 × `new Pusher(...)`); `features/realtime/hooks/useNotifications.ts:170-338` (deps at 322-338); `app/routes/routes.tsx:57-70` (one `ProtectedRoute` per route); `CampaignLayout.tsx:236-237,285-291,638-643` (chat menu inside the swappable mobile top bar, and absent on mobile battle routes); `features/warbands/hooks/warband/useWarbandTradeSession.ts:146-231` (deps include `searchParams` and the `tradeSession` object); `features/battles/hooks/useBattleState.ts:116-129`
- **What:**
  - Each factory creates a separate Pusher client, so a tab holds 2 connections (notifications + chat), 3 on a battle page or during a trade.
  - Every creation means a new WebSocket handshake plus a `POST /realtime/pusher/auth/` to Render, which runs JWT and membership queries.
  - Subscriptions are torn down and rebuilt when:
    - the notifications effect deps change: `currentBattleSession?.battleId` (set on every battle-route entry, every invite, every resumable-battle refresh), `tradeSession?.requestId`/`status`, and the `user` object (3 times on login per AUTH-PERF-02). Each rebuild also refetches `/notifications/`;
    - the user navigates `/campaigns` ↔ `/campaigns/:id`, because `ProtectedRoute` unmounts and remounts;
    - on mobile, Warband edit mode replaces `rightSlot`, which unmounts `CampaignChatMenu` (CAMP-PERF-09). Entering a battle route drops the top bar entirely. Crossing 960 px swaps layouts (FE-BUG-01);
    - a URL search param changes during a trade, which rebuilds the trade socket.
- **Impact:**
  - Extra auth POSTs and handshakes on every churn.
  - Events published during the gap are lost. Pusher doesn't replay, and only DB-backed notification types are recovered by the `/notifications/` refetch: `battle_prebattle_opened`, `trade_accepted`, `battle_result_updated` and chat messages are not.
  - The chat unread count resets on each churn.
  - Connection count grows about 2.5× faster than users, which matters against Pusher's sandbox cap of 100 concurrent connections (plan unknown, NOTES Q6).
- **Fix:** Build one realtime client module:
  ```ts
  // lib/realtime/client.ts
  let pusher: Pusher | null = null
  const getClient = () => pusher ??= new Pusher(KEY, {
    cluster: CLUSTER,
    channelAuthorization: {
      endpoint: AUTH_URL, transport: "ajax",
      headersProvider: () => ({ Authorization: `Bearer ${getToken() ?? ""}` }), // AUTH-BUG-08
    },
  })
  const refs = new Map<string, number>()
  export function subscribe(channel: string, event: string, handler: (d: unknown) => void) {
    const c = getClient().subscribe(channel)
    refs.set(channel, (refs.get(channel) ?? 0) + 1)
    c.bind(event, handler)
    return () => {
      c.unbind(event, handler)
      const n = (refs.get(channel) ?? 1) - 1
      n ? refs.set(channel, n) : (refs.delete(channel), getClient().unsubscribe(channel))
    }
  }
  ```
  Then:
  - Expose a `useChannel(channel, event, handler)` hook that keeps `handler` in a ref, so effect deps are only `[channel, event]`.
  - Hoist `ProtectedRoute` into a single pathless layout route wrapping `/campaigns` and `/campaigns/:id`, and mount a `RealtimeProvider` there that owns the user-notification subscription.
  - Keep the chat subscription in a provider rather than in the top-bar button, so the button can mount and unmount freely.
  - Disconnect the client on sign-out.
- **Effort:** M · **Confidence:** Confirmed (code)

### FE-PERF-06 · P2 · Realtime events fan out into refetches through an untyped window-event bus
- **Where:** `useNotifications.ts:243-315` (dispatches `battle:invite`, `battle:result-request`, `battle:status-updated`, `battle:prebattle-opened`), `:366-421` (dispatches `battle:status-updated` after local actions too); listeners in `CampaignLayout.tsx:565-567` and `BattleActionPanel.tsx:91-93` (each refetches the full battle list); `useBattleState.ts:120-125` (any `battle.event` → `refreshBattleState()`); `useWarbandTradeSession.ts:162-197` → `emitWarbandUpdate` → `useWarbandUpdateListener.ts:90-99` (summary refetch)
- **What:** Events carry enough data to update state, such as `{battle_id, campaign_id, status}`, but handlers mostly use them as "something changed, refetch". One `battle_invite` reaching an invitee on Overview costs:
  - a new `currentBattleSession`, which rebuilds the notifications subscription and refetches `/notifications/` (FE-PERF-05);
  - a `battle:invite` window event, which makes 2 × `GET /campaigns/:id/battles/` (78 queries each per CAMP-PERF-01).

  During a battle, each action makes N-1 clients fetch state (BATL-PERF-02). Accepting an invite from the menu dispatches `battle:status-updated` locally, so the user who acted refetches twice more.
- **Impact:** Backend load per event scales with recipients × listeners, not with the size of the change. The window bus is untyped (`as EventListener` casts), hard to trace, and invisible to tests.
- **Fix:**
  - Route events into the query cache, for example `queryClient.setQueryData(["battles", cid], patchStatus(payload))` or `setQueryData(["currentBattle", cid], ...)`.
  - Invalidate, with deduplication and a short debounce, only when the payload is insufficient.
  - Replace the `CustomEvent` bus with a typed emitter (`mitt`), or remove it once handlers write to the cache.
  - Backend side: include the changed state slice in battle event payloads (BATL-PERF-02).
- **Effort:** M · **Confidence:** Confirmed

### FE-PERF-07 · P2 · `DiceRoller` leaks a physics worker, a WebGL context and a resize listener on every mount
- **Where:** `components/dice/DiceRoller.tsx:190-261` (create and init per mount; cleanup only calls `clear()`), `:225-230` (`ResizeObserver` dispatches a global `window` `resize`); `node_modules/@3d-dice/dice-box/dist/dice-box.es.js:169-174` (`resizeWorld` adds a `window` `resize` listener that is never removed), `:399-412` (`new Worker` for Ammo physics; v1.1.4 has no `destroy`); call sites: 11 across 10 files, mostly inside dialogs that unmount on close (`CampaignDiceRollerMenu.tsx:232`, `HeroLevelUpDialog.tsx:67,89`, `HiredSwordLevelUpDialog`, `HenchmenLevelUpDialog`, `PriceSection.tsx:106,146`, `RaritySection`, `NewSpellDialog`, `NewHiredSwordSpellDialog`); `BattlePostbattle.tsx:1196,1207` mounts two at page load
- **What:** Every `DiceRoller` mount (every dialog open) creates:
  - a fullscreen canvas (portal into `body`) with a Babylon engine and WebGL context;
  - an Ammo.js physics Worker with its WASM heap;
  - a permanent window `resize` listener.

  Unmount clears the dice but terminates nothing. Each `ResizeObserver` callback dispatches a synthetic `window` resize, which then wakes every leaked instance. The library is also imported statically, adding 193 KB to the entry chunk (FE-PERF-03).
- **Impact:** Memory, worker and WebGL context counts grow with each dialog open across a session. Postbattle has a level-up dialog per unit, plus price and rarity rolls for purchases. Chrome drops the oldest WebGL context after 16 ("Too many active WebGL contexts"), and iOS Safari reloads tabs under memory pressure, which loses postbattle progress.
- **Fix:**
  - Make DiceBox an app-wide singleton: a `DiceProvider` lazily `import()`s dice-box on the first roll, initialises one instance on one fixed fullscreen container, and exposes `roll(notation, { themeColor }) → Promise<number[]>`.
  - `DiceRoller` then becomes a thin button and result component with no engine lifecycle.
  - Drop the synthetic `window` resize dispatch, or debounce it.
  - This also fixes BATL-PERF-08's "boots two 3D dice engines".
- **Effort:** M · **Confidence:** Confirmed (code and library source); impact Likely (not measured in a browser)

### FE-PERF-08 · P3 · Render-blocking font chain
- **Where:** `src/index.css:1` (`@import url(https://fonts.googleapis.com/...)`); `index.html` (no `preconnect`)
- **What:** Google Fonts loads through a CSS `@import` inside the bundle CSS. The chain is HTML → JS/CSS → fonts CSS → font files, with no `preconnect`.
- **Impact:** Text renders late, or layout shifts on slow mobile connections.
- **Fix:** Move the fonts to `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` plus a `<link rel="stylesheet">` in `index.html`, or self-host with `@fontsource/*`. Self-hosting also removes the third-party origins from a future CSP (FE-SEC-01).
- **Effort:** S · **Confidence:** Confirmed

## Bugs

### FE-BUG-01 · P2 · Crossing 960 px remounts the entire page (tablet rotation, window resize)
- **Where:** `features/campaigns/routes/CampaignLayout.tsx:607-723`; `lib/use-media-query.ts`
- **What:** The routed `content` is placed inside `<MobileLayout>` (lines 640-669) or `<DesktopLayout>` (686-722). These are different component types at the same tree position, so when `isMobile` flips React unmounts the whole subtree and mounts a new one: the page, `CampaignChatMenu` and the menus.
- **Impact:** Rotating an iPad (744–820 px portrait, 1133–1180 px landscape), or resizing a desktop window across 960 px:
  - loses unsaved form state, open dialogs, expanded rows and scroll;
  - refetches all page data (Overview: 7 requests);
  - reconnects the chat Pusher channel.

  Phones stay below 960 px in both orientations, so this hits tablets and desktops.
- **Fix:** Keep the `<Outlet>` at a stable position. Either render one `CampaignShell` component that receives `variant={isMobile ? "mobile" : "desktop"}` and always renders `{content}` in the same child slot, or make the chrome differences pure CSS. Add a test that toggles `matchMedia` and asserts the page component didn't remount (FE-TEST-09).
- **Effort:** M · **Confidence:** Confirmed (React reconciliation rules)

### FE-BUG-02 · P2 · Page overrides of the mobile top bar get reset by the layout (Warband edit mode loses Save/Cancel)
- **Where:** `CampaignLayout.tsx:280-312` (`defaultTopBar` memo, `applyMobileTopBar`, and `useEffect(() => setMobileTopBar(defaultTopBar), [defaultTopBar])`); `features/warbands/hooks/warband/useWarbandMobileTopBar.tsx:287-358` (child `useLayoutEffect` applying the edit override)
- **What:**
  - `defaultTopBar` changes whenever the notification lists, the rejoin button or `currentBattleSession` change. The last of these gets a new object on every focus refresh while a battle is resumable.
  - In that commit, the child's layout effect re-applies its override (`applyMobileTopBar` changed). Then the parent's passive effect runs and calls `setMobileTopBar(defaultTopBar)`.
  - Passive effects run after layout effects, so the default wins. The edit-mode Save, Cancel and section selector vanish, and the bar shows the default title and icons.
  - While ROST-PERF-07's effect loop exists, the next loop iteration re-applies the override and masks the bug. Fixing ROST-PERF-07 will expose it.
- **Impact:** On mobile, a player editing a hero loses the Save/Cancel controls when a notification arrives or when they switch apps and come back.
- **Fix:** Don't copy the default into state. Store only the page override and compose at render time:
  ```ts
  const [override, setOverride] = useState<Partial<MobileTopBarConfig> | null>(null)
  const topBar = useMemo(() => ({ ...defaultTopBar, ...override }), [defaultTopBar, override])
  // context: setMobileTopBar: setOverride (stable); clear on route change
  ```
- **Effort:** S · **Confidence:** Likely (React effect ordering; not reproduced in a browser)

### FE-BUG-03 · P2 · Notification and chat actions fail silently
- **Where:** `features/realtime/components/NotificationsMenu.tsx:17-22` (handlers typed `=> void`), `:75-108` (calls the async handler, then closes the menu, with no await or catch); `useNotifications.ts:340-424` (async handlers that throw on API errors); `features/realtime/components/CampaignChatMenu.tsx:41-74` (`loadMessages` has `try/finally` without `catch`), `:179-181` (shows "No messages yet. Say something!" after a failed load), `:122-141` (send, CAMP-BUG-08)
- **What:**
  - Accepting a trade or battle invite, or approving or declining a reported result, closes the menu immediately. If the API rejects (expired trade, battle already started, Render 502), the promise rejection is unhandled. The notification may stay or disappear, and the user gets no feedback.
  - A failed chat history load renders the empty-state text, which tells the user nothing was ever said.
  - App-wide there are 35 empty `catch` blocks (for example `NewSkillDialog.tsx:61`, `useStashActions.ts:84`, `useUnitItemMenu.ts:102`) and 39 fire-and-forget `void apiCall()` statements.
- **Impact:** UI states that lie. Users retry actions that already happened, or believe an action worked when it didn't. Combined with Render slowness, failures are common and invisible.
- **Fix:**
  - Make the menu handlers async: `await onAcceptTrade(n)`, show a per-row pending state, close only on success, and on failure show the error inline or as a toast (FE-UX-01).
  - Type the props as `=> Promise<void>`.
  - In the chat, add `catch` → `setLoadError(...)` with a Retry button, and restore the draft on send failure.
  - Add an ESLint rule (`@typescript-eslint/no-floating-promises`) to keep these out.
- **Effort:** S · **Confidence:** Confirmed

### FE-BUG-04 · P2 · Realtime has no connection-state handling, no error binding and no catch-up
- **Where:** `lib/realtime.ts` (no `pusher.connection.bind("state_change")`, no `pusher:subscription_error` binding, no `pusher:subscription_succeeded` resync); consumers `useNotifications.ts:204`, `CampaignChatMenu.tsx:77-98`, `useBattleState.ts:116-129`
- **What:**
  - When a subscription fails (an expired token per AUTH-BUG-08, a 403 from channel auth, Pusher limits) or the connection drops and comes back (phone backgrounded at the table), nothing notices.
  - Nothing reconciles what was missed. Only the notification list happens to be refetched, and only when FE-PERF-05's churn re-runs the effect. BATL-BUG-07 is the battle-page instance.
  - There is no indicator that the app is offline.
- **Impact:** Players see stale battle state, chat and invites without knowing it. This is the most likely root of "I didn't get the invite" reports.
- **Fix:** In the shared client (FE-PERF-05):
  - on `subscription_error` with status 401, refresh the token via `apiRequest`, then resubscribe;
  - on `state_change` to `connected` after `unavailable`, or on `subscription_succeeded` after the first, invalidate the queries tied to that channel (notifications, chat page 1, battle state);
  - expose `useRealtimeStatus()` to show a small "Reconnecting..." chip in the top bar.
- **Effort:** M · **Confidence:** Likely (code; reconnect behaviour not exercised)

### FE-BUG-05 · P3 · `ScrollToTop` is a no-op, so new pages open at the previous page's scroll offset
- **Where:** `components/ScrollToTop.tsx:8` (`window.scrollTo(0, 0)`); `src/index.css:450-455` (`.desktop-shell__content { overflow-y: auto }`); `layouts/mobile/MobileLayout.tsx:153-169` (inner scroll div); workaround in `features/items/routes/Items.tsx:228-233`
- **What:** Both shells scroll an inner element and the window never scrolls, so the reset does nothing. `Items.tsx` patches this locally with `document.querySelector(".scrollbar-hidden")`. Other pages don't.
- **Impact:** Navigating from a long Warband sheet to Skills on mobile shows the middle of the Skills page.
- **Fix:** Have each layout own a `scrollRef` and reset `scrollRef.current.scrollTop = 0` on `pathname` change. Delete the `Items.tsx` hack and `ScrollToTop`.
- **Effort:** S · **Confidence:** Confirmed (code)

### FE-BUG-06 · P3 · The API layer has no abort, no timeout and no stale-response guard
- **Where:** `lib/api-client.ts:19-24` (options have no `signal`), `:82-86` (`fetch` without a timeout); `CampaignLayout.tsx:316-343` (`getCampaign`, no guard) and `:457-485` (`loadWarband`, no guard); compare `useWarbandLoader.ts:92,123-199` (request versioning) and the 16 ad hoc `active`/`cancelled` flags elsewhere
- **What:**
  - Overlapping requests can resolve out of order and overwrite newer state. This happens in `CampaignLayout` when realtime navigation (`useNotifications.ts:227,314`) switches `campaignId` while the layout stays mounted.
  - A hung Render request leaves spinners up forever, with no timeout or retry.
- **Impact:** A rare wrong-campaign flash, and permanent "Loading..." states while the backend stalls.
- **Fix:**
  - Add `signal?: AbortSignal` to `ApiRequestOptions` and pass it to `fetch`.
  - Default to `AbortSignal.timeout(20_000)`, combined with any caller signal via `AbortSignal.any`.
  - Retry idempotent GETs once on 502, 503 or 504.
  - TanStack Query supplies the signal and the stale guards automatically.
- **Effort:** S · **Confidence:** Likely

### FE-BUG-07 · P3 · The "Mordheim" display font is hot-linked from a third-party site and returns 404
- **Where:** `src/index.css:4-11` (`@font-face` src `https://www.mordheimer.net/assets/fonts/Mordheim-dec8dc2bfbf57e31033d2274e11b8240.woff2`)
- **What:** `curl -I` on 2026-10-16 returned `HTTP/1.1 404 Not Found`. Every page load makes a failing request, and `font-mordheim` always falls back to Fraunces. Hot-linking a font from another site also raises licensing questions.
- **Impact:** The intended look never renders, and each load wastes a request.
- **Fix:** Self-host a licensed WOFF2 under `src/assets/fonts`, or remove the `@font-face` and the `mordheim` family.
- **Effort:** S · **Confidence:** Confirmed (HTTP check)

### FE-BUG-08 · P3 · Pull-to-refresh `preventDefault()` is ignored
- **Where:** `layouts/mobile/MobileLayout.tsx:101`
- **What:** React registers `touchmove` as a passive listener, so `event.preventDefault()` inside `onTouchMove` does nothing (the browser logs "Unable to preventDefault inside passive event listener"). Native overscroll (iOS rubber-band, Android glow) runs at the same time as the custom `translateY`.
- **Impact:** A jittery, double-moving pull gesture on iOS.
- **Fix:** Attach a native `touchmove` listener with `{ passive: false }` in an effect. Also add `overscroll-behavior-y: contain` on the scroll container. Better still, drop custom pull-to-refresh once data refreshes on focus (FE-PERF-01, FE-PERF-02).
- **Effort:** S · **Confidence:** Likely

## Code quality

### FE-CQ-01 · P1 · TypeScript doesn't pass and nothing enforces it: no typecheck in build, no lint, no formatter, no CI
- **Where:** `frontend/package.json` scripts (`"build": "vite build"`, no `typecheck` or `lint`); there is no `.eslintrc*`, `eslint.config.*` or `.prettierrc`, and no `.github/`; `tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters` all on)
- **What:** `npx tsc --noEmit -p tsconfig.json` in the container reports **98 errors**: 79 in app code and 19 in tests.

  | Code | Count | Meaning |
  | --- | --- | --- |
  | TS2345 | 23 | argument type mismatch |
  | TS2322 | 20 | assignment type mismatch |
  | TS6133 | 18 | unused locals |
  | TS18047 / TS18049 | 11 | possibly null |
  | TS2741 | 6 | missing property |
  | TS2339 | 4 | property doesn't exist |
  | TS2554 | 3 | wrong argument count |
  | TS2307 | 2 | module not found |

  Errors that point at real defects or hidden `any`:
  - `henchmen-level.ts:1` and `unit-stats-mapper.ts:1` import types from non-existent modules (`../components/heroes/utils/hero-level`, `./UnitStatsTable`). Type-only imports don't break the build, so `LevelInfo` and `UnitStats` silently become `any` in every card.
  - `useWarbandSave.ts:187`, `useWarbandHenchmenSave.ts:355`, `useWarbandHiredSwordsSave.ts:172`: "Expected 3 arguments, but got 4". An argument is being dropped at runtime.
  - `useUnitItemMenu.ts:110`: `rarity` doesn't exist on `Item`, so the branch reads `undefined`.
  - `Warband.tsx:983`: `hiredSwords` prop not declared on `WarbandHeroesSection`. `WarbandTabContent.tsx:116,150` reads `henchmenGroups`/`hiredSwords` from a type that lacks them.
  - `HeroCardHeader.tsx:38`, `HeroExpandedCard.tsx:71`: `{ trading_action: false }` isn't a valid `WarbandHeroPayload`. Elsewhere this is papered over with `as any` (`useAcquireItemDialogShared.tsx:677`).
  - `useHenchmenLevelUp.ts:214,247`, `useWarbandHenchmenSave.ts:302`: payload shapes disagree with the API types.
- **Impact:** The `strict: true` config is decorative. Type drift between the API types and their callers isn't caught, which is exactly where the warband save bugs live (cross-ref ROST). It also violates ENGINEERING_RULES §2 and §5 ("Green stays green").
- **Fix:**
  1. Fix the 98 errors, starting with TS2307, TS2554 and TS2339, which are likely real bugs. Each warband one needs a regression test.
  2. Add scripts: `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`, `"build": "tsc --noEmit && vite build"`.
  3. Add a flat ESLint config: `typescript-eslint` recommended-type-checked, `eslint-plugin-react-hooks` (exhaustive-deps would have flagged FE-PERF-05's deps and ROST-PERF-07), `no-floating-promises`, and `jsx-a11y`.
  4. Add Prettier, matching the current majority style (semicolons, double quotes). `app-store.tsx` and `dialog.tsx` use no semicolons and the rest do.
  5. Add a GitHub Actions job: `npm ci && npm run typecheck && npm run lint && npx vitest run && npm run build`, plus the size budget from FE-PERF-03.
- **Effort:** M · **Confidence:** Confirmed (tsc run)

### FE-CQ-02 · P2 · 12 test files exist twice: identical copies beside the code and in `__tests__/`
- **Where:** Pairs (beside ↔ `__tests__/`):
  - `battles/components/active/{ActiveHenchmenGroupCard,ActiveParticipantRoster,ActiveUnitCard}.test.tsx`
  - `battles/components/postbattle/postbattle-utils.test.ts`
  - `battles/components/shared/{BattleDesktopSubnav,BattleUnitStatsAndItems}.test.tsx`
  - `battles/utils/battle-session.test.ts`
  - `items/components/AcquireItemDialog/RaritySection.test.tsx`
  - `items/hooks/useAcquireItemDialogShared.test.tsx`
  - `items/utils/acquire-item-costs.test.ts`
  - `warbands/components/shared/forms/UnitStatsGrid.test.tsx`
  - `warbands/components/shared/unit_details/UnitKillHistoryTooltip.test.tsx`
- **What:** `diff --strip-trailing-cr` shows each pair differs only in the import path (`./x` vs `../x`) and line endings (CRLF beside, LF in `__tests__`). That is 1,742 duplicated lines, run twice. The two `postbattle-utils` and two `useAcquireItemDialogShared` copies also carry their tsc errors twice. Of the 53 test files, only 41 are unique. BATL-CQ-07 covers the 7 battle pairs.
- **Impact:** Double test time, and edits applied to one copy leave the other stale, so "passing" means less than it seems.
- **Fix:** ENGINEERING_RULES §3 says tests go next to the code. Delete the 12 `__tests__/` copies and move the 16 unique `__tests__` files beside their units. Add `.gitattributes` `*.ts text eol=lf` to stop the CRLF/LF split.
- **Effort:** S · **Confidence:** Confirmed (diff)

### FE-CQ-03 · P2 · Copy-pasted realtime factories and dice parsing
- **Where:** `lib/realtime.ts:96-301` (five factories differing only in channel name and event name; each repeats client creation, auth endpoint and close logic); `lib/realtime.ts:81-138` (`createCampaignPingSocket` and `sendPing`, no callers); `PUSHER_*` read in `realtime.ts:64-67` while `API_BASE_URL` lives in `config/env.ts:1`; `parseDiceValues` duplicated verbatim in `components/dice/DiceRoller.tsx:85-122` and `features/realtime/components/CampaignDiceRollerMenu.tsx:27-64`
- **What:** About 200 lines of the realtime module are boilerplate. Every fix (headers provider, error binding) would have to be made five times. Config is split across files.
- **Impact:** Maintenance cost, and the reason AUTH-BUG-08 and FE-BUG-04 exist five times over.
- **Fix:**
  - Replace the factories with `subscribe(channel, event, handler)` from FE-PERF-05, plus small typed wrappers (`subscribeUserNotifications(userId, h)`, ...).
  - Delete the ping factory, or wire it up if pings are wanted.
  - Move all `import.meta.env` reads into `config/env.ts` with validation (warn once).
  - Export `parseDiceValues` from a `components/dice/dice-utils.ts` and import it in both places.
- **Effort:** S · **Confidence:** Confirmed

### FE-CQ-04 · P2 · Data fetching and error handling are hand-rolled everywhere
- **Where:**
  - 266 `useEffect`s; 65 feature files fetch inside effects.
  - `useCampaignOverview.ts:94-224`: six copies of the same 20-line load/error/loading block.
  - 152 copies of `errorResponse instanceof Error ? (errorResponse.message || "...") : "..."` across `src/`.
  - 16 different cancellation flags; one request-version implementation (`useWarbandLoader.ts`).
  - `features/warbands/hooks/campaign/useCampaign{Items,Skills,Spells,Special}.ts` are 60-line clones (diff: only names differ), while the generic `useCampaignData.ts` (55 lines) is unused.
  - `app-store.tsx:124-351`: 6 copies of set, upsert and remove, with inconsistent semantics. `upsertRaceCache` marks a missing entry `loaded: true` (`:336-340`); the others use `loaded: false`.
- **What:** Every screen re-implements loading, error, cancellation and caching slightly differently (CAT-CQ-03 and CAMP-CQ-05 are instances).
- **Impact:** Bugs like FE-BUG-03, FE-BUG-06 and CAT-UX-04 ("empty states lie") recur because each copy gets something wrong. Large diffs for small features.
- **Fix:** The target architecture below. Until then:
  - add `getErrorMessage(e, fallback)` to `lib/api-client.ts` and codemod the 152 sites;
  - delete the four clone hooks in favour of `useCampaignData` (or skip straight to `useQuery`).
- **Effort:** M · **Confidence:** Confirmed

### FE-CQ-05 · P2 · Platform files over the 250-line rule, and what to split
- **Where:** `CampaignLayout.tsx` (724), `DiceRoller.tsx` (490), `useNotifications.ts` (449), `components/ui/tooltip.tsx` (394), `app-store.tsx` (532); ENGINEERING_RULES §2 sets ≤ 250 lines.
- **What and proposed split:**
  - **`CampaignLayout`** (also CAMP-CQ-02):
    - `useCampaign(campaignId)`;
    - `useCurrentBattle(campaignId)` (the battle list query plus rejoin);
    - `CampaignShell` (stable layout, FE-BUG-01);
    - `CampaignTopBarActions` (dice, chat and notifications, rendered once; today the `NotificationsMenu` props are duplicated at 208-235 and 705-716);
    - `useMobileTopBarOverride` (FE-BUG-02);
    - `campaignNavItems(campaign)`;
    - the five lookup hooks move to the pages that need them.
  - **`useNotifications`:**
    - `notification-mappers.ts` (lines 29-145, pure and unit-testable);
    - `useNotificationList` (query);
    - `useNotificationSubscription` (realtime → cache);
    - `useNotificationActions` (mutations with error state).
  - **`DiceRoller`:**
    - `DiceProvider` (singleton engine, FE-PERF-07);
    - `DiceRollButton` (button-only variant);
    - `CustomDicePicker` (custom-mode controls);
    - `dice-utils.ts`.
  - **`app-store`:** disappears into Query plus a ≤100-line Zustand session store.
- **Impact:** Today one 700-line component owns seven jobs, so a change to the rejoin button re-renders and retests the whole campaign shell.
- **Fix:** Split as above, in refactor-only PRs (ENGINEERING_RULES §1.4).
- **Effort:** M · **Confidence:** Confirmed

### FE-CQ-06 · P3 · Dead code and an unused dependency
- **Where:**
  - Unused files: `app/routes/NotFound.tsx`, `components/ui/meta-row.tsx` (130 lines), `components/ui/hero-card-skeleton.tsx` (96), `components/ui/filter-search-action-header.tsx` (32), `types/ui.ts`, `features/warbands/hooks/campaign/useCampaignData.ts`, `features/battles/components/prebattle/usePrebattleRosters.ts`, `features/warbands/hooks/shared/useSearchableList.ts`, and the empty `src/test/features/campaigns/`.
  - Unused exports with no reference outside their defining file (heuristic): `createCampaignPingSocket`, `cancelBattlePrebattle`, `createRestriction`, `deleteBestiaryEntry`, `updateBestiaryEntry`, `deleteHiredSwordProfile`, `updateHiredSwordProfile`, `listCampaignPermissions`, `listCampaignWarbands`, `listPendingTradeRequests`, `getWarbandRestrictions`, `getWarbandUnitCount`, `getPendingSpend`, `getLogTemplate`, `logTranslations`, `getDefaultExplorationDiceCount`, `rerollLocalExplorationDie`, `setUnitOverrideStat`, `henchmenGroupPayload`, `hiredSwordPayload`.
  - Unused locals flagged by tsc: `settingsButton` (`CampaignLayout.tsx:178`), `isMobile` (`dialog.tsx:20`), `hasMore` (`CampaignChatMenu.tsx:22`), `handleRollDice` (`NewSpellDialog.tsx:157`, `NewHiredSwordSpellDialog.tsx:141`).
  - `react-icons` is in `dependencies` but imported nowhere.
- **Impact:** Noise, and dead code that still ships (the `meta-row` and skeleton files are tree-shaken, the exported API functions in shared modules may not be).
- **Fix:** Delete them. Add `knip` (or `ts-prune`) to CI to keep it clean, along with `noUnusedLocals` enforcement through FE-CQ-01.
- **Effort:** S · **Confidence:** Confirmed for files and dependency; Likely for exports (grep heuristic)

### FE-CQ-07 · P3 · Typing gaps paper over API contract drift
- **Where:**
  - 30 `any` in app code. 13 are `as any` on mutation payloads: `LearnSkillDialog.tsx:89,93`, `AttuneSpellDialog.tsx:96,100`, `NewSkillDialog.tsx:168`, `NewSpellDialog.tsx:180`, `useAcquireItemDialogShared.tsx:677,787,807,827`, ...
  - 14 `Record<string, any>` log payloads in `features/warbands/data/log-formatters.tsx`.
  - `types/dice-box.d.ts` declares the whole library as `any` (`DiceRoller.tsx:149` `useRef<any>`).
  - `ApiError` (`api-client.ts:7-17`) is never inspected by callers. 152 sites read only `.message`, so 403, 404, 409 and 5xx are indistinguishable in the UI.
- **What:** Payload types are incomplete, so callers cast instead of fixing the type. The TS2307 phantom imports (FE-CQ-01) add more silent `any`.
- **Impact:** Contract drift between Django serializers and the UI is invisible until runtime.
- **Fix:**
  - Complete the payload types, or generate them from the DRF schema (`drf-spectacular` + `openapi-typescript`).
  - Model log payloads as a discriminated union on `entry_type`.
  - Write a minimal `dice-box.d.ts` with `init`, `roll`, `clear` and `updateConfig`.
  - Have UI error helpers branch on `ApiError.status` (for example a friendly message for 403 and a "server waking up" message for 502/503).
- **Effort:** M · **Confidence:** Confirmed

### FE-CQ-08 · P3 · Outdated toolchain and dependency hygiene
- **Where:** `package.json`; `Dockerfile:6` (`npm install`, not `npm ci`); `npm outdated` (2026-10-16)
- **What:**
  - `vite` 5.1.4 (latest 8.x), `@vitejs/plugin-react` 4.2.1, `typescript` 5.3.3, `react-router-dom` 6.22.3 (7.x), `@testing-library/react` 14 (16), `framer-motion` 11 (14), `jsdom` 24, `tailwindcss` 3.4.1, Radix minors behind.
  - `react`/`react-dom` pinned at 18.2.0.
  - The browserslist database is 10 months old (warned during the build).
  - `vite.config.js` sets no `build.target`, `manualChunks` or sourcemap policy.
- **Impact:** Missed bug and performance fixes (Vite 5.1 → 5.4 alone has build and CSS fixes). Non-reproducible installs in the image.
- **Fix:**
  - Use `npm ci` in the Dockerfile.
  - Bump within majors first (Vite 5.4, TS 5.x latest, Radix, pusher-js 8.6, RTL 14.3 → 16 with React 18 support).
  - Plan React Router 7 (non-breaking in data-router mode with future flags) and React 19 later.
  - Run `npx update-browserslist-db@latest`.
  - Remove `react-icons`.
- **Effort:** M · **Confidence:** Confirmed

### FE-CQ-09 · P3 · A global `submit` interceptor hides missing `preventDefault`
- **Where:** `app/provider.tsx:9-21`
- **What:** A capture-phase `submit` listener on `document` calls `preventDefault()` on every form submission. Its `if (event.defaultPrevented) return` check can never be true there, because the document capture listener runs before any React handler.
- **Impact:** Forms without their own `preventDefault` work by accident. Anyone who later wants a native form post (for example a file download) will be surprised.
- **Fix:** Audit the `<form onSubmit>` handlers (add `e.preventDefault()` where missing), then remove the interceptor.
- **Effort:** S · **Confidence:** Confirmed

### Target architecture and incremental migration

**Target**

| Concern | Today | Target |
| --- | --- | --- |
| Server state | `useEffect` + `useState` copies, app-store caches, window events | **TanStack Query v5**. One `queryKeys` factory (`['campaign', id]`, `['battles', id]`, `['catalogue', 'items', id]`, `['warband', id]`, `['permissions', id]`, `['notifications']`). `staleTime` per class: catalogues and permissions 5 min, warband ∞ with invalidation, battles 30 s, overview tabs 60 s. Mutations update or invalidate only affected keys |
| Client and session state | 49-field Context | Small **Zustand** store with selectors: `currentBattleSession`, `tradeSession`, dice colour, UI prefs. Auth in its own tiny store or `useSyncExternalStore` (AUTH-CQ-05) |
| Realtime | 5 Pusher clients, handlers trigger refetches | One client, ref-counted `useChannel`, handlers call `setQueryData` (or a debounced `invalidateQueries`), connection status hook |
| Campaign shell | 724-line layout gating on catalogues | Thin `CampaignShell` (stable outlet), `useCampaign`, `useCurrentBattle`; pages declare their own queries; route-level `lazy()` + Suspense skeletons |
| Errors and feedback | inline red text, swallowed catches | `errorElement` per route + top `ErrorBoundary`; toast system; `getErrorMessage(ApiError)` |

**Migration path.** Each step ships independently and is behaviour-preserving unless noted.

1. **Guardrails.** Fix tsc (FE-CQ-01), add ESLint with react-hooks and `no-floating-promises`, add CI, delete the duplicate tests (FE-CQ-02).
2. **Quick wins (no new libraries).**
   - Dedupe the battle list and throttle the focus refetch (CAMP-PERF-01).
   - Stop gating on catalogues (CAMP-PERF-02).
   - Memoise the outlet context, key the app store by user (AUTH-BUG-03), and replace the pull-to-refresh reload (FE-PERF-02).
   - Swap Lottie for CSS and lazy-load routes (FE-PERF-03).
3. **Install TanStack Query** with `QueryClientProvider` in `app/provider.tsx`, then add `queryKeys.ts` and `lib/query-client.ts` (defaults: `staleTime: 30_000`, `retry: 1` on 5xx and network errors only, `refetchOnWindowFocus: true`).
4. **Migrate read paths leaf-first, one PR per resource.** Order:
   1. catalogues (replace the 6 store caches and 4 clone hooks);
   2. permissions (or fold them into the campaign payload);
   3. battle list and current battle;
   4. overview tabs;
   5. warband and roster (replaces `useWarbandLoader` and the store mirror);
   6. notifications.

   After each step, delete the store slice it replaced.
5. **Mutations.** Use `useMutation` with targeted `setQueryData` from the response (the backend already returns updated objects in most writes), replacing `emitWarbandUpdate` + summary refetch.
6. **Realtime.** Introduce the shared client and `useChannel` (FE-PERF-05), and point handlers at the query cache (FE-PERF-06). Remove the window `CustomEvent` bus.
7. **Shrink the store.** Move what remains (`currentBattleSession`, `tradeSession`, `diceColor`) to Zustand and delete `app-store.tsx`.

## UI / UX

### FE-UX-01 · P2 · No error boundaries, no toasts, no shared error or empty-state components
- **Where:** No `ErrorBoundary`, `errorElement` or `useRouteError` anywhere (`app/router.tsx`, `routes.tsx`); no toast library (0 references); 35 empty `catch` blocks (FE-BUG-03); error text is `text-red-600` (116 uses) on the near-black background (`--background: 26 41% 4%`, `index.css:655`), about 4.1:1, below WCAG AA 4.5:1 for small text
- **What:**
  - A render-time exception in any feature unmounts the whole app to a blank screen, because React 18 without a boundary shows nothing.
  - Success and failure of background actions (dice log, notification actions, saves) have no consistent feedback channel.
  - Each page invents its own error paragraph and empty state. Some show empty states on failure (CAT-UX-04).
- **Impact:** Users can't tell "nothing there" from "failed to load", which matters most when Render is slow or erroring. A single bad payload (for example a null that tsc would have caught, FE-CQ-01) blanks the app mid-battle.
- **Fix:**
  - Add `errorElement: <RouteError/>` on the root and campaign routes, with Retry, "Back to campaign" and a report link to the existing feedback endpoint.
  - Add a top-level `ErrorBoundary` around `RouterProvider`.
  - Add a toast system (`sonner`, about 4 KB) for mutation results.
  - Add shared `<ErrorState onRetry/>` and `<EmptyState/>` components.
  - Raise the error colour to `text-red-400` or a token `--destructive-foreground` with at least 4.5:1 contrast.
- **Effort:** M · **Confidence:** Confirmed

### FE-UX-02 · P2 · Full-screen loading gates that give no cold-start feedback
- **Where:** `components/ui/loading-screen.tsx` (fixed black overlay plus Lottie); used by `ProtectedRoute.tsx:19-21`, `CampaignLayout.tsx:579-581` ("Preparing the campaign..." until 5 catalogues load), and the battle routes (`BattleActive`, `BattlePrebattle`, `BattlePostbattle`); skeletons exist (`card-skeleton`, `table-skeleton`) but are used in 4 and 8 files
- **What:**
  - Every campaign entry and every battle-page entry blanks the whole UI behind a black overlay.
  - The animation itself depends on two third-party CDNs (FE-PERF-03). Until the WASM arrives, the user sees black plus "Loading...".
  - Nothing distinguishes "slow" from "server waking up" (Render free-tier spin-up can take 30–60 s; AUTH-UX-03).
- **Impact:** Users perceive the app as hung and reload, which restarts the waterfall and adds load.
- **Fix:**
  - Render the shell (sidebar, top bar, page header) immediately, with skeletons in the content area.
  - Reserve the full-screen loader for the first `/auth/me` only.
  - After 3 s of an outstanding request, show "The server is waking up. This can take up to a minute."
  - Use a CSS spinner.
- **Effort:** M · **Confidence:** Confirmed

### FE-UX-03 · P2 · Unknown URLs bounce to `/`, and deep links don't survive login
- **Where:** `app/routes/routes.tsx:98-101` (`*` → `<Navigate to="/" replace />`); `app/routes/NotFound.tsx` (unused); `components/ProtectedRoute.tsx:23-25` (redirects without `state.from`); `features/auth/components/AuthCard.tsx:38-41` (always goes to `/campaigns`); `routes.tsx` `warbands` child renders `PlaceholderPage` ("Coming soon")
- **What:**
  - A typo, a stale bookmark or a deleted battle URL silently lands on the login page, which then forwards logged-in users to `/campaigns`.
  - A battle link shared in chat, opened while logged out, loses its target after login (AUTH-UX-02 covers session expiry).
  - `/campaigns/:id/warbands` is a reachable placeholder.
- **Impact:** Disorienting navigation, and lost context when players share links at the table.
- **Fix:**
  - Route `*` to `NotFound`, with a link back to `/campaigns`. Add a campaign-scoped `*` child that links back to the campaign.
  - `ProtectedRoute`: `<Navigate to="/" replace state={{ from: location }} />`, and `AuthCard` navigates to `state.from ?? "/campaigns"`.
  - Remove the placeholder route, or hide it until the page exists.
- **Effort:** S · **Confidence:** Confirmed

### FE-UX-04 · P2 · Realtime events yank users to another page
- **Where:** `useNotifications.ts:226-227` (`trade_accepted` → `navigate(/campaigns/:cid/warband?trade=...)`), `:314` (`battle_prebattle_opened` → `navigate(.../prebattle)`)
- **What:** These events navigate immediately, whatever the user is doing (editing a hero, filling postbattle in another battle, reading rules), possibly into another campaign. There is no unsaved-changes guard (`useBlocker` is unused).
- **Impact:** Unsaved edits are lost, and the context switch is unexpected. It also causes the campaign switch race in FE-BUG-06.
- **Fix:**
  - Show an actionable banner or toast ("Prebattle for *Battle #41* is open. Go now") and auto-navigate only if the user is idle on Overview.
  - Register `useBlocker` on dirty forms (the warband edit state and the postbattle draft already track dirtiness).
- **Effort:** S · **Confidence:** Confirmed

### FE-UX-05 · P3 · Accessibility gaps in shared primitives
- **Where:**
  - `features/warbands/components/shared/forms/SearchableDropdown.tsx:85-140`
  - `components/ui/tab-switcher.tsx:33-48`
  - `components/ui/dialog.tsx:65-73,126-187`
  - `components/ui/checkbox.tsx:20-38`
  - tiny type: 152 uses of `text-[0.5rem]`–`text-[0.68rem]` (10 at `0.5rem` = 8 px, 29 at `0.55rem`)
- **What:**
  - **`SearchableDropdown`** (used across unit forms):
    - no `role="combobox"`, `aria-expanded`, `aria-controls` or `aria-activedescendant`;
    - no arrow-key navigation;
    - the input's `onBlur` schedules `onBlur()` after 120 ms (`:92-96`), and the option buttons don't cancel it, so tabbing from the input to an option closes the list first. Keyboard users likely can't pick an option.
  - **`TabSwitcher`:** plain buttons with `data-active`. No `role="tablist"`, `tab` or `aria-selected`, so screen readers can't tell which tab is active.
  - **`Dialog`:**
    - no visible close button (on mobile the overlay is `pointer-events-none`, and closing relies on an outside tap or Escape);
    - on mobile `onOpenAutoFocus` is prevented, so focus stays on the trigger behind the sheet.
  - **`Checkbox`:** the native input is `opacity-0`, and the decorative box has no focus-visible style, so keyboard focus is invisible.
- **Impact:** Keyboard and screen-reader users are blocked from core flows (adding skills and items through the searchable dropdowns). ENGINEERING_RULES §2 asks for Radix/cmdk primitives.
- **Fix:**
  - Rebuild `SearchableDropdown` on `cmdk` or Radix Popover + listbox.
  - Use `@radix-ui/react-tabs` for `TabSwitcher` and `MobileTabs`.
  - Add a `DialogClose` "X" button (`aria-label="Close"`) in `DialogContent`, and on mobile focus the dialog title instead of preventing focus.
  - `Checkbox`: add `peer` on the input and `peer-focus-visible:ring-2` on the box.
  - Set a minimum of 0.7rem (11.2 px) for running text.
  - Add `eslint-plugin-jsx-a11y` (FE-CQ-01).
- **Effort:** M · **Confidence:** Likely (static review; no screen-reader run)

### FE-UX-06 · P3 · Three breakpoint systems, and safe-area insets that never apply
- **Where:**
  - `"(max-width: 960px)"` hard-coded 34 times in 32 files (`useMediaQuery` call sites).
  - CSS media queries at 960 px (5), 959 px (1) and 640 px (1).
  - `dialog.tsx` uses `min-[960px]` and `max-[959px]`.
  - Tailwind defaults `sm` 640 (345 uses), `md` 768 (79), `lg` 1024 (41).
  - `index.html` viewport lacks `viewport-fit=cover`, while layouts use `env(safe-area-inset-*)` throughout (`MobileLayout.tsx:36-41`, `MobileTopBar.tsx:32`, `CampaignLayout.tsx:651-652`, `dialog.tsx:156`).
- **What:**
  - Between 768 and 960 px (portrait tablets), the JS mobile shell (top bar, bottom nav, bottom-sheet dialogs) renders content styled with Tailwind's `md:` desktop variants.
  - At exactly 960 px, `max-width: 960px` (JS) and `max-width: 959px` (CSS) disagree.
  - Without `viewport-fit=cover`, iOS reports all safe-area insets as 0, so the inset padding is dead code until someone adds it, and then it will suddenly apply everywhere.
- **Impact:** Inconsistent tablet layouts that are hard to reason about.
- **Fix:**
  - Add one `MOBILE_BREAKPOINT = 960` constant and a `useIsMobile()` hook.
  - Add a Tailwind screen (`screens: { shell: "960px" }`) and use `shell:` for shell-dependent styling.
  - Replace the 959 px rule.
  - Decide on `viewport-fit=cover`, then test on a notched iPhone in Safari and in a home-screen PWA.
- **Effort:** S · **Confidence:** Confirmed

### FE-UX-07 · P3 · Notification and chat badge semantics
- **Where:** `NotificationsMenu.tsx:144-152` and `useNotifications.ts:426-435` ("Clear" removes every pending invite and request locally and calls `clear-all`, with no confirmation); `CampaignChatMenu.tsx:93-95` (unread increments for every message, including your own from another device; resets on any remount, FE-PERF-05)
- **What:** One tap on "Clear" discards actionable items (BATL-BUG-09 shows a cleared result request can't be reached again). The unread chat count is per-mount and not persisted.
- **Impact:** Lost battle and trade requests. An unreliable chat badge.
- **Fix:**
  - Confirm before clearing, or clear only informational items.
  - Skip unread for `msg.user_id === currentUser.id`.
  - Store the last-read message id per campaign (localStorage, or a backend field) and compute unread on load.
- **Effort:** S · **Confidence:** Confirmed

## Security

### FE-SEC-01 · P3 · No security headers, and executable code fetched from third-party CDNs at runtime
- **Where:** `frontend/vercel.json` (routes only, no `headers`); `components/ui/loading-screen.tsx:17` (`lottie.host`); dotlottie-web loads `dotlottie-player.wasm` from `cdn.jsdelivr.net` with `unpkg.com` fallback (seen in the built entry chunk); `index.css:1,6` (Google Fonts, `mordheimer.net`); tokens in localStorage (`utils/storage.ts:1-2`)
- **What:**
  - There is no Content-Security-Policy, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy` or `Permissions-Policy`.
  - WebAssembly is executed from public CDNs that are version-pinned but not integrity-checked.
  - With JWTs in localStorage, any XSS is a full account takeover. AUTH-SEC-02 is a live instance in campaign locations.
- **Impact:** Defence-in-depth gap. A CSP would have neutralised AUTH-SEC-02's inline-handler payload, and clickjacking is unmitigated.
- **Fix:**
  - Self-host or remove the Lottie asset and WASM (FE-PERF-03) and the fonts (FE-PERF-08, FE-BUG-07).
  - Then add to `vercel.json`:
    ```json
    { "source": "/(.*)", "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://<render-host> wss://ws-eu.pusher.com https://sockjs-eu.pusher.com; worker-src 'self' blob:; frame-src https://www.youtube-nocookie.com; frame-ancestors 'none'" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Content-Type-Options", "value": "nosniff" } ] }
    ```
    dice-box creates a worker from a blob or data URL, so `worker-src` needs `blob:`, and dice-box needs `'wasm-unsafe-eval'` in `script-src` for Ammo. Verify in staging.
  - Long term, move the refresh token to an httpOnly cookie (AUTH-SEC-04; easier once the API is same-origin via the AUTH-PERF-03 rewrite).
- **Effort:** S–M · **Confidence:** Confirmed (config); exploitability depends on AUTH-SEC-02

## Test plan

### Existing coverage

- **Tooling:**
  - Vitest 2.1.9 (`globals: true`, `environment: "jsdom"`, `css: true` in `vite.config.js`), `@testing-library/react` 14, `user-event` 14, `jest-dom`.
  - `src/test/setup.ts` only installs jest-dom matchers and a `matchMedia` stub that always returns `matches: false`, so every test renders the desktop branch unless it re-mocks.
  - No coverage provider, no MSW (API modules are `vi.mock`ed per file), no e2e, no CI, no `typecheck` step. Four test files currently fail tsc.
- **Inventory:**
  - 53 test files (8,223 lines): 25 beside the code, 28 in `__tests__/`. 12 are duplicates (FE-CQ-02), leaving 41 unique.
  - Most are feature-level: battle routes with mocked sockets, warband hooks, item costs.
- **Platform tests that exist:**
  - `stores/app-store.test.tsx`: 2 cases, catalogue cache upsert and remove only.
  - `layouts/mobile/__tests__/MobileLayout.test.tsx`: 3 cases, pull-to-refresh threshold, with `reloadMobileLayout` mocked.
  - `components/ui/tooltip.test.tsx`: 4 cases, hover, tap, scroll and cancel.
  - `lib/url-utils.test.ts`: 3 cases.
- **No tests at all:**
  - `lib/api-client.ts` (refresh single-flight, retry, error extraction);
  - `features/auth/stores/auth-store.tsx`;
  - `lib/realtime.ts`;
  - `useNotifications` and the three realtime menus;
  - `ProtectedRoute`, the routes table and 404 handling;
  - `CampaignLayout` (gating, focus refresh, top bar, layout switch);
  - `DiceRoller` lifecycle;
  - `Dialog` mobile behaviour;
  - `ScrollToTop`.

### Gaps and proposed tests

Proposed tooling:
- **MSW 2** for component and integration tests, so request counts can be asserted.
- **A `renderWithProviders`** helper (router + Query client + auth + realtime mock) in `src/test/`.
- **`@vitest/coverage-v8`**, with a floor of 60% on `lib/`, `stores/` and `features/realtime/`.
- **Playwright** for e2e, with two browser contexts for multi-user realtime. Run the Pusher-compatible **soketi** container in docker-compose so e2e never touches the real Pusher app.
- **A Playwright request-budget fixture** (`page.on("request")`) that fails a test when a screen exceeds its API budget.

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| FE-TEST-01 | unit | `apiRequest`: three concurrent requests get 401; refresh succeeds | Exactly one `POST /auth/refresh/`; all three retried once with the new token; resolved values returned | P1 |
| FE-TEST-02 | unit | `refreshAccessToken` fails with network error, with 503, and with 401 | Tokens kept for network and 503, cleared only for 400/401 (pins AUTH-BUG-01) | P1 |
| FE-TEST-03 | component | `AuthProvider`: the refresh path dispatches `auth:tokens-changed` while protected content is mounted | Protected child is **not** unmounted (mount counter stays 1) and `/auth/me` is not refetched (pins AUTH-BUG-02) | P1 |
| FE-TEST-04 | component | `signIn` with MSW | `GET /auth/me/` called once (AUTH-PERF-02) | P2 |
| FE-TEST-05 | integration | Render `/campaigns/1` (index) with MSW and count requests by path | Each endpoint at most once. Total ≤ budget (target ≤ 12 after FE-PERF-01; today about 18). No duplicate `/battles/` | P1 |
| FE-TEST-06 | integration | Navigate Overview → Warband → Overview within `staleTime` | Second Overview makes 0 requests; Warband doesn't refetch the warband or summary already in cache | P1 |
| FE-TEST-07 | integration | Fire `focus` and `visibilitychange` together on Overview | At most 1 `/battles/` request, throttled (CAMP-PERF-01) | P1 |
| FE-TEST-08 | component | `MobileLayout` pull past threshold, after FE-PERF-02 | No `location.reload`; active queries refetched; "Refreshing..." shown until settled | P2 |
| FE-TEST-09 | component | `CampaignLayout`: toggle the `matchMedia(960px)` mock while a page with local state is mounted | Page component not remounted; state preserved (FE-BUG-01) | P2 |
| FE-TEST-10 | component | Warband mobile edit override active, then a notification is added to the store | Top bar still shows Save and Cancel (FE-BUG-02) | P2 |
| FE-TEST-11 | unit | Realtime client: two `useChannel` hooks on the same channel, unmount one, unmount both | One `subscribe` call; unsubscribe only after the last; one Pusher instance overall (FE-PERF-05) | P1 |
| FE-TEST-12 | unit | `useNotifications` with mocked realtime: change `currentBattleSession` and `tradeSession` | No resubscribe and no `/notifications/` refetch (FE-PERF-05) | P1 |
| FE-TEST-13 | unit | Realtime client gets `pusher:subscription_error` with status 401 | Token refresh attempted, then resubscribe with the new header (AUTH-BUG-08, FE-BUG-04) | P2 |
| FE-TEST-14 | unit | `notification-mappers` (extracted from `useNotifications.ts:29-145`) | Trade, invite and result payloads map correctly; malformed payloads return `null` | P2 |
| FE-TEST-15 | component | `NotificationsMenu`: accept trade, API rejects with 400 | Menu stays open, row shows the error, no unhandled rejection (FE-BUG-03) | P2 |
| FE-TEST-16 | component | `CampaignChatMenu`: history load fails; send fails | Error state with Retry instead of "No messages yet"; draft restored after a failed send (CAMP-BUG-08) | P2 |
| FE-TEST-17 | component | `DiceRoller` with a mocked DiceBox: mount and unmount 5 times | Engine constructed once (singleton); no extra `window` resize listeners (FE-PERF-07) | P2 |
| FE-TEST-18 | component | Router: unknown path `/nope`; logged-out visit to `/campaigns/1/battles/2/active` | `NotFound` shown; after login, lands on the original battle URL (FE-UX-03) | P2 |
| FE-TEST-19 | component | Throw inside a route component | `errorElement` renders with Retry; rest of the shell intact (FE-UX-01) | P2 |
| FE-TEST-20 | component | Sign out as user A, sign in as user B (same tab) | Store empty for B; no A notifications (AUTH-BUG-03) | P2 |
| FE-TEST-21 | component | `SearchableDropdown` keyboard: type, ArrowDown, Enter; Tab from input | Option selected by keyboard; list stays open while focus is inside (FE-UX-05) | P3 |
| FE-TEST-22 | e2e | Two users (two Playwright contexts) in one campaign: A invites B to a battle | B's bell badge increments within 2 s without reload; B accepts; A's Overview shows prebattle; no page makes duplicate `/battles/` calls | P1 |
| FE-TEST-23 | e2e | Two users chat; B has the menu closed | B's unread badge increments; opening shows the message once; A's own messages don't increment A's badge on a second device | P2 |
| FE-TEST-24 | e2e | Kill the soketi container for 10 s during a battle, then restore | "Reconnecting" chip shown; after restore, B's battle state catches up without manual reload (FE-BUG-04) | P2 |
| FE-TEST-25 | e2e | Mobile viewport (390×844): campaign entry request budget and pull to refresh | Entry within budget; pull refreshes data without a document reload (`page.on("framenavigated")` not fired) | P1 |
| FE-TEST-26 | e2e | Backend returns 503 for `/auth/me` on boot (route intercept) | User stays logged in; "server unavailable" screen with Retry; recovers when the route is restored (AUTH-BUG-01) | P1 |
| FE-TEST-27 | CI | `vite build` with size-limit | Entry chunk ≤ 250 KB gzip; job fails on regression (FE-PERF-03) | P2 |
| FE-TEST-28 | CI | `tsc --noEmit`, `eslint .`, `vitest run` on every push | All green (FE-CQ-01) | P1 |
| FE-TEST-29 | manual | Location content containing `<img src=x onerror=alert(1)>` (local only) | No script execution; content sanitised (AUTH-SEC-02) | P1 |

### Manual QA script

Run this against the local Docker stack (`http://localhost:5173`) unless noted. Keep DevTools → Network open with "Preserve log" on, filtered to `Fetch/XHR` and `WS`.

1. **Cold boot.** Hard-reload `/campaigns`. Note the JS transferred (production build: expect one `index-*.js`; after FE-PERF-03, several smaller chunks). Confirm `/auth/me/` is called once.
2. **Login request count.** Sign out, then sign in. Count `/auth/me/` calls (expect 1 after AUTH-PERF-02; today 3) and Pusher auth POSTs (expect 1).
3. **Campaign entry.** Open a campaign. Record every API call until the Overview finishes loading. Expected after the fixes: no endpoint twice, no "Preparing the campaign..." longer than the `/campaigns/:id/` call. Today you'll see `/battles/` twice and the 5 catalogue calls before any overview call.
4. **Navigation reuse.** Click Overview → Warband → Overview → Wargear → Overview within 30 s. After FE-PERF-01, the second and third Overview visits make 0 calls. Today each makes 7.
5. **Tab return.** Switch to another browser tab for 5 s and back, on Overview, then on Warband. Count `/battles/` calls: today 4 on Overview and 2 elsewhere; target ≤ 1.
6. **Two-tab realtime.** Open the same campaign as user A (normal window) and user B (incognito). From A, start a battle and invite B. In B, the bell badge should increment without a reload. Check B's WS frames: one WebSocket connection should carry both the user and chat channels after FE-PERF-05 (today there are 2 to 3 sockets). Check that B's console has no unhandled promise rejections.
7. **Realtime failure path.** In B, set DevTools → Network to Offline for 15 s, then Online. B should show "Reconnecting..." and then catch up (an invite sent by A while B was offline should appear). Today nothing indicates the drop.
8. **Notification action failure.** In B, block `*/battles/*/join/` (DevTools "Block request URL") and accept the invite from the menu. The menu should show an error and stay open. Today it closes and nothing happens.
9. **Chat.** In A, send a message with the backend stopped (`docker stop mordheim-backend-1`). The draft must stay in the input, with an error shown. Restart the backend.
10. **Mobile viewport.** Switch DevTools device emulation to iPhone 14 (390×844) and reload.
    1. The bottom nav shows and the top bar shows the dice, chat and bell icons.
    2. Scroll the Warband page halfway, tap Skills in the nav, and confirm the Skills page starts at the top (FE-BUG-05).
    3. Pull down from the top past the threshold. After FE-PERF-02 the data refreshes without a full reload (the Network panel shows no document request). Today a document reload happens.
11. **Mobile edit mode.** Still mobile: open Warband → edit a hero, so the top bar shows Cancel/Save. From user A, send B a trade request. B's top bar must still show Cancel/Save (FE-BUG-02). Then save. The chat badge and connection must survive (no new Pusher auth POST while entering or leaving edit mode).
12. **Breakpoint flip.** Set the viewport to 900 px wide, open a hero edit form and type into a field, then widen to 1000 px. The typed value and open form must survive (FE-BUG-01). Today the page remounts and refetches.
13. **Token refresh.** In DevTools → Application → Local Storage, replace `mordheim_token` with a garbage string (keep `mordheim_refresh_token`), then click any tab. Expect one `POST /auth/refresh/` and the page to stay mounted (no "Loading..." overlay, open dialogs kept).
14. **Backend down at boot.** Stop the backend, reload the app, and wait for the error. The tokens must remain in localStorage, and you should see a retry screen, not the login page (AUTH-BUG-01). Start the backend and retry.
15. **Shared device.** Sign out as A and sign in as B in the same tab. The bell must not show A's notifications, and no "Rejoin Battle" for A's battle (AUTH-BUG-03).
16. **Dice memory.** Open the top-bar Dice Roller, roll, close, and repeat 20 times. Watch Chrome Task Manager (Shift+Esc) for the tab's memory and DevTools → Sources → Threads for the worker count. After FE-PERF-07 the worker count stays at 1; today it grows by one per open.
17. **404 and deep links.** Visit `/campaigns/1/nope`: a not-found page should render, not a redirect to login. Log out, open a copied battle URL, and log in: you should land on that battle (FE-UX-03).
18. **Error boundary.** In a dev build, temporarily throw in a page component (or use React DevTools to break props). The route error screen must render with Retry, not a blank page (FE-UX-01).
19. **Keyboard.** Using only Tab, Arrow keys, Enter and Escape: open the dice roller and roll, open notifications and accept an item, add a skill through a searchable dropdown in a hero form. All must be possible, with a visible focus ring (FE-UX-05).
20. **Production smoke (Vercel).** On the deployed site, confirm in Network that API calls go to the same origin (after the AUTH-PERF-03 rewrite) with no `OPTIONS` preflights, the `Content-Security-Policy` header is present (FE-SEC-01), and there are no requests to `mordheimer.net`, `lottie.host`, `jsdelivr` or `unpkg`.
