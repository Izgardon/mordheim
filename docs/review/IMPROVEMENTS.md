# Improvement Backlog (Code Quality & UX)

> Built from docs/review/features/*.md on 2026-10-16.

Every Code quality (`CQ`) and UI/UX (`UX`) finding in the eight feature files is mapped to one canonical `IMP-NN` item here (see the [source index](#source-index) at the end). Performance, bugs and security live in `PERFORMANCE.md` and `BUGS.md`; they appear here only as cross-references. Severity is the highest severity among an item's sources unless the entry says otherwise. Effort uses the README scale (S < 2 h, M half to one day, L multi-day). Plan phases follow [PLAN.md](PLAN.md): Phase 0 foundations, then passes 1 (roster) to 6 (auth and core). The feature files stay the source of truth for file/line detail.

## Summary

**1. Copy-paste is the extension mechanism.** Heroes, henchmen and hired swords are implemented three times: about **5,200 of 12,400 lines** across their views, serializers, sections, cards, forms, hooks and dialogs are near-copies (ROST-CQ-01; list blocks and level-up dialogs are 98% identical). The copies have already drifted into bugs: half-rate missing only on henchmen, level-up suppression only on heroes, advance validation only on henchmen, atomic create only on heroes, a hero cap that counts the dead. The same habit shows up across the app: skills, spells and special views are byte-for-byte clones and the campaign-override merge block exists 8 times (CAT-CQ-01), every catalogue entity has two forms totalling ~3,800 lines where ~1,500 would do (CAT-CQ-02), stash mutation exists 4 times with different locking (ECON-CQ-04), Pusher factories 5 times (FE-CQ-03), and catalogue hooks and store slices 4 to 6 times (FE-CQ-04). Fixed by IMP-24/26/27, IMP-79/80, IMP-41, IMP-14 and IMP-08.

**2. Giant files with mixed concerns.** 8 backend files exceed the 400-line limit and about 38 frontend files exceed 250 lines. `battles/views/shared.py` is 1,968 lines holding seven concerns, including a 286-line function; `campaigns/views.py` is 1,277; the three battle phase routes are 1,173 to 1,799 lines with 50+ `useState` each; `Warband.tsx` (1,070) drills ~87 props into `WarbandTabContent`. Private helpers leak across apps (CAMP-CQ-08). These are also the hottest, least-tested files, so every split follows the "lock behaviour" step of the pass loop. See [Oversized files](#oversized-files).

**3. No server-state layer.** 266 `useEffect`s, 65 feature files fetching inside effects, 16 different cancellation flags, six cloned cache slices inside one 49-field context that re-renders 44 consumers, and a `window` `CustomEvent` bus between components (FE-CQ-04, CAT-CQ-03, CAMP-CQ-05). This is the code-quality face of the frontend performance problem (FE-PERF-01, CAMP-PERF-01/02, CAT-PERF-01). TanStack Query is decided (PLAN 0.5): IMP-08, IMP-09, IMP-14.

**4. Permissions and capabilities drift between UI and API.** The same load/membership/role/permission preamble is hand-written in 43 warband handlers, 31 campaign views, ~20 battle views, 7 trade blocks and 12 catalogue methods (ROST-CQ-02, CAMP-CQ-01, BATL-CQ-05, ECON-CQ-03, CAT-CQ-01). Roles and permission codes are defined in three places that already disagree (CAMP-CQ-03). No response carries capability flags, so the UI offers actions the server rejects (BUGS: ROST-BUG-07, ECON-BUG-17, CAMP-BUG-02/04, CAT-BUG-04; UX: ROST-UX-06). IMP-25 sets one pattern; IMP-28, 40, 53, 63, 64 and 79 apply it.

**5. Errors are swallowed or shown raw.** There are no error boundaries (a render exception blanks the app mid-battle), no toast system, 35 empty `catch` blocks, 152 copies of the same `instanceof Error` block, and `ApiError.status` is never read (FE-UX-01, FE-CQ-04, FE-CQ-07). Users see "Failed to fetch" or "Expected available in 3540 seconds" (AUTH-UX-01), and empty states lie when a load fails (CAT-UX-04, ECON-UX-05). IMP-10, IMP-11 and IMP-12, then per-pass sweeps (IMP-49, IMP-89).

**6. Tooling isn't enforced.** Baseline (NOTES): ruff 34 errors, 54 unformatted files, mypy 51 errors, tsc 98 errors (several are real defects), 3 failing frontend tests, 12 test files duplicated, one backend test that sends real email through Resend, no ESLint or Prettier config, no CI, and a `vite build` that never typechecks. IMP-01 to IMP-05 and IMP-21.

**7. Business rules live in the browser as well as the server.** Gold is derived from four copies of action-name lists with two sign conventions (ECON-CQ-01); the browser orchestrates purchases and writes ledger and log rows (ECON-CQ-02, ECON-CQ-05); ten battle rules exist on both sides and have diverged (BATL-CQ-03); house-rule effect keys and common-rule text exist only in the frontend (CAMP-CQ-09); the frontend has its own permission seed (CAMP-CQ-03). This breaks principle 0.1 ("the server is the source of truth"). IMP-38, 39, 42, 52, 64 and 69.

## Rule violations scorecard

Rule sections are from [../ENGINEERING_RULES.md](../ENGINEERING_RULES.md). Ratings: **Severe** (systemic, blocks the rule), **High** (widespread), **Moderate** (localised).

| Rule section | Violation today | Worst examples | Fixed by |
| --- | --- | --- | --- |
| §0 Server is the source of truth | Severe | Gold derived from 4 copied action lists, 2 sign conventions (ECON-CQ-01); browser writes buy/rarity logs and orchestrates purchases (ECON-CQ-02/05); 10 battle-rule pairs, drifted (BATL-CQ-03); house-rule keys frontend-only (CAMP-CQ-09) | IMP-38, 39, 42, 52, 64, 69 |
| §1 Structure: thin views, services, size limits | Severe | `shared.py` 1,968 (7 concerns, 286-line function); `campaigns/views.py` 1,277 (payload builders beside views); `trades/views.py` 730; `lifecycle.py` 1,033 | IMP-50, 63, 40, 53 |
| §1 Shared unit behaviour written once | Severe | ~5,200 of 12,400 lines near-duplicate; `views/heroes.py` vs `hired_swords.py` 0.87 similar; 5 drift bugs (ROST-CQ-01) | IMP-24, 26, 27 |
| §1 Queries and performance | Severe (tracked in PERFORMANCE.md) | CQ side: `refresh_from_db` after every stash `save()` (ECON-CQ-04); five `_all_participants_*` helpers at 2 queries each (BATL-CQ-05); roles seeded lazily on the request path, 8 to 11 queries (CAMP-CQ-03) | IMP-41, 53, 64 |
| §1 Writes, money and concurrency | High (bugs in BUGS.md) | No gold row to lock (ECON-CQ-01); 4 stash helpers, only the battle copy locks (ECON-CQ-04); henchmen and hired-sword POST/PATCH not atomic (ROST-CQ-06); only `seed_bestiary` uses a transaction (CAT-CQ-04) | IMP-38, 41, 26, 81 |
| §1 Permissions | High | 43 + 31 + ~20 + 7 + 12 hand-written preambles; roles/permissions in 3 drifted places (CAMP-CQ-03); no capability flags | IMP-25, 28, 40, 53, 63, 64, 79 |
| §1 External services | Moderate (dispatch is a perf item) | Resend client copied twice (AUTH-CQ-02); 5 copy-pasted realtime factories (FE-CQ-03) | IMP-93, 14 |
| §1 Errors, typing, settings | High | 3 error shapes on auth endpoints, 50 bare `Not found` responses in `campaigns/views.py`; ruff 34, format 54 files, mypy 51 (`object`-typed model lookups in `warbands.py:94-133`); no `LOGGING`; no dev/prod settings split; trade offers parsed as untyped JSON (ECON-CQ-09); free-text house-rule keys | IMP-02, 10, 06, 07, 40, 69, 85 |
| §2 Structure: routes/components ≤ 250, `unitKind` | Severe | ~38 frontend files over 250; `BattlePostbattle.tsx` 1,799; `WarbandTabContent` ~87 props; triplicated sections and cards | IMP-27, 29, 51, 13 and [Oversized files](#oversized-files) |
| §2 Data and state | Severe | 266 effects, 16 cancellation flags; 49-field mega-context; 6 cloned cache slices; window event bus; 5 Pusher clients | IMP-08, 09, 14, 66 |
| §2 Behaviour and UX | High | 35 empty catches, no toasts or boundaries; raw backend strings; unconfirmed destructive actions (resource delete, notification Clear, Cancel with pending purchases); "Dismiss cannot be undone" is false; 28 to 32 px battle buttons | IMP-10, 11, 31, 47, 57, 61, 78 |
| §2 Accessibility | High | Comboboxes unusable by keyboard, so keyboard users cannot create units (ROST-UX-02); hover-only expand/XP controls; nested interactive elements; unlabelled inputs; error text ~4.1:1 contrast | IMP-18, 30, 32, 76; [checklist](#accessibility--mobile-checklist) |
| §2 Types and lint | Severe | tsc 98 errors (79 in app code); 30 `any`, 13 of them `as any` on payloads; phantom type imports become `any`; no ESLint; ~20 unused exports; unused `react-icons` | IMP-01, 03, 20, 21, 37, 54 |
| §3 Testing | High (coverage gaps in TEST_PLAN.md) | 12 duplicated test files (1,742 lines run twice); 3 failing tests; a test that emails through Resend; tests split between beside-the-code and `__tests__/` | IMP-04, 05, 03 |
| §4 Definition of done | Severe | No CI, no `lint`/`typecheck` scripts, no pre-commit, so no PR can prove it is green | IMP-03 |

## Oversized files

Limits: backend files ≤ 400 lines and functions ≤ 60 (§1); frontend routes and components ≤ 250 (§2). Sizes are from the feature files and NOTES.md. Where a split was not proposed in the feature files, the entry says so.

| File | Lines | Proposed split | IMP | Phase |
| --- | --- | --- | --- | --- |
| `backend/apps/battles/views/shared.py` | 1,968 | `battles/serializers.py`; `services/{rosters,realtime,lifecycle,postbattle}.py`; `validation/{unit_information,custom_units,postbattle}.py` (DRF serializers replace normalisers); `battles/permissions.py` (`get_battle_for_user`) | IMP-50 | Pass 3 |
| ↳ `_apply_participant_postbattle_results` | 286 (function) | `apply_unit_results`, `apply_exploration`, `apply_upkeep`, `apply_finds`, `consume_single_use_items`, `write_battle_logs` | IMP-50 | Pass 3 |
| `backend/apps/campaigns/views.py` | 1,277 | `views/{campaigns,overview,members,content,realtime}.py`, `selectors.py`, `services/membership.py`, `constants.py`; `CampaignMemberView` base | IMP-63, 64 | Pass 4 |
| `backend/apps/battles/views/lifecycle.py` | 1,033 | No split proposed; shrinks via `BattleActionView`, shared participant validation, winner parsing and notification helpers, and deleting the unrouted `PendingReportedBattleResultRequestsView` | IMP-53, 55 | Pass 3 |
| `backend/apps/trades/views.py` | 730 | `trades/selectors.py` (`get_trade_for_participant`), `services.py` (`transition()`), `serializers.py` (`TradeOfferSerializer`); views ~150 | IMP-40 | Pass 2 |
| `backend/apps/warbands/views/warbands.py` | 723 | No split proposed; shrinks via `services/stash.py`, `WarbandScopedView`, the `UnitKind` registry, a server purchase endpoint and dead restrictions code | IMP-41, 28, 26, 42, 36 | Passes 1–2 |
| `warbands/serializers/heroes.py` / `hired_swords.py` (henchmen 398) | 552 / 430 | `LoadoutWriteMixin`, `XpLevelMixin` (one `apply_xp_change`) | IMP-26 | Pass 1 |
| `warbands/views/heroes.py` (henchmen 379, hired swords 389) | 423 | Generic `UnitListCreateView`, `UnitDetailView`, `UnitLevelUpView`, `UnitKillHistoryView` | IMP-26 | Pass 1 |
| `battles/routes/BattlePostbattle.tsx` | 1,799 | `hooks/{usePostbattleDraft,useExploration,useFindItemSearch,useSectionScrollSpy}.ts`; `postbattle/{ExplorationSection,RosterResultsSection,UnitResultRow,FindsSection,UpkeepSection,FinalizeSummaryDialog,LeaveBattleDialog,SeriousInjuryRollDialog,PostbattleStepperInput}.tsx`; `utils/dice-results.ts` | IMP-51 | Pass 3 |
| `battles/routes/BattleActive.tsx` | 1,182 | `hooks/{useActiveBattleActions,useBattleHelperOptions,useSerializedSave}.ts`; `active/FinishBattleDialog.tsx`; `shared/{CancelBattleDialog,BattleFloatingActionBar}.tsx` | IMP-51 | Pass 3 |
| `battles/routes/BattlePrebattle.tsx` | 1,173 | `hooks/{usePrebattleConfig,usePrebattleActions,useUnreadyOnExit}.ts`; shared `useParticipantSelection`, `useUsedSingleUseItems`, `useCustomUnitDraft`, `useCreatorCancel`; data in `BattleLayout` + `BattleContext`; `state/battle-machine.ts` | IMP-51 | Pass 3 |
| `warbands/routes/Warband.tsx` | 1,070 | Hero editing into `WarbandHeroesSection` / `useUnitSectionEditor`; `WarbandDesktopHeader`; `useWarbandPagePermissions`; `CatalogContext` (ROST-CQ-03 targets < 300; the rule says 250) | IMP-29 | Pass 1 |
| `items/hooks/useAcquireItemDialogShared.tsx` | 964 | `useAcquireTargets`, `useSpendableGold`, `useRarityRoll`, `useAcquireForm`, one `purchaseItem()` call | IMP-42 | Pass 2 |
| `items/routes/Items.tsx` | 908 | `items-columns.tsx` (`buildItemColumns`), `useItemsFilters.ts`, `utils/statblock.tsx`, ~200-line route | IMP-82 | Pass 5 |
| `items/components/ItemFormDialog.tsx` / `AddItemForm.tsx` | 887 / 782 | `useItemForm` + `<ItemFormFields>` (inline or in a dialog); `features/items/utils/statblock.ts` | IMP-80 | Pass 5 |
| `battles/components/postbattle/postbattle-utils.ts` | 852 | Rules move server-side (IMP-52); dead roll helpers deleted (IMP-55); dice maths to `utils/dice-results.ts` | IMP-52, 55, 51 | Pass 3 |
| `warbands/components/henchmen/forms/HenchmenFormCard.tsx` | 793 | Wrapper over `UnitBasicInfo`/`UnitLoadout variant="henchmen"` plus the member list | IMP-30 | Pass 1 |
| `campaigns/routes/CampaignLayout.tsx` | 724 | `useCampaign`, `useOwnWarband`, `useCurrentBattle`, `useCampaignMobileTopBar`, `CampaignShell` (`CampaignMobileShell`/`CampaignDesktopShell`), `CampaignTopBarActions`, `RejoinBattleButton`, `getCampaignNavItems` | IMP-13 | Phase 0 |
| `WarbandHiredSwordsSection` / `WarbandHenchmenSection` / `WarbandHeroesSection` | 675 / 656 / 435 | `<UnitSection>` + `useUnitSectionEditor(kind)` | IMP-27 | Pass 1 |
| Hero / hired-sword / henchmen `*ExpandedCard` | 554 / 481 / 417 | `<UnitExpandedCard>` with member-list and LGT slots | IMP-27 | Pass 1 |
| `stores/app-store.tsx` | 532 | Disappears into TanStack Query plus a ≤ 100-line Zustand session store | IMP-09 | Phase 0 → end of passes |
| `components/dice/DiceRoller.tsx` | 490 | `DiceProvider`, `DiceRollButton`, `CustomDicePicker`, `dice-utils.ts` | IMP-15 | Phase 0 |
| `AddHiredSwordForm.tsx` (`AddHeroForm.tsx` 257) | 462 | One `RacePicker`; add forms driven by `unitKinds` | IMP-30, 27 | Pass 1 |
| `skills/.../SkillFormDialog.tsx` / `AddSkillForm.tsx` | 449 / 349 | `useSkillForm` + `<SkillFormFields>`; generic `CatalogueTable<T>` | IMP-80 | Pass 5 |
| `realtime/hooks/useNotifications.ts` | 449 | `notification-mappers.ts`, `useNotificationList`, `useNotificationSubscription`, `useNotificationActions` | IMP-15 | Phase 0 |
| `useWarbandHenchmenSave.ts` (hero 244, hired sword 237) | 422 | `useUnitSectionEditor(kind)` | IMP-27 | Pass 1 |
| `spells/.../AddSpellForm.tsx` / `CreateSpellDialog.tsx` | 414 / 371 | `useSpellForm` + `<SpellFormFields>` | IMP-80 | Pass 5 |
| `components/ui/tooltip.tsx` | 394 | No split proposed (listed over-limit in FE-CQ-05) | IMP-15 | Phase 0 |
| `warband/resources/WarbandResourceBar.tsx` | ≥ 350 | One `ResourceRow` instead of two duplicated variants | IMP-43 | Pass 2 |
| `campaigns/routes/Locations.tsx` / `Encampments.tsx` | 339 / 314 | Shared `CampaignRecordsPage` scaffold | IMP-66 | Pass 4 |
| `useHenchmenLevelUp.ts` (hero 196, hired sword 189) | 332 | One `useUnitLevelUp` via `unitKinds` | IMP-27 | Pass 1 |
| `auth/components/AuthCard.tsx` | 308 | `LoginForm`, `RegisterForm`, `ForgotForm`, `AuthField`, `PasswordInput` | IMP-94 | Pass 6 |
| `special/.../CreateSpecialDialog.tsx` / `AddSpecialForm.tsx` | 306 / 259 | `useSpecialForm` + `<SpecialFormFields>` | IMP-80 | Pass 5 |
| `HeroListBlocks` / `HenchmenListBlocks` / `HiredSwordListBlocks` | 261 each | `<UnitListBlocks>` | IMP-27 | Pass 1 |

## Cross-cutting improvements (Phase 0)

### Get green and keep it green (PLAN 0.2–0.3)

#### IMP-01 · P1 · Get `tsc --noEmit` to zero, real defects first
- **Sources:** FE-CQ-01 (fix step), NOTES baseline · **Kind:** CQ
- **Problem:** 98 errors, 79 in app code. Several are live defects: phantom type imports (`henchmen-level.ts:1`, `unit-stats-mapper.ts:1`) turn `LevelInfo` and `UnitStats` into `any`; all three save hooks pass 4 arguments to a 3-argument function (`useWarbandSave.ts:187` and siblings); `useUnitItemMenu.ts:110` reads a nonexistent `rarity`; undeclared props at `Warband.tsx:983` and `WarbandTabContent.tsx:116,150`; possibly-null dice maths in `postbattle-utils.ts:366-385`.
- **Change:** Fix TS2307, TS2554 and TS2339 first, each warband fix with a regression test (they sit on the roster save path); then the mismatches; then the 18 unused locals. Behaviour fixes and type-only fixes in separate commits.
- **Effort:** M · **Plan phase:** 0.2

#### IMP-02 · P1 · Backend `ruff`, `ruff format` and `mypy` to zero
- **Sources:** NOTES baseline (no feature-file ID) · **Kind:** CQ
- **Problem:** ruff 34 errors (31 auto-fixable), 54 unformatted files, mypy 51 errors in 15 files, including `object`-typed models in `warbands/views/warbands.py:94-133`, `Decimal | int` XP returned as `int` (`henchmen.py:36`) and a possible `int(None)` (`kill_history.py:28,45`). The backend CLAUDE.md requires all three before every commit.
- **Change:** One format-only commit, one auto-fix commit, then mypy. The XP truncation and `int(None)` paths get tests because fixing them may change behaviour.
- **Effort:** S–M · **Plan phase:** 0.2

#### IMP-03 · P1 · Enforce green: scripts, ESLint, Prettier and CI
- **Sources:** FE-CQ-01 (steps 2–5), FE-CQ-06 (`knip`), FE-CQ-02 (`.gitattributes`); cross-ref INFRA-SEC-01 (`check --deploy` in CI) · **Kind:** CQ
- **Problem:** No `typecheck` or `lint` scripts, `vite build` skips typechecking, no ESLint or Prettier config, no `.github/`, no pre-commit. `strict: true` is decorative.
- **Change:** Scripts `typecheck`, `lint` and `build = tsc --noEmit && vite build`. Flat ESLint: `typescript-eslint` recommended-type-checked, `react-hooks` (it would have flagged FE-PERF-05's deps, ROST-PERF-07 and CAMP-CQ-04), `no-floating-promises`, `jsx-a11y`. Prettier matching the majority style (semicolons, double quotes). GitHub Actions: backend tests, ruff, format check, mypy; frontend tsc, lint, vitest, build, the FE-PERF-03 size budget and `knip`; `manage.py check --deploy` with production-like env. `.gitattributes` `eol=lf`. Pre-commit optional.
- **Effort:** S–M · **Plan phase:** 0.3

#### IMP-04 · P2 · One copy of every test; the 3 failing tests fixed
- **Sources:** FE-CQ-02, BATL-CQ-07, ECON-CQ-08, ROST-CQ-05 (test pairs), CAT-CQ-07 (test pairs), NOTES baseline · **Kind:** CQ
- **Problem:** 12 test files exist twice (1,742 lines; 53 files, 41 unique), differing only in import path and CRLF/LF. The 3 failures are drift: the `MobileLayout` pull-to-refresh threshold, and one `RaritySection` test that fails in both copies because "Spent Hero" and " (spent)" are now separate text nodes.
- **Change:** Keep one copy per pair. The sources disagree on which (BATL-CQ-07 and ECON-CQ-08 keep `__tests__/`, FE-CQ-02 keeps the co-located copy); ENGINEERING_RULES §3 says next to the code, so keep the co-located copy and move the 16 unique `__tests__` files beside their units. Fix the two drifted assertions.
- **Effort:** S · **Plan phase:** 0.2

#### IMP-05 · P2 · Backend tests never call Resend or Pusher
- **Sources:** AUTH-CQ-01 · **Kind:** CQ
- **Problem:** `test_password_reset_request_is_rate_limited_by_ip` makes a real `POST https://api.resend.com/emails`, because the container loads `backend/.env`. Pusher keys likely leak into other tests the same way.
- **Change:** `config/settings_test.py` or a base `TestCase` with `override_settings(RESEND_API_KEY="", PUSHER_APP_ID="")`; patch `send_password_reset_email` in that test. Must land before CI runs tests on every push.
- **Effort:** S · **Plan phase:** 0.2

### Production hygiene (PLAN 0.1)

#### IMP-06 · P2 · Production logging and a slow-request log
- **Sources:** INFRA-CQ-01 · **Kind:** CQ
- **Problem:** No `LOGGING`: with `DEBUG` off, 500 tracebacks never reach Render's logs, app `logger.info` calls are dropped, and nothing records request durations.
- **Change:** stdout `LOGGING` dict (`django.request` at WARNING), gunicorn access log with `%(M)sms`, and an optional middleware logging path, status, ms and query count for requests over 500 ms. Needed to measure the 0.1 quick wins.
- **Effort:** S · **Plan phase:** 0.1

#### IMP-07 · P2 · Dockerfile and settings hygiene
- **Sources:** INFRA-CQ-02, INFRA-CQ-03 · **Kind:** CQ
- **Problem:** `uv sync` runs without `--frozen` (so `uv.lock` is ignored), `uv:latest` is unpinned, the container runs as root with no `HEALTHCHECK` and a hard-coded port, and migrations run in the entrypoint. Settings parse `DEBUG` differently from other flags, load unused session/CSRF/messages middleware, serve the browsable API in production, and have no dev/prod split.
- **Change:** Pin uv, copy `uv.lock`, `--frozen`, non-root user, bind `${PORT:-8000}`; `_env_bool` everywhere; JSON renderer only unless `DEBUG`; drop unused middleware and apps after checking the tests; a production startup assertion block (INFRA-SEC-01).
- **Effort:** S · **Plan phase:** 0.1

### Server state and the frontend platform (PLAN 0.5)

#### IMP-08 · P1 · TanStack Query foundation, then one resource at a time
- **Sources:** FE-CQ-04, CAT-CQ-03, CAMP-CQ-05 (fetch scaffolding), FE "Target architecture"; fixes FE-PERF-01, CAMP-PERF-01/02, CAT-PERF-01. Raised to P1 from P2 sources because it is the fix for those P0/P1 performance findings. · **Kind:** CQ
- **Problem:** 266 effects; 65 files fetch in effects; six copies of a 20-line load block in `useCampaignOverview.ts:94-224`; four 60-line clone hooks `useCampaign{Items,Skills,Spells,Special}` (the generic `useCampaignData.ts` is unused); six cloned cache slices in `app-store.tsx` with inconsistent `loaded` semantics. No caching or dedupe.
- **Change:** `QueryClientProvider` in `app/provider.tsx`; `lib/query-client.ts` (`staleTime` 30 s, `retry: 1` on 5xx/network only); `queryKeys.ts` (`['campaign', id]`, `['battles', id]`, `['catalogue', kind, id]`, `['warband', id]`, `['permissions', id]`, `['notifications']`) with per-class `staleTime`. Phase 0 migrates catalogues (deleting the six slices and four clones), permissions, and the battle list / current battle. The rest migrates in its pass: warband (Pass 1), overview tabs (Pass 4), notifications (IMP-15). Mutations patch with `setQueryData` from the response instead of `emitWarbandUpdate` plus a summary refetch.
- **Effort:** M (foundation), then per pass · **Plan phase:** 0.5

#### IMP-09 · P2 · Replace the mega-store with a small session store
- **Sources:** FE-CQ-05 (`app-store.tsx`), FE-CQ-04 (six set/upsert/remove copies), CAT-CQ-03; cross-ref FE-PERF-04, AUTH-BUG-03 · **Kind:** CQ
- **Problem:** One 49-field context with no selectors; any write re-renders every consumer.
- **Change:** Delete each slice as its query lands. Move what remains (`currentBattleSession`, `tradeSession`, dice colour, UI prefs) into a ≤ 100-line Zustand store with selectors; auth moves to its own module (IMP-92). Then delete `app-store.tsx`.
- **Effort:** M · **Plan phase:** 0.5 start; finished once Pass 1 removes the warband mirror

#### IMP-10 · P2 · One error vocabulary: `getErrorMessage(ApiError)` and one backend error shape
- **Sources:** AUTH-UX-01, FE-CQ-04 (152 copies), FE-CQ-07 (`ApiError.status` unused), BATL-CQ-02 (`lib/get-error-message.ts`), CAMP-CQ-05 (> 20 copies), ROST-UX-05 (field names) · **Kind:** CQ / UX
- **Problem:** Users see "Request was throttled. Expected available in 3540 seconds.", "Failed to fetch" and "Given token not valid for any token type". `api-client.ts:116-138` shows only the first error value, without its field. Auth endpoints use three error shapes. 403, 404, 409 and 5xx look identical.
- **Change:** `getErrorMessage(error, fallback)` in `lib/`: 429 → "Too many attempts. Try again in N minutes." (from `Retry-After`); fetch `TypeError` → "Can't reach the server. It may be waking up"; 5xx → generic; 403 → friendly; field errors joined per field. Codemod the 152 sites. Backend moves to `{"detail", "code", "fields"}`, auth first, then each pass.
- **Effort:** S (helper) + M (codemod and shape) · **Plan phase:** 0.2–0.5; backend shape per pass

#### IMP-11 · P2 · Error boundaries, toasts and shared Error/Empty states
- **Sources:** FE-UX-01; enables IMP-49 (ECON-UX-05) and IMP-89 (CAT-UX-04); cross-ref FE-BUG-03 · **Kind:** UX
- **Problem:** No `ErrorBoundary` or `errorElement` anywhere, so a render exception blanks the app mid-battle. No toast library, 35 empty `catch` blocks, every page invents its own error text, and `text-red-600` on the near-black background is ~4.1:1 (below AA).
- **Change:** `errorElement: <RouteError/>` on the root and campaign routes (Retry, Back to campaign, report link to the feedback endpoint); a top-level `ErrorBoundary`; `sonner` for mutation results; `<ErrorState onRetry/>` and `<EmptyState/>`; an error-colour token at ≥ 4.5:1.
- **Effort:** M · **Plan phase:** 0.5

#### IMP-12 · P2 · Loading without blackouts
- **Sources:** FE-UX-02, AUTH-UX-03 · **Kind:** UX
- **Problem:** Every campaign and battle entry hides the UI behind a black overlay with a CDN-loaded Lottie ("Preparing the campaign..." until 5 catalogues load); a slow login just says "Working...". Users reload, which restarts the waterfall.
- **Change:** Render the shell immediately with skeletons (they exist but are used in only 4 and 8 files); keep the full-screen loader for the first `/auth/me`; CSS spinner; after 3 s show "The server is waking up. This can take up to a minute."; optional `HEAD /keep-awake/` on Landing mount (AUTH-UX-03 is Speculative: NOTES says the Starter plan never spins down).
- **Effort:** M · **Plan phase:** 0.5, with the catalogue-gate removal

#### IMP-13 · P2 · Split the campaign shell (`CampaignLayout.tsx`, 724 lines, 7 jobs)
- **Sources:** CAMP-CQ-02, FE-CQ-05 · **Kind:** CQ
- **Problem:** Campaign load, ~110 lines of catalogue pass-through, own-warband load, battle-session tracking duplicated with `BattleActionPanel.tsx:58-102` (the root of CAMP-PERF-01), mobile top bar, two shells and nav config in one file; unused `settingsButton`; `NotificationsMenu` props duplicated (208-235 vs 705-716); Rejoin styles copied.
- **Change:** As in the [Oversized files](#oversized-files) row. `useCurrentBattle` is shared with `BattleActionPanel`; the stable `CampaignShell` and `useMobileTopBarOverride` also fix FE-BUG-01/02. Refactor-only PR.
- **Effort:** M · **Plan phase:** 0.5 (catalogue gate, `useCampaign`, `useCurrentBattle`); the rest may finish in Pass 4

#### IMP-14 · P2 · One realtime client with typed subscriptions
- **Sources:** FE-CQ-03 (factories, env config); cross-ref FE-PERF-05, FE-PERF-06, FE-BUG-04, AUTH-BUG-08 · **Kind:** CQ
- **Problem:** Five copy-pasted Pusher factories in `lib/realtime.ts:96-301` (~200 lines of boilerplate); `PUSHER_*` read outside `config/env.ts`. Every fix has to be made five times.
- **Change:** `subscribe(channel, event, handler)` on one shared client, typed wrappers (`subscribeUserNotifications`, ...), ref-counted `useChannel`; handlers write the query cache (IMP-08) and the `window` `CustomEvent` bus goes; all `import.meta.env` reads move to `config/env.ts` with validation. The unused ping factory is deleted in IMP-68.
- **Effort:** S · **Plan phase:** Phase 0 after 0.5; trades and battles adopt it in Passes 2–3

#### IMP-15 · P2 · Split the notifications, dice and tooltip platform files
- **Sources:** FE-CQ-05, FE-CQ-03 (`parseDiceValues`) · **Kind:** CQ
- **Problem:** `useNotifications.ts` (449), `DiceRoller.tsx` (490) and `tooltip.tsx` (394) exceed 250 lines; `parseDiceValues` is duplicated verbatim in `DiceRoller.tsx:85-122` and `CampaignDiceRollerMenu.tsx:27-64`.
- **Change:** Notifications into pure `notification-mappers.ts` plus list, subscription and action hooks; dice into `DiceProvider` (singleton engine, FE-PERF-07), `DiceRollButton`, `CustomDicePicker` and `dice-utils.ts`. No split was proposed for `tooltip.tsx`; revisit with IMP-18.
- **Effort:** M · **Plan phase:** Phase 0

#### IMP-16 · P2 · Realtime events offer navigation instead of forcing it
- **Sources:** FE-UX-04 · **Kind:** UX
- **Problem:** `trade_accepted` and `battle_prebattle_opened` call `navigate()` at once (`useNotifications.ts:226-227,314`), even into another campaign, discarding unsaved edits. `useBlocker` is unused.
- **Change:** An actionable toast or banner ("Prebattle for Battle #41 is open. Go now"); auto-navigate only when idle on Overview; `useBlocker` on dirty forms (warband edit state, postbattle draft).
- **Effort:** S · **Plan phase:** Phase 0, with IMP-11 and IMP-15

### Navigation, accessibility and layout

#### IMP-17 · P2 · Real 404s; deep links and expired sessions return you where you were
- **Sources:** FE-UX-03, AUTH-UX-02 · **Kind:** UX
- **Problem:** `*` redirects to `/` (the `NotFound` page is unused); `ProtectedRoute` drops `state.from`; `AuthCard` always goes to `/campaigns`; session expiry is silent; `/campaigns/:id/warbands` is a reachable "Coming soon" placeholder.
- **Change:** `*` → `NotFound` plus a campaign-scoped `*`; `<Navigate to="/" replace state={{ from: location, reason: "expired" }} />` with a "Your session expired" notice and a return to `state.from` after login; remove or hide the placeholder. Refresh rotation (AUTH-SEC-04) removes the hard 30-day wall.
- **Effort:** S · **Plan phase:** Phase 0

#### IMP-18 · P2 · Accessible shared primitives
- **Sources:** FE-UX-05, ROST-UX-02 (component) · **Kind:** UX
- **Problem:** `SearchableDropdown` and four inline race-picker copies close 120 ms after input blur and have no arrow keys or combobox ARIA, so keyboard and switch users can't create a hero, group or hired sword (race is required) or add skills and items. `TabSwitcher` has no tab semantics. `Dialog` has no visible close button and on mobile leaves focus behind the sheet. `Checkbox` focus is invisible. 152 uses of 8 to 11 px text.
- **Change:** One `Combobox` on Radix/shadcn `Command` + `Popover` (arrow keys, Enter, Escape, close on outside pointer, focus stays in the input); `@radix-ui/react-tabs` for `TabSwitcher` and `MobileTabs`; `DialogClose` "X" with `aria-label="Close"` and title focus on mobile; `peer-focus-visible:ring-2` on the checkbox box; minimum 0.7rem running text. Adopted in IMP-30 and the catalogue forms (IMP-80).
- **Effort:** M · **Plan phase:** Phase 0 (components), applied per pass

#### IMP-19 · P3 · One mobile breakpoint, and a decision on safe-area insets
- **Sources:** FE-UX-06 · **Kind:** UX
- **Problem:** `(max-width: 960px)` hard-coded 34 times, CSS at 960/959/640, Tailwind `sm`/`md`/`lg` mixed in, so 768 to 960 px tablets get the mobile shell with desktop styles. Without `viewport-fit=cover` every `env(safe-area-inset-*)` is dead code.
- **Change:** `MOBILE_BREAKPOINT = 960` with `useIsMobile()`; a Tailwind `shell: "960px"` screen; replace the 959 rule; decide `viewport-fit=cover` and test on a notched iPhone in Safari and as a home-screen PWA.
- **Effort:** S · **Plan phase:** Phase 0

#### IMP-20 · P3 · Decide how API types are produced; stop casting payloads
- **Sources:** FE-CQ-07; applied in IMP-37 (ROST-CQ-07) and IMP-54 (BATL-CQ-06) · **Kind:** CQ
- **Problem:** 30 `any` in app code (13 `as any` on mutation payloads), 14 `Record<string, any>` log payloads, `dice-box.d.ts` all `any`; view-shaped backend payloads have no schema, so contract drift is invisible until runtime.
- **Change:** Decide on `drf-spectacular` + `openapi-typescript` (proposed by FE-CQ-07, ROST-CQ-07 and BATL-CQ-06) or hand-completed payload types; log payloads as a union on `entry_type`; a minimal `dice-box.d.ts`.
- **Effort:** M · **Plan phase:** Phase 0 (decision); types per pass

#### IMP-21 · P3 · Delete platform dead code and the unused dependency
- **Sources:** FE-CQ-06 · **Kind:** CQ
- **Problem:** Unused files (`meta-row.tsx`, `hero-card-skeleton.tsx`, `filter-search-action-header.tsx`, `types/ui.ts`, `useCampaignData.ts`, `useSearchableList.ts`, an empty test folder), ~20 unused exports, tsc-flagged unused locals, and `react-icons` imported nowhere.
- **Change:** Delete them (`NotFound.tsx` is revived by IMP-17; feature-owned dead code is deleted in each pass); keep it clean with `knip` in CI.
- **Effort:** S · **Plan phase:** 0.2

#### IMP-22 · P3 · Frontend toolchain and dependency hygiene
- **Sources:** FE-CQ-08 · **Kind:** CQ
- **Problem:** Vite 5.1.4, TypeScript 5.3.3, RTL 14, a 10-month-old browserslist; the frontend Dockerfile uses `npm install`; no `build.target` or `manualChunks`.
- **Change:** `npm ci`; bump within majors first (Vite 5.4, TS 5.x, Radix, pusher-js 8.6, RTL 16); plan React Router 7 and React 19 later; update browserslist; drop `react-icons`.
- **Effort:** M · **Plan phase:** Phase 0, after IMP-01/03 so CI verifies the bumps

#### IMP-23 · P3 · Remove the global `submit` interceptor
- **Sources:** FE-CQ-09 · **Kind:** CQ
- **Problem:** `app/provider.tsx:9-21` calls `preventDefault()` on every form submit in the capture phase, so forms missing their own `preventDefault` work by accident.
- **Change:** Audit `<form onSubmit>` handlers, add `e.preventDefault()` where missing, delete the interceptor.
- **Effort:** S · **Plan phase:** Phase 0

### Shared designs (PLAN 0.6)

#### IMP-24 · P1 · Shared unit abstraction design (heroes, henchmen, hired swords)
- **Sources:** ROST-CQ-01 (design), ROST-CQ-06; touches CAMP-CQ-06 / CAT-CQ-05 (per-unit remap loops) and ECON-CQ-06 (three merge helpers) · **Kind:** CQ
- **Problem:** ~5,200 of 12,400 lines are near-copies, and drift has produced ROST-BUG-05, -09, -10, -13 and ROST-PERF-09. Siblings also disagree on atomicity, the `armour_save` type, id coercion and the "has detail" heuristic (ROST-CQ-06).
- **Change:** A design note agreed before Pass 1. Backend: abstract `RosterUnit(StatBlock)` (~15 common fields, tables unchanged); a `UnitKind` registry generalising `UNIT_TYPE_CONFIG` (`views/warbands.py:52-89`); generic list/detail/level-up/kill-history views with per-kind URLs (API unchanged); `LoadoutWriteMixin` and `XpLevelMixin` with one `apply_xp_change` shared with postbattle. Frontend: a `unitKinds` config (api, `mapToForm`, `validate`, `buildPayload`, `getLevelInfo`, labels, flags `hasMembers`/`hasSpells`/`hasTradeAction`) and `useUnitSectionEditor(kind)`. Order: level-up dialog and control, then cards, then sections, tests first.
- **Effort:** S (design) · **Plan phase:** 0.6; implemented in IMP-26 and IMP-27

#### IMP-25 · P2 · One scoped-view pattern for permissions, plus capability flags
- **Sources:** ROST-CQ-02, CAMP-CQ-01, BATL-CQ-05, ECON-CQ-03, CAT-CQ-01 (pattern only; each is implemented in its pass) · **Kind:** CQ
- **Problem:** Each area hand-writes the same preamble and each feature file proposes its own base class. A forgotten check on a new handler is a privilege bug, and without capability flags the UI keeps offering actions the server rejects.
- **Change:** Agree one shape: an `APIView` base whose `initial()` loads the scoped object once (per-view prefetch), caches `request.membership`, and checks declarative attributes (`required_role`, `required_permission`, `feature_flag`, allowed statuses, `lock`); responses carry `can_*` flags that the UI gates on (§1 Permissions). Subclasses: `WarbandScopedView` (IMP-28), `get_trade_for_participant` (IMP-40), `BattleActionView` (IMP-53), `CampaignMemberView` (IMP-63), `CampaignCatalogueDetailView` (IMP-79).
- **Effort:** S (design) · **Plan phase:** Phase 0 beside 0.6 (not yet a PLAN.md step; propose adding it)

## Per feature pass

### Pass 1 — Warband roster

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-26 | CQ | Backend: one `RosterUnit` implementation (`UnitKind` registry, generic views, `LoadoutWriteMixin`, `XpLevelMixin`) | ROST-CQ-01, ROST-CQ-06 | P1 | L |
| IMP-27 | CQ | Frontend: one unit UI from `unitKinds` (`UnitSection`, cards, list blocks, level-up control and dialog, `useUnitSectionEditor`) | ROST-CQ-01, ROST-CQ-06 | P1 | L |
| IMP-28 | CQ | `WarbandScopedView` replaces 43 hand-written permission preambles; delete `views/helpers.py` | ROST-CQ-02 | P2 | M |
| IMP-29 | CQ | Thin `Warband.tsx`: hero editing into its section, `WarbandDesktopHeader`, `useWarbandPagePermissions`, `CatalogContext` instead of 15 props | ROST-CQ-03 | P2 | M |
| IMP-30 | CQ/UX | `HenchmenFormCard` on `UnitBasicInfo`/`UnitLoadout variant="henchmen"`; one `RacePicker` on the IMP-18 combobox, labels with `htmlFor` | ROST-CQ-04, ROST-UX-02 | P2 | M |
| IMP-31 | UX | One edit model: Create, Dismiss and Cancel mean what they say | ROST-UX-01 | P2 | M |
| IMP-32 | UX | Expand and XP +/- reachable by keyboard and touch, with accessible names | ROST-UX-03 | P2 | S |
| IMP-33 | UX | Level-up dialog: labelled radio group, inline roll table, maxed stats disabled, next-step hint | ROST-UX-04 | P3 | S |
| IMP-34 | UX | Numeric stat inputs with inline errors; `Promise.allSettled` save with per-unit results | ROST-UX-05 | P3 | S |
| IMP-35 | UX | "Create hero" disabled at either limit; both limits enforced server-side | ROST-UX-06 | P3 | S |
| IMP-36 | CQ | Roster dead code: create-on-Save branches, `loadHeroDetail`, hidden `WarbandRatingDialog`, `Warband.restrictions`, no-op `PUT /restrictions/`, stub `dialogs/*.tsx` | ROST-CQ-05 | P3 | S |
| IMP-37 | CQ | `UnitSummary<K>` / `UnitDetail<K>` types that match the wire format | ROST-CQ-07 | P3 | S |

- **IMP-26 (P1):** Implements the IMP-24 backend design. Fold the ROST-CQ-06 inconsistencies (non-atomic henchmen/hired-sword writes, raw vs coerced member ids, placeholder lookup order) into the shared code instead of fixing each pair, which also clears the `object`-typed mypy errors. Lock tests first: there are no hero CRUD, level-up, leader, permission or query-count tests today.
- **IMP-27 (P1):** Start with `<UnitLevelUpDialog>` and `<UnitLevelUpControl>` (98% identical), then cards, then sections. The three `merge*` helpers, the `visuallyExpandedSlotId` timer and the `statusNode` list collapse with them. ROST-CQ-01 estimates 4,000 to 5,000 lines removed across IMP-26 and IMP-27.

**UX ideas worth raising with William during the brief**
- Recruit model (ROST-UX-01): **Option A** queue new units and create them on Save in one batched request (recommended), or **Option B** "Recruit now (−X gc)" with a toast and a "Refund X gc" on dismissing a unit recruited this session.
- Switching to Treasury, Backstory or Logs silently cancels edits: warn first, or keep the edit session alive?
- Show "Gold after pending" as a red negative instead of clamping at 0.
- Expose `level_up_history` as an advance log on the unit, or drop it (ROST-CQ-05).
- Hired swords use the henchmen XP table `[2,5,9,14]`; confirm that matches the Mordheim rule ("How it works" in the roster file).
- Make the whole summary card a disclosure button rather than a hover-revealed expand icon (ROST-UX-03).

### Pass 2 — Economy & trades

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-38 | CQ | Gold has one source of truth: `action` enum with `is_expense`, signed prices via one helper, `Warband.gold` kept with `F()` | ECON-CQ-01, ECON-UX-02 (vocabulary) | P1 | M |
| IMP-39 | CQ | The server writes the log (and ledger row) for every economy mutation; `POST /logs/` whitelisted and capped | ECON-CQ-02 | P2 | M |
| IMP-40 | CQ | Split `trades/views.py` into selectors, services (`transition()` state machine) and serializers, with a typed `TradeOfferSerializer` | ECON-CQ-03, ECON-CQ-09 | P2 | M |
| IMP-41 | CQ | `apps/warbands/services/stash.py` with conditional `F()` updates, reused by warbands, battles and trades | ECON-CQ-04 | P2 | S |
| IMP-42 | CQ | Break up `useAcquireItemDialogShared.tsx` (964 lines, 27 `useState`, 4 `as any`) around one server `purchaseItem()` | ECON-CQ-05 | P2 | M |
| IMP-43 | CQ | Shared `floating-menu.ts`, `useItemActionMenu`, `applyItemMutationResult`, `offerValue()`, `ResourceRow` | ECON-CQ-06 | P3 | S |
| IMP-44 | CQ | Economy dead code; `upsert_starting_gold_trade` becomes `create_starting_gold_trade` | ECON-CQ-07 | P3 | S |
| IMP-45 | UX | Trade countdown; expiry reset on accept and slid on change; expiry closes the dialog with a toast; trade-in-progress badge | ECON-UX-01 | P2 | S |
| IMP-46 | UX | Treasury shows current gold and a running balance; owner/admin corrections or an "Adjustment ±" action | ECON-UX-02 | P2 | M |
| IMP-47 | UX | Confirm before deleting a resource; +/- visible on touch (`hover: none`) | ECON-UX-03 | P3 | S |
| IMP-48 | UX | Stash and logs: kebab `aria-label`, "cost unknown", Buy-again failure toast, labelled log filter, grouped child logs | ECON-UX-04 | P3 | S |
| IMP-49 | UX | No silent economy failures: one standard toast, never close a dialog as successful after a partial write | ECON-UX-05 | P3 | S |

- **IMP-38 (P1):** Gold is derived by matching free-text `action` strings against four copied lists with two sign conventions (`NEGATIVE_TRADE_ACTIONS` lacks "bought" and "trade sent"), and the trades app bypasses `TradeHelper`. Add a data migration that flips the "Bought" and "Trade sent" rows and a `recompute_gold` audit command; every reader, frontend included, uses `warband.gold`. This is the precondition for server-side overspend checks (ECON-BUG-03, ECON-BUG-07).

**UX ideas worth raising with William during the brief**
- Trade window policy (ECON-UX-01): start the clock on accept (10 min proposed) and slide it on each offer change, up to what hard cap?
- Treasury corrections (ECON-UX-02): editable/deletable entries with a log entry, or append-only "Adjustment ±"?
- Can gold go negative? A `CheckConstraint(gold__gte=0)` only "if the campaign rules require it" (ECON-CQ-01).
- One vocabulary for manual and automatic ledger actions (Buy/Bought, Recruit/Recruited).
- A trade-in-progress badge in the campaign layout, so a trade isn't lost when the player leaves the warband page.

### Pass 3 — Battles

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-50 | CQ | Split `battles/views/shared.py` into serializers, services, validation and permissions; the helpers campaigns imports become public | BATL-CQ-01, CAMP-CQ-08 | P2 | L |
| IMP-51 | CQ | `BattleLayout` owns data, a `deriveBattleView` state machine, phase routes decomposed to ≤ 250 lines | BATL-CQ-02 | P2 | L |
| IMP-52 | CQ | The server owns battle rules: `suggested_postbattle` and a `rules` block; `BattleParticipant.objects.busy()` | BATL-CQ-03, BATL-UX-06 (leader XP) | P2 | M |
| IMP-53 | CQ | `BattleActionView` base (declarative statuses, `creator_only`, `lock`); one `participants_all_in` aggregate; `confirm/` renamed `skip-postbattle/` | BATL-CQ-05 | P3 | M |
| IMP-54 | CQ | Per-view participant types and a typed `BattleEvent` union; per-view DRF serializers | BATL-CQ-06 | P3 | M |
| IMP-55 | CQ | Battle dead code on both sides (unrouted views, `winner/` stub, legacy kill events, `usePrebattleRosters.ts`, test-only roll helpers) | BATL-CQ-04 | P3 | S |
| IMP-56 | CQ | Rewrite `BATTLEMODE_README.md` as a short note generated from the state machine | BATL-CQ-08 | P3 | S |
| IMP-57 | UX | The mobile postbattle back chevron only navigates; "Skip postbattle" moves to an overflow with a list of what is lost | BATL-UX-01 | P2 | S |
| IMP-58 | UX | Participant status strip with Nudge; toasts on redirect; a "Waiting for others" panel after finalising | BATL-UX-02 | P2 | S–M |
| IMP-59 | UX | 5-second Undo for kills and single-use items, backed by `POST events/:id/void/` | BATL-UX-03 | P2 | M |
| IMP-60 | UX | The finalise summary lists stat changes, kills, level-ups, items consumed and injuries to apply by hand | BATL-UX-04 | P2 | S |
| IMP-61 | UX | 44 px touch targets, unit names in `aria-label`s, End battle as the default action and Cancel in an overflow | BATL-UX-05 | P3 | S |
| IMP-62 | UX | "No winner" option, a consequence line on End battle, explained XP and exploration defaults | BATL-UX-06 | P3 | S |

No P1 items. Highest value:
- **IMP-51 + IMP-52:** the routes hold 50+ `useState` each, and ten rules are implemented on both sides; the copies already disagree (kill floor, BATL-BUG-04; dice selection, BATL-BUG-11). Layout-level data plus a battle-state query patched from socket payloads (PLAN 0.5) is the target.
- **IMP-57:** one natural "go back" tap on a phone permanently skips a player's postbattle. S effort.

**UX ideas worth raising with William during the brief**
- Allow draws / "No winner" at End battle (BATL-UX-06).
- Should temporary stat overrides become permanent only by an explicit per-unit choice (BATL-UX-04)?
- Undo window length and whether voided events stay visible in the timeline (BATL-UX-03).
- A "Nudge" that sends a campaign ping, and showing idle time per participant (BATL-UX-02).
- Stay on a "Waiting for others" panel after finalising instead of jumping to the warband page.
- Add Winning Leader +1 XP (and scenario bonuses?) to the default XP suggestions (BATL-UX-06).
- Auto-expiry window for abandoned battles (BATL-BUG-03; the campaign-side UI is IMP-70).

### Pass 4 — Campaigns

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-63 | CQ | Split `campaigns/views.py` into five view modules plus selectors and a membership service; `CampaignMemberView` base | CAMP-CQ-01 | P2 | M |
| IMP-64 | CQ | Roles and permissions defined once in `constants.py`, seeded by a data migration; the frontend reads `/permissions/` | CAMP-CQ-03 | P2 | S |
| IMP-65 | CQ | `CampaignSettings.tsx` follows the Rules of Hooks; delete the `emptySettings` stub | CAMP-CQ-04 | P2 | S |
| IMP-66 | CQ | Query-backed overview, Locations, Encampments and House Rules; shared `CampaignRecordsPage`; one permissions hook | CAMP-CQ-05 | P2 | M |
| IMP-67 | CQ | De-duplicate house-rule repricing (`_prefetched_base_items`, `_sync_availabilities`, one remap loop) and top-killers (`_killer_rows`) | CAMP-CQ-06, CAT-CQ-05 | P3 | S |
| IMP-68 | CQ | Campaign dead code and dead API surface, including `CampaignPingView` and `createCampaignPingSocket` | CAMP-CQ-07 | P3 | S |
| IMP-69 | CQ | Backend `EFFECT_KEYS` registry for house rules; common rules served by an endpoint | CAMP-CQ-09 | P3 | S |
| IMP-70 | UX | Stale battles show last activity, an owner/admin banner, admin cancel, and a link from the "In Active Battle" badge | CAMP-UX-01 | P2 | M |
| IMP-71 | UX | Membership lifecycle: transfer ownership, leave a campaign, clearer remove/kick | CAMP-UX-02 | P2 | M |
| IMP-72 | UX | Finish Locations and Encampments: delete, `explorable`, action-log entries, timestamps, honest toggle text | CAMP-UX-03 | P2 | M |
| IMP-73 | UX | Campaign changes reach other members (focus refetch or a `campaign.updated` event) | CAMP-UX-04 | P3 | S |
| IMP-74 | UX | Decide the bulletin tab: ship it (lazy-loaded) or remove it | CAMP-UX-05 | P3 | S |
| IMP-75 | UX | Honest campaign deletion: one label, a list of what is destroyed, optional archive | CAMP-UX-06 | P3 | S |
| IMP-76 | UX | No nested interactive elements, a labelled chat input, a Radix permission menu | CAMP-UX-07 | P3 | S |
| IMP-77 | UX | Owner/admin moderation of bulletin notes and chat (`DELETE messages/:id/`) | CAMP-UX-08 | P3 | S |
| IMP-78 | UX | Notification "Clear" confirms or skips actionable items; chat unread ignores your own messages and persists last-read | FE-UX-07 | P3 | S |

No P1 items. Highest value: **IMP-64** (the three drifted permission lists are the root of CAMP-BUG-04, a P1), **IMP-63** (31 membership copies, 50 bare 404s) and **IMP-71** (a campaign is orphaned if its owner leaves). IMP-65 will be flagged by the `react-hooks` lint in IMP-03; fix it then if that rule lands as blocking.

**UX ideas worth raising with William during the brief**
- Ownership transfer and "Leave campaign" (CAMP-UX-02); rename Remove/Kick to "Remove from campaign" / "Delete warband", with an optional "also delete warband" checkbox.
- Soft "Archive" as the default, hard delete as a separate step (CAMP-UX-06).
- Ship or remove the bulletin tab (CAMP-UX-05).
- Locations/Encampments: what disabling does to existing data, whether to split permissions, and new copy for the "Enable locations" toggle (CAMP-UX-03).
- Owner/admin moderation powers over chat and bulletin (CAMP-UX-08).
- Let admins, not only the owner, review and cancel stale battles; idle threshold for the banner (24 h proposed) (CAMP-UX-01).
- Keep or drop campaign pings and `max_games` (CAMP-CQ-07).
- Notification "Clear": confirm, or clear only informational items (FE-UX-07).

### Pass 5 — Catalogue

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-79 | CQ | `apps/core/catalogue.py`: `CampaignCatalogueListView`/`DetailView`, `merge_campaign_overrides`, `parse_campaign_id`; skills/spells/special shrink to ~10 lines each | CAT-CQ-01 | P2 | M |
| IMP-80 | CQ | One `use<Kind>Form` + `<Kind>FormFields` per catalogue kind (inline or in a dialog); `utils/statblock.ts`; `CatalogueTable<T>` | CAT-CQ-02 | P2 | L |
| IMP-81 | CQ | `apps/core/seeding.py` (`upsert_global`, `resolve_restrictions`, `sync_availabilities`, `parse_int`); every seeder atomic; drop the Sheets fallback | CAT-CQ-04 | P2 | M |
| IMP-82 | CQ | Split `Items.tsx` (908) and fix its memo deps; module-level `compareSkills` | CAT-CQ-06 | P3 | M |
| IMP-83 | CQ | `UniqueConstraint(campaign, name, type, nulls_distinct=False)`, unique through-table pairs, `created_by`/`created_at` | CAT-CQ-08 | P3 | M |
| IMP-84 | CQ | Catalogue dead code; decide on the unseeded `mim-*` and `custom-skills` data | CAT-CQ-07 | P3 | S |
| IMP-85 | CQ | Rename the `save` serializer field, nested property serializer, typed `races` | CAT-CQ-09 | P3 | S |
| IMP-86 | UX | "Custom" and "House rule" badges with author and replaced price; custom rows sorted with base rows | CAT-UX-01 | P2 | S (after IMP-83) |
| IMP-87 | UX | Complete editors: bestiary and hired-sword edit/delete, usage-aware delete confirmation, restriction picker, `grade`/`race` persisted | CAT-UX-02 | P2 | M |
| IMP-88 | UX | Multi-availability rows show their restriction ("Forest Goblins · Common"), or group into one row | CAT-UX-03 | P3 | S |
| IMP-89 | UX | Empty states stop lying: inline error with Retry; favourite toggle rolls back with a toast | CAT-UX-04 | P3 | S |
| IMP-90 | UX | `tab`, `subtype` and `q` in `useSearchParams` | CAT-UX-05 | P3 | S |
| IMP-91 | UX | Rule tooltips reachable by keyboard (button trigger or `tabIndex` + `aria-describedby`) | CAT-UX-06 | P3 | S |

No P1 items. Highest value: **IMP-79** (each catalogue fix currently lands 8 times), **IMP-80** (~3,800 lines of forms where ~1,500 would do) and **IMP-86** (the badges are what explain the "Axe 25 gc" mystery to players). The catalogue cache itself moves to TanStack Query in Phase 0 (IMP-08).

**UX ideas worth raising with William during the brief**
- Badge wording and ordering for custom and house-rule entries (CAT-UX-01); this pairs with the bug decision on who may create custom entries (CAT-BUG-03).
- Seed the Marienburg `mim-*` data and `custom-skills.json` (for `campaign_type == "marienburg"`?) or delete them (CAT-CQ-07).
- Group multi-availability items into one row, or keep separate rows with a subtitle (CAT-UX-03).
- Build the bestiary and hired-sword edit UI, or remove the unused update/delete API (CAT-UX-02).
- Long run: merge Skill, Spell and Special into one model with a `kind` column (CAT-CQ-01).

### Pass 6 — Auth & core

| IMP | Kind | Title | Sources | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| IMP-92 | CQ | One session module (`useSyncExternalStore`, `status: booting/authenticated/anonymous/offline`) instead of localStorage + React state + a window event | AUTH-CQ-05 | P2 | M |
| IMP-93 | CQ | One `_send_resend_email` helper (also the home for background dispatch and the test guard) | AUTH-CQ-02 | P3 | S |
| IMP-94 | CQ/UX | One forgot-password flow; `AuthCard` split into forms; shared `PasswordInput`; reset and sign-up polish | AUTH-CQ-03, AUTH-UX-05 | P3 | S |
| IMP-95 | CQ | Auth serializers: a real `EmailField`, `validate_password` with the user, `filter(username=email)`, `issue_tokens(user)` | AUTH-CQ-04 | P3 | S |
| IMP-96 | UX | Feedback report: success toast, `maxLength` counter, available outside a campaign, a descriptive subject | AUTH-UX-04 | P3 | S |
| IMP-97 | UX | Account management: change name and password, delete account, sign out other devices | AUTH-UX-06 | P3 | M |
| IMP-98 | UX | Auth shell: scrollable on short screens, `role="alert"` errors, `aria-pressed` mode switch, deferred `youtube-nocookie` video | AUTH-UX-07 | P3 | S |

No P1 items. Highest value: **IMP-92**, the common root of AUTH-BUG-01 (P1: transient failures log users out), AUTH-BUG-02 and AUTH-PERF-01/02. If AUTH-BUG-01 jumps the queue, pull IMP-92 forward with it. The auth error strings and session-expiry handling are already covered in Phase 0 (IMP-10, IMP-17, IMP-12).

**UX ideas worth raising with William during the brief**
- Account management scope (AUTH-UX-06), in particular what deleting an account does to the user's warbands and owned campaigns.
- Keep the inline forgot-password mode or the `/forgot-password` page (AUTH-CQ-03).
- Offer the feedback card on the Campaigns and landing pages (AUTH-UX-04).
- Keep the background YouTube video on auth pages at all? At minimum `youtube-nocookie`, deferred, and off on reset/forgot (AUTH-UX-07).
- Add a confirm-password field and a password-rule hint to registration (AUTH-UX-05).
- Require a display name at signup or on first campaign join (pairs with CAMP-SEC-01).

## Accessibility & mobile checklist

Consolidated from every UX section. Each line names the fixing IMP item. Run with the manual QA scripts at mobile width (Definition of done).

**Keyboard access**
- [ ] Race pickers and `SearchableDropdown` usable by keyboard (arrow keys, Enter, Escape; no close-on-blur) — ROST-UX-02, FE-UX-05 → IMP-18, IMP-30
- [ ] Unit card expand and XP +/- rendered always and shown on `:focus-within`, not only on hover — ROST-UX-03 → IMP-32
- [ ] Resource +/- reachable without hover — ECON-UX-03 → IMP-47
- [ ] Rule and property tooltips have focusable triggers — CAT-UX-06 → IMP-91
- [ ] Permission dropdown closes on Escape and moves/returns focus (Radix menu) — CAMP-UX-07 → IMP-76
- [ ] `TabSwitcher`/`MobileTabs` expose `tablist`/`tab`/`aria-selected` — FE-UX-05 → IMP-18
- [ ] Checkbox shows a visible focus ring — FE-UX-05 → IMP-18
- [ ] Dialogs have a visible close button; mobile sheets move focus to the title — FE-UX-05 → IMP-18

**Labels and accessible names**
- [ ] Form labels associated with inputs (`htmlFor`/`id`); clickable "Leader" label — ROST-UX-02 → IMP-30
- [ ] XP +/- buttons named ("Add 1 XP to {name}") — ROST-UX-03 → IMP-32
- [ ] Level-up stat choice as a labelled `RadioGroup` — ROST-UX-04 → IMP-33
- [ ] Stash kebab button and log filter `<select>` labelled — ECON-UX-04 → IMP-48
- [ ] Battle card actions name the unit ("Record kill for {unit}") — BATL-UX-05 → IMP-61
- [ ] Chat input has `aria-label="Message"` — CAMP-UX-07 → IMP-76
- [ ] Auth errors are `role="alert"`; the Sign in / Create Account switch has `aria-pressed` — AUTH-UX-07 → IMP-98

**Semantics**
- [ ] No nested interactive elements (`CampaignCard` link with buttons, `RosterTable` button row with a link, `NavLink` wrapping `Button`) — CAMP-UX-07 → IMP-76
- [ ] `eslint-plugin-jsx-a11y` in CI — FE-CQ-01, FE-UX-05 → IMP-03

**Contrast and type size**
- [ ] Error text at ≥ 4.5:1 (today `text-red-600` on near-black, ~4.1:1) — FE-UX-01 → IMP-11
- [ ] No running text below 0.7rem (152 uses of 8 to 11 px today) — FE-UX-05 → IMP-18

**Mobile layouts and battle screens on phones**
- [ ] Battle touch targets ≥ 44 px (wound/OOA 32 px, apply-stats tick 28 px today) — BATL-UX-05 → IMP-61
- [ ] End battle is the default action; Cancel moved to an overflow — BATL-UX-05 → IMP-61
- [ ] Postbattle back chevron never skips postbattle — BATL-UX-01 → IMP-57
- [ ] Kill and item-use mis-taps can be undone — BATL-UX-03 → IMP-59
- [ ] Mobile catalogue rows distinguishable (multi-availability items) — CAT-UX-03 → IMP-88
- [ ] Catalogue tab/filter/search survive back navigation — CAT-UX-05 → IMP-90
- [ ] One 960 px breakpoint; tablets (768 to 960 px) get one coherent layout; safe-area decision tested on a notched iPhone — FE-UX-06 → IMP-19
- [ ] Auth pages scroll on short or landscape screens (`min-height: 100dvh`) — AUTH-UX-07 → IMP-98
- [ ] Hover-only controls have a touch path (`@media (hover: none)`) — ROST-UX-03, ECON-UX-03 → IMP-32, IMP-47
- [ ] Shell renders immediately with skeletons; no full-screen blackout on campaign or battle entry — FE-UX-02 → IMP-12
- [ ] Cross-refs to verify on a real phone (performance and bug items, not tracked here): the mobile edit-mode re-render loop (ROST-PERF-07), the pull-to-refresh full reload (FE-PERF-02), and the remount when crossing 960 px (FE-BUG-01)

## Source index

Every CQ and UX finding, and where it landed.

| Area | Findings → IMP |
| --- | --- |
| AUTH (12) | CQ-01→05 · CQ-02→93 · CQ-03→94 · CQ-04→95 · CQ-05→92 · UX-01→10 · UX-02→17 · UX-03→12 · UX-04→96 · UX-05→94 · UX-06→97 · UX-07→98 |
| CAMP (17) | CQ-01→63 (+25) · CQ-02→13 · CQ-03→64 · CQ-04→65 · CQ-05→66 (+08, 10) · CQ-06→67 · CQ-07→68 · CQ-08→50 · CQ-09→69 · UX-01→70 · UX-02→71 · UX-03→72 · UX-04→73 · UX-05→74 · UX-06→75 · UX-07→76 · UX-08→77 |
| ROST (13) | CQ-01→24, 26, 27 · CQ-02→28 (+25) · CQ-03→29 · CQ-04→30 · CQ-05→36 (+04) · CQ-06→26, 27 (+24) · CQ-07→37 (+20) · UX-01→31 · UX-02→18, 30 · UX-03→32 · UX-04→33 · UX-05→34 (+10) · UX-06→35 |
| ECON (14) | CQ-01→38 · CQ-02→39 · CQ-03→40 (+25) · CQ-04→41 · CQ-05→42 · CQ-06→43 · CQ-07→44 · CQ-08→04 · CQ-09→40 · UX-01→45 · UX-02→46 (+38) · UX-03→47 · UX-04→48 · UX-05→49 |
| BATL (14) | CQ-01→50 · CQ-02→51 (+10) · CQ-03→52 · CQ-04→55 · CQ-05→53 (+25) · CQ-06→54 (+20) · CQ-07→04 · CQ-08→56 · UX-01→57 · UX-02→58 · UX-03→59 · UX-04→60 · UX-05→61 · UX-06→62 (+52) |
| CAT (15) | CQ-01→79 (+25) · CQ-02→80 · CQ-03→08, 09 · CQ-04→81 · CQ-05→67 · CQ-06→82 · CQ-07→84 (+04) · CQ-08→83 · CQ-09→85 · UX-01→86 · UX-02→87 · UX-03→88 · UX-04→89 · UX-05→90 · UX-06→91 |
| FE (16) | CQ-01→01, 03 · CQ-02→04 · CQ-03→14, 15, 68 · CQ-04→08, 10 · CQ-05→13, 15, 09 · CQ-06→21 · CQ-07→20, 10 · CQ-08→22 · CQ-09→23 · UX-01→11 · UX-02→12 · UX-03→17 · UX-04→16 · UX-05→18 · UX-06→19 · UX-07→78 |
| INFRA (3) | CQ-01→06 · CQ-02→07 · CQ-03→07 |

IMP items per phase: Phase 0: 25 (IMP-01 to 25) · Pass 1: 12 · Pass 2: 12 · Pass 3: 13 · Pass 4: 16 · Pass 5: 13 · Pass 6: 7 · total 98.
