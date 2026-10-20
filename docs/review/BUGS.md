# Bug & Security Register

> Built from docs/review/features/*.md on 2026-10-16. Full detail (file:line, reproduction, fix) lives in the source feature file.

**How to read this.** `BUG-NN` and `SEC-NN` are the canonical register IDs. The source IDs (for example `ROST-BUG-02`) point to the full write-up in the feature file and stay the reference. Severity and confidence follow [README.md](README.md). When reviewers filed the same defect at different severities, the higher one is used and the entry says so. Three UX findings that are really defects (they lose data, gold or unsaved work) are included and marked *filed as UX*. Findings of other kinds that share a root cause are listed as "related" and not counted.

## Summary

### Counts

All 90 `*-BUG-*` and 18 `*-SEC-*` findings from the eight feature files are below. After de-duplication: **81 canonical bugs from the BUG findings + 3 promoted UX findings = 84 bugs**, and **16 security items**.

| Kind | P0 | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- | --- |
| Bugs | 0 | 18 | 38 | 28 | 84 |
| Security | 0 (2 become P0 if an env var is unset on Render) | 3 | 3 | 10 | 16 |

| Bug area | P1 | P2 | P3 | Total |
| --- | --- | --- | --- | --- |
| Warband roster | 2 | 8 | 6 | 16 |
| Economy and trades | 4 | 9 | 3 | 16 |
| Battles | 3 | 5 | 5 | 13 |
| Campaigns | 4 | 4 | 3 | 11 |
| Catalogue | 3 | 2 | 4 | 9 |
| Auth and core | 1 | 4 | 3 | 8 |
| Frontend platform | 0 | 5 | 4 | 9 |
| Infrastructure | 1 | 1 | 0 | 2 |
| **Total** | **18** | **38** | **28** | **84** |

**Merged at different severities (higher kept):** BUG-01 (INFRA P1 / BATL P2), BUG-15 (CAMP P1 / CAT P2), BUG-18 (CAT P1 / ECON P2), BUG-31 (ROST P2 / ECON P3), BUG-40 (ECON P2 / CAT P3), BUG-51 (CAMP P2 / CAT P3). Merged at equal severity: BUG-03, BUG-19, BUG-20, SEC-07, SEC-08. The location XSS (SEC-03) was filed only by AUTH; CAMP has no matching finding.

### The 10 most important defects

1. **SEC-01 / SEC-02:** `SECRET_KEY` falls back to `"dev-secret-key"` (signs every JWT) and `DEBUG` defaults to on. P0 if either env var is unset on Render. Check today. *Code fixed in PR 0-A; rotating the leaked secrets is still open.*
2. **SEC-03:** stored XSS in campaign locations can steal members' 30-day refresh tokens from localStorage. *Fixed in PR 0-A.*
3. **BUG-01:** a Pusher hiccup turns committed battle, trade and chat writes into HTTP 500s; retries double-count kills. *Fixed in PR 0-A.*
4. **BUG-02:** any transient `/auth/me` or refresh failure logs the user out, exactly when Render is struggling. *Fixed in PR 0-A.*
5. **BUG-04:** saving a henchmen group hard-deletes its dead henchmen and their kill records. *Fixed in pass 1 PR A.*
6. **BUG-06:** moving an item to a dead or missing unit commits the removal and destroys the item.
7. **BUG-07:** purchases aren't atomic: unpaid items when the ledger write fails, lost or duplicated items across tabs, no server-side gold check.
8. **BUG-05:** any trade with a trader selected can never complete (local DB: 7 trade requests, 0 completed).
9. **BUG-16:** deleting a custom catalogue entry cascades and deletes it from every warband in the campaign.
10. **BUG-09 + BUG-10:** cancelling after "End battle" leaves wins/losses applied, and nothing expires abandoned battles (battle #40 has blocked two players since 2026-04-22).

Next in line: BUG-03 (postbattle XP ignores custom thresholds and half-rate; *fixed in pass 1 PR A*), BUG-18 (any player can silently reprice a base item campaign-wide: the "Axe 25 gc" case), BUG-08 (trade lock races burn trading actions).

### Data already affected in the local DB

Observed by reviewers in the local Docker DB. Production probably has the same classes of damage; the SQL in [Production checks](#production-checks) finds them.

| What was observed | Bug | Production action |
| --- | --- | --- |
| Battle #40 `active` since 2026-04-22, both participants `in_battle` and "busy" in campaign 1 | BUG-10 | Find and close stuck battles |
| Battles 36 and 39 cancelled by the owner after `battle_entered_postbattle`: warband 1 shows 16 losses vs 14 lost ended battles; warband 2 shows 17 wins vs 16 | BUG-09 | Win/loss drift report, owner-reviewed correction (don't auto-fix: counters may have been hand-edited) |
| 7 trade requests, 0 completed | BUG-05, BUG-08, BUG-41 | Close stuck `accepted` trades, restore spent trading actions |
| Monks group 1 has two dead henchmen (John, kills 1; Alfred) that the next edit of that group will delete | BUG-04 | Deleted rows can't be recovered from the DB; orphaned kill events show where it already happened |
| Custom "Axe" (item 231, 25 gc) hides base Axe (item 1, 5 gc) in campaign 1; base-Axe copies still owned at 5 gc (henchmen 2 rows, hired swords 2, warband 2 stash 1 with cost NULL that sells for 0). Beastlash is overridden too (4 gc rarity 3 vs base 10 gc rarity 8) | BUG-18 | Product decision per override; list them with SQL |
| 14 base/campaign rows share name and type (Axe and Beastlash in campaign 1; 8 armour + 4 shield clones in campaign 2), so `seed_all` crashes | BUG-17 | Do not run `seed_all` against production until BUG-17 is fixed |
| Kill events from cancelled battles 5-8 appear in kill history | BUG-11 | Kill totals vs events need a decision once events are authoritative |
| Warband 2 ledger: raw `SUM(price)` = 1,287 vs derived gold 801 (mixed sign convention) | BUG-37 | Any report or SQL that sums `price` is wrong; normalise during the ledger rework |
| `campaign_permission` holds 8 codes; `manage_spells` and `manage_features` are missing | BUG-15 | Data migration seeding all codes |
| Giant Spider seeded with S0; Dark Elf Dark Mage has no spells; 14 seed links unresolved | BUG-54 | Corrected seed (after BUG-17) |

## Fix log

What has been fixed, and where. Every fix ships with a regression test that fails on the old code. Commit subjects carry the IDs, so `git log --grep=BUG-NN` finds the commit. Entries below stay in the register with their original write-up; this section is the status.

| Branch | Fixed | Partly fixed (rest later) |
| --- | --- | --- |
| `chore/foundations` (PR 0-A) | SEC-02, SEC-03, SEC-16, BUG-01, BUG-02, BUG-25 | SEC-01 (startup refuses a missing or default key; **rotating the leaked production secrets is still yours**), SEC-04 (`RATE_LIMIT_NUM_PROXIES` exists; set its value from the access log) |
| `chore/foundations-0d` | BUG-21, BUG-22, BUG-59 | |
| `chore/foundations-0e` | BUG-23, BUG-26, BUG-57, BUG-58, BUG-60, BUG-61 | SEC-15 (headers on; CSP report-only), BUG-19 (shared client and reconnect catch-up; battle state in pass 3), BUG-20 (notifications and chat errors; per-screen rollout in the passes), BUG-24 (layout side; Warband's own loop in pass 1) |
| `pass1/warband-roster` (PR A) | BUG-03, BUG-04 (now guaranteed, not accidental), BUG-88, BUG-89, BUG-90, BUG-91, BUG-92, BUG-93, BUG-94, BUG-95; part 2: BUG-62, BUG-96, BUG-97 | SEC-07 (unit writes; stash, item and catalogue writes in passes 2 and 5), BUG-63 (server locks the warband and only moves the crown when asked; stale whole-unit XP saves stop in PR C) |
| `pass1/roster-changes-backend` + `-frontend` (PR C) | BUG-27, BUG-28, BUG-29, BUG-30, BUG-31, BUG-32 (warn only, decision 10), BUG-33, BUG-34, BUG-63 (rest: XP +/- sends only `{xp}`), BUG-64, BUG-65, BUG-66, BUG-67, BUG-85, BUG-86, BUG-87, BUG-98, BUG-99, BUG-100, BUG-101, BUG-102, BUG-104, BUG-105, SEC-14; BUG-24 re-verified at 375 px | |
| `pass2/economy-trades` + `pass2/frontend-fixes` (PR A part 1, before the pass 2 decisions) | BUG-06, BUG-08, BUG-35, BUG-36, BUG-37 (frontend reads the server's gold), BUG-38, BUG-40, BUG-41, BUG-42, BUG-68, BUG-70, BUG-107, BUG-109, BUG-110, BUG-111, BUG-112, BUG-113, BUG-114, BUG-115, BUG-116, BUG-118, BUG-119, BUG-120; SEC-08 (trade half) | BUG-05 (a trade with a trader completes; spent-trader warn vs refuse is decision 9), BUG-69 (errors shown; timers wait for decision 8), SEC-07 (stash half done; catalogue writes pass 5) |
| `pass2/economy-backend`, `pass2/trades-backend` / `-followup`, `pass2/economy-frontend-changes` (PR A part 2, B, C) | BUG-05 (rest: a spent trader warns), BUG-07 (one `purchases/` request; purchases ride the roster Save), BUG-37 (stored, signed ledger), BUG-43, BUG-69 (timers, countdown, `trade_closed`; nothing to restore because the trading action is spent only at completion), BUG-108, BUG-117 (one stash row per cost) | BUG-18 (Buy again at the current price and recruits at the recorded price are done; the override rule itself is pass 5) |
| `pass3/battles` → `pass3/changes-frontend` (PR A, B, C) | BUG-09, BUG-10, BUG-11, BUG-19, BUG-44, BUG-45, BUG-46, BUG-47, BUG-48, BUG-71, BUG-72, BUG-73, BUG-74, BUG-75, BUG-106 (lock order pinned), BUG-121, BUG-122, BUG-123, BUG-124, BUG-125, BUG-126, BUG-127, BUG-128 (also hotfixed on main); SEC-08 (battle half), SEC-09, SEC-10 | |
| `pass4/campaigns` → `pass4/changes-frontend` (PR A, B, C) | BUG-12 (Kick merged into Remove), BUG-13, BUG-14, BUG-49, BUG-50, BUG-52, BUG-76, BUG-77 (warn, never refuse), BUG-78, BUG-129, BUG-142, BUG-143 (every member sees the code), BUG-144; SEC-13 | BUG-15 (every code seeded from one constants list, the grant menu from the server; the catalogue Edit gates are pass 5), BUG-51 (clones locked, stored costs kept, no cascade; the reseed re-sync is pass 5) |

Pass 1 PR A notes:
- **BUG-03:** postbattle XP goes through one `apply_xp_gain` (`apps/warbands/services/xp.py`) that reads the campaign's tables and halves the award for half-rate units. Hired swords still use the henchmen table until decision 8 lands in PR C. The PATCH path joins the same helper with BUG-27 in PR C.
- **BUG-04 / BUG-92 / BUG-94:** dead henchmen are **read-only records** on the group PATCH: an entry naming one, even with `dead: false`, is ignored. This matches dead heroes, groups and hired swords, which return 404 on PATCH. *My call; the alternative is updating dead members in place. A deliberate "revive" action is in the brief's ideas.*
- **Part 2** also made every unit create, PATCH, DELETE and level-up atomic for all three kinds (ROST-PERF-09), and landed PERF-23, PERF-24 (`GET warbands/:id/sheet/`), PERF-28, PERF-29 and ROST-PERF-11. Query counts are in the brief's Progress section.
- **BUG-62:** an unknown advance is a 400 for every kind, and the level-up is spent with a guarded `F()` decrement, so two quick requests can't both use one. Every advance the real UI sends (including Lad's Got Talent) was checked.
- **SEC-07 (unit half):** another campaign's race or loadout entry is rejected with the same 400 as an unknown id. Unknown loadout ids are still dropped silently, as before.

## Security

| ID | Sev | Title | Sources | Fix summary | Plan phase |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | P1 (P0 if unset) | `SECRET_KEY` falls back to `"dev-secret-key"`, which also signs JWTs and reset tokens | AUTH-SEC-01 (cross-ref INFRA-SEC-01) | Refuse to start when `DEBUG` is off and the key is the default or under 50 chars; verify Render; rotate if it was ever unset | 0 (0.1) |
| SEC-02 | P1 (P0 if unset) | `DEBUG` defaults to on | INFRA-SEC-01 | `_env_bool("DJANGO_DEBUG", False)`, production assertion block, `check --deploy` in CI | 0 (0.1) |
| SEC-03 | P1 | Stored XSS in campaign locations can steal 30-day refresh tokens | AUTH-SEC-02 (cross-ref FE-SEC-01) | nh3 allow-list on write, DOMPurify on render, CSP header | 0 (pulled forward from pass 4) |
| SEC-04 | P2 | Auth throttles bypassable via `X-Forwarded-For`; LocMem counters are per process, small and non-atomic | AUTH-SEC-03 | Set `RATE_LIMIT_NUM_PROXIES` on Render and fail startup when unset; Redis when multi-worker; raise `MAX_ENTRIES` meanwhile | 0 (0.1 env) + 6 |
| SEC-05 | P2 | No session revocation: logout is client-only, a password reset leaves old tokens valid | AUTH-SEC-04 | `CHECK_REVOKE_TOKEN=True`; blacklist + rotation + logout endpoint; shorten access lifetime only after BUG-21 | 6 |
| SEC-06 | P2 | Any logged-in user can create global restrictions | CAT-SEC-01 | Remove the POST or scope it to a campaign with `add_custom`; `nulls_distinct=False`; delete junk rows | 5 |
| SEC-07 | P3 | Catalogue and item ids aren't scoped to the campaign (unit serializers, stash writes, catalogue writes), leaking other campaigns' custom content | ROST-SEC-01, ECON-SEC-01, CAT-SEC-02 | Validate every referenced id is in this campaign or global (scoped `PrimaryKeyRelatedField`) | 1, 2, 5 |
| SEC-08 | P3 | Removed members keep access to trades and to trade/battle realtime channels | ECON-SEC-02, BATL-SEC-02 (channel-auth half) | Membership check for both trade participants and in channel auth (plus non-declined status for battles) | 2, 3 |
| SEC-09 | P3 | Battle event payloads unvalidated and unbounded (up to 2.5 MB, replayed to every participant) | BATL-SEC-02 (payload half) | Whitelist keys per event type, cap around 2 KB | 3 |
| SEC-10 | P3 | Postbattle rewards fully client-trusted; permanent stat changes unaudited | BATL-SEC-01 | Server caps for XP, shards and gold; log every applied stat override; optional owner review | 3 |
| SEC-11 | P3 | Accounts can be enumerated; emails never verified | AUTH-SEC-05 | Accept and document, or add a verification flow; async reset for constant timing | 6 |
| SEC-12 | P3 | Reset token travels in the query string | AUTH-SEC-06 | Move to the URL fragment and strip with `history.replaceState` | 6 |
| SEC-13 | P3 | Emails shown to every campaign member when a user has no display name | CAMP-SEC-01 | One `display_name(user)` helper; require a name at signup | 4 |
| SEC-14 | P3 | Warband-link iframe has no sandbox and is granted clipboard-read | ROST-SEC-02 | Drop clipboard-read, add `sandbox`, allow-list hosts | 1 |
| SEC-15 | P3 | No security headers; WASM and fonts executed from third-party CDNs | FE-SEC-01 | Self-host assets; CSP, Referrer-Policy, nosniff in `vercel.json` | 0 |
| SEC-16 | P3 | No HTTPS hardening settings behind Render's proxy | INFRA-SEC-02 | `SECURE_PROXY_SSL_HEADER`, HSTS, secure cookie flags when not `DEBUG` | 0 (0.1) |

**SEC-01 · P1 (P0 if unset).** `settings.py:27` defaults `DJANGO_SECRET_KEY` to `"dev-secret-key"`, which SimpleJWT and `PasswordResetTokenGenerator` both use. If the variable is missing on Render, anyone who reads the source can mint an access token for any user id or forge reset tokens: a takeover of every account. Rotating the key logs everyone out once, so ship SEC-05's `CHECK_REVOKE_TOKEN` in the same deploy and pay that cost only once. Confidence: Confirmed (code), Speculative (production value).

**SEC-02 · P1 (P0 if unset).** `DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"`. A missing variable means public technical 500 pages (settings, request, local variables) and every SQL query held in memory per request. Together with SEC-01 and SEC-04, one missing env var exposes a lot. Confidence: Confirmed (code), production value unknown.

**SEC-03 · P1.** `CampaignLocationWriteSerializer` stores `content` raw and `LocationsTable.tsx:47` renders it with `dangerouslySetInnerHTML`. Anyone with `manage_locations` (every owner and admin, and anyone can create a campaign and share its join code) can store `<img src=x onerror=...>`. Tokens sit in localStorage under fixed keys, and the stolen refresh token stays valid for 30 days with no way to revoke it (SEC-05). Confidence: Confirmed (code path; not exploited). Check production for existing payloads.

## Bugs by severity

### P0

No defect was graded P0 by its reviewer. Treat these as P0 until verified:
- **SEC-01, SEC-02:** P0 if `DJANGO_SECRET_KEY` or `DJANGO_DEBUG` is unset on Render.
- **BUG-04:** the reviewer notes the data-loss rubric makes it "arguably P0"; graded P1 because only historical records are lost.
- **BUG-06:** permanent item loss; graded P1 only because it needs a stale or invalid target.

### P1

#### BUG-01 · P1 · A Pusher failure turns a committed write into HTTP 500 and drops the remaining notifications
- **Sources:** INFRA-BUG-01 (P1), BATL-BUG-05 (P2, raised to P1); related CAMP-PERF-07 (chat), ECON-PERF-02 · **Area:** Infrastructure / realtime · **Confidence:** Confirmed
- **What happens:** during a Pusher outage, timeout or credentials problem, a battle action, trade completion or chat message is saved but the user gets a 500 (after up to 5 s). Other participants get no event, and queued `on_commit` callbacks are discarded. Retries double-count non-idempotent actions (`unit-kill`, `item_used`), and create-battle retries fail with "already in another battle". Oversized `item_used` payloads trigger it too (SEC-09).
- **Fix:** never re-raise from realtime sends; `transaction.on_commit(fn, robust=True)`; dispatch off the request path (INFRA-PERF-08); idempotency key for `unit-kill` and `events`. Regression test INFRA-TEST-06.
- **Plan phase:** 0 (0.1) · **Needs data fix in prod?** check (duplicate kill events from retries)

#### BUG-02 · P1 · Any transient failure of `/auth/me` or `/auth/refresh` deletes both tokens and logs the user out
- **Sources:** AUTH-BUG-01 (FE lists it as a platform root cause) · **Area:** Auth · **Confidence:** Confirmed
- **What happens:** a 5xx, 429, dropped connection or CORS failure during a Render restart or overload clears both tokens. Users are thrown back to login, lose their 30-day refresh token, and logging in again adds load ("it keeps logging me out").
- **Fix:** clear tokens only on a 401 from `/me` or a 400/401 from `/refresh`; otherwise keep them and show "Can't reach the server" with Retry.
- **Plan phase:** 0 (0.5 api-client work; pulled forward from pass 6 because it fires exactly when Render is slow) · **Needs data fix in prod?** no

#### BUG-03 · P1 · Postbattle XP ignores the campaign's custom thresholds and half-rate
- **Sources:** ROST-BUG-01, BATL-BUG-01 (both P1) · **Area:** Roster (code in battle finalisation) · **Confidence:** Confirmed (code; local campaigns use defaults)
- **What happens:** finalisation counts level-ups against the default tables (hired swords against the henchmen defaults) and adds full XP to half-rate units. In campaigns with custom thresholds the `level_up` counter disagrees with the XP bar; half-rate units gain double XP every battle.
- **Fix:** load `CampaignSettings` once per finalise and route every XP gain through one `apply_xp_gain(unit, delta, settings)` helper in `apps/warbands/utils`, shared with the serializers (pairs with BUG-27).
- **Plan phase:** 1 (helper and call sites), regression tests BATL-TEST-01/02 in pass 3 · **Needs data fix in prod?** check (campaigns with non-default thresholds; half-rate units)

#### BUG-04 · P1 · Saving a henchmen group deletes its dead henchmen (silent data loss)
- **Sources:** ROST-BUG-02 · **Area:** Roster · **Confidence:** Confirmed
- **What happens:** edit forms only carry living henchmen, and the serializer deletes every existing id missing from the payload, dead ones included. Fallen henchmen's kills vanish from group kill history and campaign top killers. Lad's Got Talent's group update does the same.
- **Fix:** scope the sync to `dead=False` and never delete dead rows from this path; better, an explicit `removed_ids` list. Regression test ROST-TEST-03.
- **Plan phase:** 1 · **Needs data fix in prod?** check (lost rows can't be restored; orphaned kill events show where it happened)
- **Update (pass 1 characterisation, 2026-10-17):** not reproducible through PATCH today. The view loads only living henchmen, which also limits what the serializer deletes, so dead members survive. That is accidental, and the PERF-23 rework could bring the loss back; `test_roster_characterisation_*` now locks the safe behaviour. Related data bugs found alongside it: BUG-92 to BUG-94.

#### BUG-05 · P1 · Trades with a trader selected can never complete
- **Sources:** ECON-BUG-01 · **Area:** Economy · **Confidence:** Confirmed (code)
- **What happens:** locking spends the trader's `trading_action`; completion re-validates the offer and rejects the now-spent trader as "unavailable". The transfer rolls back, but the accepted flags and trader consumption were saved outside the block, so every retry fails while both sides show "Accepted". Local DB: 7 requests, 0 completed.
- **Fix:** at completion only check that the trader still exists and belongs to the warband; do lock and completion in one `select_for_update` transaction (with BUG-41). Test ECON-TEST-01.
- **Plan phase:** 2 · **Needs data fix in prod?** yes (stuck `accepted` trades, spent trading actions)

#### BUG-06 · P1 · Moving an item to a missing or dead unit destroys it
- **Sources:** ECON-BUG-02 · **Area:** Economy · **Confidence:** Confirmed
- **What happens:** `item-transfers` removes the source rows inside `atomic()`, then returns a 404 for a bad target. A normal return commits, so the items vanish with no ledger or log row. Triggered by a Move dialog opened before the target died or was dismissed.
- **Fix:** validate source and target before mutating; raise (or `set_rollback(True)`) inside the block. Test ECON-TEST-02.
- **Plan phase:** 2 · **Needs data fix in prod?** check (losses leave no trace; only player reports)

#### BUG-07 · P1 · Purchases are not atomic: unpaid items, lost or duplicated items, no server-side gold check
- **Sources:** ECON-BUG-03 · **Area:** Economy · **Confidence:** Confirmed (payment, list replacement, gold check); Likely (retry double-charge)
- **What happens:** the item is committed first and the "Bought" ledger row posted afterwards with failures swallowed, so the item is free. Unit item lists are replaced wholesale from stale client state, duplicating or dropping items across tabs. Gold is checked only in the browser and can go negative. Retrying a failed roster save re-posts purchases that already succeeded.
- **Fix:** a server purchase endpoint in one transaction with a conditional gold debit; append-style unit item endpoints. Until then, treat a failed ledger POST as a failure and drop each pending purchase once it commits.
- **Plan phase:** 2 · **Needs data fix in prod?** check (gold vs inventory reconciliation)

#### BUG-08 · P1 · Lost updates in trade lock and offer writes; trading actions burned permanently
- **Sources:** ECON-BUG-04 · **Area:** Economy · **Confidence:** Confirmed (code); race not reproduced
- **What happens:** every trade write loads the request without a lock and saves both sides' fields. Two near-simultaneous Accepts erase one lock; that side can never lock again ("Selected trader is unavailable") and its hero keeps a spent trading action until the next battle reset. Concurrent offer edits drop one side's offer, and two trades can consume the same trader.
- **Fix:** `atomic()` + `select_for_update()`; save only the changed field; consume the trader with a conditional UPDATE; store `from/to_trader_consumed` explicitly.
- **Plan phase:** 2 · **Needs data fix in prod?** check (spent trading actions)

#### BUG-09 · P1 · Cancelling after "End battle" leaves wins/losses applied and overwrites participant history
- **Sources:** BATL-BUG-02 · **Area:** Battles · **Confidence:** Confirmed (code and data)
- **What happens:** wins/losses are added when the creator ends the active battle, and both cancel paths still accept `postbattle`. Cancel doesn't reverse the counters and overwrites `confirmed_postbattle` with `canceled_prebattle`, while XP, gold, items and logs stay applied. Local: battles 36 and 39 left warband 1 at 16 losses vs 14, warband 2 at 17 wins vs 16.
- **Fix:** apply wins/losses in `_finalize_battle`; reject cancel in postbattle and offer "Close postbattle"; never overwrite `confirmed_postbattle`; ship a read-only `manage.py report_win_loss_drift` for owner review.
- **Plan phase:** 3 · **Needs data fix in prod?** yes (drift report, owner-reviewed correction)

#### BUG-10 · P1 · No expiry, leave or abandon handling: stale battles block players indefinitely
- **Sources:** BATL-BUG-03; related CAMP-UX-01 (stale-battle tooling is owner-only and buried), NOTES live run · **Area:** Battles · **Confidence:** Confirmed
- **What happens:** battle #40 has been `active` since 2026-04-22; both users are "busy" and can't start or be invited to other battles, and the overview shows a misleading "Rejoin Battle". Stuck states exist in every phase (ignored invite, creator vanishes in prebattle or active, one player never finalises). Owner cancel in postbattle then triggers BUG-09.
- **Fix:** `Battle.last_activity_at` plus a per-phase expiry policy, a lazy sweeper and `manage.py expire_stale_battles` (Render cron), decline/leave/forfeit/claim-lead endpoints, owner "End battle" and "Close postbattle" (with BUG-45).
- **Plan phase:** 3 · **Needs data fix in prod?** yes (close stuck battles)

#### BUG-11 · P1 · Postbattle kill edits are silently discarded; kill counts have three disagreeing sources
- **Sources:** BATL-BUG-04 · **Area:** Battles · **Confidence:** Confirmed
- **What happens:** the postbattle Kills stepper saves `unit_results.kill_count`, but finalisation adds the live counter. Pivotal moments use the edited value. Kill history lists kill events from cancelled battles (battles 5-8 locally), and `/config/` accepts `kill_count` up to 9999 in any phase.
- **Fix:** make events authoritative (postbattle adjustments become events, revive `_apply_kill_aggregation`, kill history filters `status=ended`). Minimal fix: take `max(live, edited)` at `shared.py:1734`.
- **Plan phase:** 3 · **Needs data fix in prod?** check (kill totals vs events)

#### BUG-12 · P1 · Owner's "Kick" always fails with 403
- **Sources:** CAMP-BUG-01 · **Area:** Campaigns · **Confidence:** Confirmed
- **What happens:** Kick calls `DELETE /warbands/:id/`, which only the warband's own user may call, so the owner always sees "Forbidden" and has no way to remove an abandoned warband.
- **Fix:** decide what Kick means (CAMP-UX-02): either let the owner or `manage_warbands` delete (spelling out the cascade into battle history) or remove the button. Add an API test.
- **Plan phase:** 4 · **Needs data fix in prod?** no

#### BUG-13 · P1 · Admins are offered "Start campaign" but the backend only allows the owner
- **Sources:** CAMP-BUG-02 · **Area:** Campaigns · **Confidence:** Confirmed
- **What happens:** the button shows for owner and admin, but the PATCH requires `is_owner`, so admins (often the person running the session) hit "Forbidden".
- **Fix:** allow admins to set `in_progress`, or gate the button to the owner. Add a test either way.
- **Plan phase:** 4 · **Needs data fix in prod?** no

#### BUG-14 · P1 · Starting the campaign doesn't stick; the button comes back after navigating away
- **Sources:** CAMP-BUG-03 · **Area:** Campaigns · **Confidence:** Confirmed
- **What happens:** the PATCH response never reaches `setCampaign`, so after any navigation "Start campaign" reappears and "Start battle" disappears until a full reload. The flag lives in two places that drift.
- **Fix:** call `setCampaign(updated)` and derive `campaignStarted` from `campaign.in_progress`.
- **Plan phase:** 4 · **Needs data fix in prod?** no

#### BUG-15 · P1 · Permission codes have drifted: some can never be granted, and catalogue Edit buttons lie
- **Sources:** CAMP-BUG-04 (P1), CAT-BUG-04 (P2) · **Area:** Campaigns / Catalogue · **Confidence:** Confirmed (DB and code)
- **What happens:** the backend checks `manage_spells` and `manage_features`, which exist nowhere (DB has 8 codes; the grant API drops unknown codes), so only owner/admin can edit custom spells and specials. The members UI can't grant `manage_encampments` or `manage_bestiary`; the seed command misses `manage_encampments`. Creating needs `add_custom` but editing needs `manage_*`, so players can't fix their own typos. Skills and Spells show Edit to everyone, who then get a 403. Races use yet another gate.
- **Fix:** one constants module plus a data migration seeding every code; drive `MembersCard` from `GET /permissions/`; gate Edit buttons on the code the backend checks; consider `add_custom` covering edit of your own entries; a test that every checked code exists.
- **Plan phase:** 4 (codes, seed, members UI) + 5 (catalogue Edit gates) · **Needs data fix in prod?** yes (seed the missing permission rows)

#### BUG-16 · P1 · Deleting a custom catalogue entry silently deletes it from every warband in the campaign
- **Sources:** CAT-BUG-01 · **Area:** Catalogue · **Confidence:** Confirmed (FKs and delete paths read; not executed)
- **What happens:** owned rows reference catalogue rows with `CASCADE`. Any manager deleting a custom item, skill, spell or special removes every owned copy across the campaign, with no refund, ledger entry or notice. House-rule stale-clone cleanup and `seed_items --truncate` do the same. Locally, deleting the custom Axe would delete two stash rows worth 25 gc each.
- **Fix:** `on_delete=PROTECT` and a 409 listing usages (or an `archived` flag); usage counts in the confirm dialog; guard `--truncate`.
- **Plan phase:** 5 · **Needs data fix in prod?** no (preventive), but land it before any catalogue cleanup in production

#### BUG-17 · P1 · `seed_all` is not idempotent once campaigns have custom or house-rule rows
- **Sources:** CAT-BUG-02 · **Area:** Catalogue · **Confidence:** Confirmed (code plus 14 colliding pairs in the DB)
- **What happens:** the seeders upsert on name and type without `campaign IS NULL`, so they crash with `MultipleObjectsReturned` or overwrite a campaign's custom row. No transaction, so a crash leaves partial state with availabilities recreated under new ids. Caches keyed across campaigns can link junk global restrictions (SEC-06) to base items.
- **Fix:** `campaign__isnull=True` in every lookup and cache, `transaction.atomic()` per seeder, and a seed-twice test with an override present (CAT-TEST-12).
- **Plan phase:** 5 · **Needs data fix in prod?** no, but it blocks every catalogue data fix (BUG-54): don't run `seed_all` on production until fixed

#### BUG-18 · P1 · Custom entries silently override base entries campaign-wide, by name only, and any player can create them (the "Axe 25 gc" case)
- **Sources:** CAT-BUG-03 (P1), ECON-BUG-14 (P2); NOTES live run · **Area:** Catalogue / Economy · **Confidence:** Confirmed (data and code)
- **What happens:** list views hide every base row whose name matches a campaign row, ignoring type (a custom "Infiltration" would hide 6 base skills). Every player gets `add_custom` on join, so anyone can reprice an item for the whole campaign, unrecorded, and can't undo it. Owned copies keep the base id and price, recruit and "Buy again" still charge the base price, and the stash shows two identical "Axe" rows, one selling for 0.
- **Fix:** explicit overrides (an `overrides` FK, or match on name and type); require `manage_*` to collide with a base name; `created_by`/`created_at`; resolve buy-again and recruit pricing through the campaign catalogue; label overrides. Product decision on the default `add_custom`.
- **Plan phase:** 5 (with pass 2 for buy-again and recruit pricing) · **Needs data fix in prod?** yes (decide per existing override)

### P2

| ID | Title | Sources | Area | Confidence | Plan phase |
| --- | --- | --- | --- | --- | --- |
| BUG-19 | Realtime has no connection-state handling or reconnect catch-up; battle pages stay stale after a phone sleeps ("Battle is not active") | FE-BUG-04, BATL-BUG-07 | Platform / Battles | Likely (FE), Confirmed (BATL) | 0 (shared realtime client) + 3 (`useBattleState`) |
| BUG-20 | Notification and chat actions fail silently; a failed chat send loses the typed message; a failed history load shows "No messages yet" | FE-BUG-03, CAMP-BUG-08; related CAT-UX-04, ECON-UX-05 | Platform / Campaigns | Confirmed | 0 (menus, error feedback) + 4 (chat) |
| BUG-21 | An access-token refresh, in any tab, unmounts the whole app and refetches everything (unsaved forms lost) | AUTH-BUG-02 | Auth | Confirmed | 0 (0.5); must land before SEC-05 shortens token lifetime |
| BUG-22 | Signing out leaves the previous user's notifications, battle/trade sessions and caches in memory for the next user | AUTH-BUG-03 | Auth | Confirmed | 0 (0.5) |
| BUG-23 | Crossing 960 px (tablet rotation, window resize) remounts the whole campaign page | FE-BUG-01 | Platform | Confirmed | 0 |
| BUG-24 | The layout resets page overrides of the mobile top bar, so Warband edit mode loses Save/Cancel; currently masked by ROST-PERF-07's effect loop | FE-BUG-02; related ROST-PERF-07 | Platform | Likely | 0, re-verify in pass 1 |
| BUG-25 | `wait_for_db.py` ignores `DATABASE_URL` and never times out (Docker deploy with only `DATABASE_URL` hangs at boot) | INFRA-BUG-02 | Infrastructure | Confirmed (code) | 0 (0.1) |
| BUG-26 | Realtime events (`trade_accepted`, `battle_prebattle_opened`) navigate users away mid-edit, discarding unsaved work (*filed as UX*) | FE-UX-04 | Platform | Confirmed | 0 |
| BUG-27 | Editing XP down and back up awards the same level-ups again | ROST-BUG-03 | Roster | Confirmed | 1 |
| BUG-28 | Lad's Got Talent keeps the group's level-up; the promotion is a non-atomic 3-4 request chain that duplicates heroes on retry | ROST-BUG-04 | Roster | Likely | 1 |
| BUG-29 | Hero cap counts dead heroes on the server but living ones in the UI; `ignore_max_heroes` lets any client skip it | ROST-BUG-05; related ROST-UX-06 | Roster | Confirmed | 1 |
| BUG-30 | Creating a leader hero demotes the old leader in the DB at once; Cancel leaves two crowns | ROST-BUG-06 | Roster | Likely | 1 |
| BUG-31 | Edit affordances shown to non-editors (Trade badge, XP +/-, pending skill/spell dialogs) fail with silent 403s; Backstory is gated too tightly | ROST-BUG-07 (P2), ECON-BUG-17 (P3); NOTES live run | Roster | Confirmed | 1 |
| BUG-32 | Racial stat maximums are displayed but never enforced | ROST-BUG-08 | Roster | Confirmed | 1 |
| BUG-33 | Henchmen XP bar ignores half-rate | ROST-BUG-09 | Roster | Confirmed | 1 |
| BUG-34 | "Create" spends gold immediately and Cancel doesn't undo it; Dismiss deletes without refund; switching tabs silently discards edits (*filed as UX*) | ROST-UX-01 | Roster | Confirmed | 1 |
| BUG-35 | "Accept" isn't tied to the offer the user saw | ECON-BUG-05 | Economy | Confirmed | 2 |
| BUG-36 | Concurrent sells or moves double-credit gold or duplicate items; concurrent first stash insert returns 500 | ECON-BUG-06 | Economy | Likely | 2 |
| BUG-37 | Four disagreeing gold calculations and a mixed sign convention in `warband_trades`; the acquire dialog overstates spendable gold | ECON-BUG-07 | Economy | Confirmed | 2 |
| BUG-38 | Treasury shows grouped purchases as income | ECON-BUG-08 | Economy | Confirmed | 2 |
| BUG-39 | Moving an item to a different unit type corrupts the client-side roster | ECON-BUG-09 | Economy | Confirmed | 2 |
| BUG-40 | Trade offers value items at 0 and traded items lose their cost (resell for 0) | ECON-BUG-10 (P2), CAT-BUG-10 (P3) | Economy | Confirmed | 2 |
| BUG-41 | Any failure during trade completion leaves the trade stuck at "both accepted" | ECON-BUG-11 | Economy | Confirmed | 2 |
| BUG-42 | The trade dialog reverts the user's own in-flight edits | ECON-BUG-12 | Economy | Confirmed | 2 |
| BUG-43 | The trade dialog opens on another player's warband page with that warband's data | ECON-BUG-13 | Economy | Likely | 2 |
| BUG-44 | Lost updates: config autosaves overwrite kills/OOA; stale refetches overwrite fresh state | BATL-BUG-06 | Battles | Likely | 3 |
| BUG-45 | Invitees can't decline and participants can't leave; a cancelled participant blocks start | BATL-BUG-08 | Battles | Confirmed | 3 |
| BUG-46 | Reported-result approval is only reachable from the notification; "Clear" strands the request | BATL-BUG-09; related FE-UX-07 | Battles | Confirmed | 3 |
| BUG-47 | Serious injuries are logged on every draft save, never reverted, never applied | BATL-BUG-10 | Battles | Confirmed | 3 |
| BUG-48 | On mobile, the postbattle back arrow skips postbattle permanently (*filed as UX*) | BATL-UX-01 | Battles | Confirmed | 3 |
| BUG-49 | Join race: the seat limit can be exceeded, and a concurrent double join returns 500 | CAMP-BUG-05 | Campaigns | Confirmed (code) | 4 |
| BUG-50 | Removing a member orphans their battles, trades, notifications and encampment ownership | CAMP-BUG-06 | Campaigns | Confirmed | 4 |
| BUG-51 | House-rule clones: editable and deletable (cascading owned items), stale cleanup deletes owned items, purchase cost overwritten, no uniqueness, never refreshed, ids churn | CAMP-BUG-07 (P2), CAT-BUG-08 (P3) | Campaigns / Catalogue | Confirmed | 4 (+5 seeder re-sync) |
| BUG-52 | "Common Rules" partial failures cause duplicate rules; concurrent adds create duplicate clone sets | CAMP-BUG-09 | Campaigns | Confirmed / Likely (race) | 4 |
| BUG-53 | Catalogue writes aren't atomic and nested input is unvalidated: partial rows, orphan hired-sword entries, 500s | CAT-BUG-05 | Catalogue | Confirmed | 5 |
| BUG-54 | Catalogue data errors: Giant Spider has S0; 14 seeded links dropped (Dark Mage has no spells) | CAT-BUG-06 | Catalogue | Confirmed | 5 (after BUG-17) |
| BUG-55 | Per-IP auth limits lock out a table of players sharing one IP (4th sign-up gets 429) | AUTH-BUG-04 | Auth | Likely | 6 |
| BUG-56 | Password reset reports success when no email can be sent; email settings fall back to placeholders | AUTH-BUG-05 | Auth | Confirmed (code), Speculative (prod values) | 6 (env check in Phase 0) |

### P3

| ID | Title | Sources | Area | Confidence | Plan phase |
| --- | --- | --- | --- | --- | --- |
| BUG-57 | Pusher channel auth uses the token captured at socket creation; channels silently drop after 24 h | AUTH-BUG-08 | Auth | Likely | 0 (shared realtime client) |
| BUG-58 | `ScrollToTop` is a no-op; new pages open at the previous page's scroll offset | FE-BUG-05 | Platform | Confirmed | 0 |
| BUG-59 | The API layer has no abort, no timeout and no stale-response guard | FE-BUG-06 | Platform | Likely | 0 (0.5) |
| BUG-60 | The "Mordheim" display font is hot-linked from a third-party site and returns 404 | FE-BUG-07 | Platform | Confirmed | 0 |
| BUG-61 | Pull-to-refresh `preventDefault()` is ignored (passive listener) | FE-BUG-08 | Platform | Likely | 0 |
| BUG-62 | Hero and hired-sword level-up accept any advance and can double-spend | ROST-BUG-10 | Roster | Confirmed | 1 |
| BUG-63 | Leader uniqueness is best-effort; stale XP saves move the crown back and overwrite fields | ROST-BUG-11 | Roster | Likely / Speculative | 1 |
| BUG-64 | Hero edits can't be saved when no hero is marked leader, including an empty list | ROST-BUG-12 | Roster | Confirmed | 1 |
| BUG-65 | Heroes created during an edit session earn level-ups for seeded XP | ROST-BUG-13 | Roster | Confirmed | 1 |
| BUG-66 | The default hire cost for a new henchman charges for the whole group's items | ROST-BUG-14 | Roster | Likely | 1 |
| BUG-67 | Group size and unit limits are client-side only; `max_units` defaults to 0 | ROST-BUG-15 | Roster | Confirmed | 1 |
| BUG-68 | Resource updates send absolute values; resource sale is two non-atomic requests | ECON-BUG-15 | Economy | Confirmed / Likely (race) | 2 |
| BUG-69 | Trade expiry is lazy; notifications go stale; traders stay spent; close errors are swallowed | ECON-BUG-16; related ECON-UX-01 | Economy | Confirmed | 2 |
| BUG-70 | Buying a rare item can record the wrong quantity in the ledger and log | ECON-BUG-18 | Economy | Confirmed | 2 |
| BUG-71 | Exploration is client-only, lost on reload, and weakly validated | BATL-BUG-11 | Battles | Confirmed | 3 |
| BUG-72 | Single-use item edge cases: ownership unvalidated, used items kept on skip | BATL-BUG-12 | Battles | Confirmed | 3 |
| BUG-73 | Live rosters drift mid-battle and can make finalisation impossible | BATL-BUG-13 | Battles | Likely | 3 |
| BUG-74 | Prebattle "unready on exit" fires on dependency changes, not just unmount | BATL-BUG-14 | Battles | Likely | 3 |
| BUG-75 | Self-events are ignored per user, so a user's second device never updates | BATL-BUG-15 | Battles | Confirmed | 3 |
| BUG-76 | Campaign multi-step writes aren't atomic; bad create-time numbers leave an orphan campaign after a 500 | CAMP-BUG-10 | Campaigns | Confirmed | 4 |
| BUG-77 | `in_progress` is enforced only by the UI; the start text overstates it | CAMP-BUG-11 | Campaigns | Confirmed | 4 |
| BUG-78 | Changing starting gold rewrites the oldest ledger row in every warband, unlogged | CAMP-BUG-12 | Campaigns | Confirmed | 4 |
| BUG-79 | A non-numeric `campaign_id` returns 500 on every catalogue list | CAT-BUG-07 | Catalogue | Confirmed | 5 |
| BUG-80 | The client catalogue cache never reconciles overrides or other members' changes | CAT-BUG-09 | Catalogue | Confirmed | 5 |
| BUG-81 | Hired Swords page sorts React state in place | CAT-BUG-11 | Catalogue | Confirmed | 5 |
| BUG-82 | Custom races can be created by any member without a permission check, and never deleted | CAT-BUG-12 | Catalogue | Confirmed | 5 |
| BUG-83 | `password-reset-confirm` returns 500 for a malformed uid | AUTH-BUG-06 | Auth | Confirmed | 6 |
| BUG-84 | Register returns 500 for an over-long alias or email, or two simultaneous same-email sign-ups | AUTH-BUG-07 | Auth | Confirmed / Likely (race) | 6 |
| BUG-85 | Henchman hire cost uses 2 x decimal XP (half-rate XP gives e.g. 41.5 gc), then the ledger silently truncates it with `int()`. Rules question: should fractional XP count toward hire cost? (`warbands/views/henchmen.py` `_calculate_henchman_hire_cost`, `utils/trades.py` `normalize_price`) | Found during Phase 0 mypy cleanup | Roster | Confirmed (code) | 1 |
| BUG-86 | After moving an item to a unit of another kind (hero -> henchmen group etc.), the target kind's list isn't refreshed, so the receiving card shows stale items until reload (pre-existing; the wrong-list half was fixed in Phase 0) | Found during Phase 0 tsc cleanup | Roster | Confirmed (code) | 1 |
| BUG-87 | Henchmen and hired-sword edit-saves send `armour_save` as a string while the create paths send a number | Found during Phase 0 tsc cleanup | Roster | Confirmed (code) | 1 |
| BUG-88 | PATCH on a henchmen group or hired sword with `large` or `caster` but no `special_ids` returns 500 (it reaches a hero-only helper) | Pass 1 characterisation (expected-failure test) | Roster | Confirmed | 1 |
| BUG-89 | Level-up with a non-object `payload` returns 500 for all three unit kinds | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-90 | A henchman with `name: null` returns 500 on group create and PATCH | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-91 | POST `heroes/` with a JSON array body returns 500 | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-92 | A dead henchman sent back with its id is duplicated | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-93 | A henchman member id sent as a string is deleted, recreated and charged again | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-94 | Fields missing from a henchman member entry are reset (e.g. kills drop to 0) | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-95 | The hero and henchmen XP-threshold parsers disagree on values like `3.0` | Pass 1 characterisation | Roster | Confirmed | 1 |
| BUG-96 | A henchman hire `cost` of `"inf"` (or a number that overflows) returns 500; a huge finite cost (1e10) overflows `WarbandTrade.price` after the member is already created, because the view isn't atomic | Pass 1 PR A | Roster | Confirmed | 1 (fixed in PR A part 2: a 400, and the hire is atomic) |
| BUG-97 | A thresholds setting stored as a non-list (e.g. an int set through Django admin) makes PATCH `xp` and postbattle return 500: `normalize_*` raises `TypeError`, `resolve_*` catches only `ValueError` | Pass 1 PR A | Roster | Confirmed (only reachable outside the API) | 1 (fixed in PR A part 2: falls back to the default table) |
| BUG-98 | The level-up dialog refetches the unit in a loop (about one GET per round trip while open) when the unit has no race or the fetch fails (`hooks/levelup/useHeroLevelUp.ts:67-75`, `useHiredSwordLevelUp.ts:65-73`, `useHenchmenLevelUp.ts:110-118`) | Pass 1 frontend characterisation (pinned test) | Roster | Confirmed (test) | 1 (PR C, `useUnitLevelUp`) |
| BUG-99 | Confirming a trade on the expanded hero card reports the update twice (`HeroExpandedCard.tsx:75-77`) | Pass 1 frontend characterisation | Roster | Confirmed (test) | 1 (PR C) |
| BUG-100 | A hired sword created from a preset loses its armour save: the create sends `null`, the form keeps the preset value, so Save never sends it (`WarbandHiredSwordsSection.tsx:165`, `:182`) | Pass 1 frontend characterisation | Roster | Confirmed (test) | 1 (PR C, with BUG-87) |
| BUG-101 | Hero and hired-sword creates store `available_skills` in the legacy checkbox dict, while every save sends a list (`routes/Warband.tsx:234`, `WarbandHiredSwordsSection.tsx:171`) | Pass 1 frontend characterisation | Roster | Confirmed (code) | 1 (PR C) |
| BUG-102 | A blood-pacted hired sword can't be added at the hired-sword cap: the add form has no blood-pact option, so the exemption is unreachable (`useHiredSwordCreationForm.ts:54-55`). Workaround: create, then tick the pact | Pass 1 frontend characterisation | Roster | Confirmed (test) | 1 (PR C, ROST-TWEAK-05) |
| BUG-103 | Trait specials (Large, Wizard, Priest) are looked up by name across every campaign; when several campaigns define "Large", whichever row comes last wins (`serializers/heroes.py` `get_trait_specials`) | Pass 1 PR A part 2 | Roster / Catalogue | Confirmed (code) | 1 (PR B moves it into the shared loadout service; the global-vs-override rule is pass 5) |
| BUG-104 | A unit `items` entry with no `id`, or a non-numeric one, returns 500 (`_build_item_join_rows`) | Pass 1 PR A part 2 | Roster | Confirmed (code) | 1 (PR C) |
| BUG-105 | Hero and hired-sword caps are checked outside the create transaction, so two simultaneous creates can both pass | Pass 1 PR A part 2 | Roster | Likely | 1 (PR C, with BUG-29 and decision 12) |
| BUG-106 | Postbattle finalisation writes heroes before taking the warband lock, the opposite order to the roster paths; a leader PATCH on the same hero at the same moment can deadlock (Postgres aborts one request) | Pass 1 PR A part 2 | Battles | Speculative (code) | 3 |
| BUG-107 | Stash Move targets, Buy again and the acquire dialog use the app store's warband (always your own), not the one on screen: an admin moving an item on another player's warband gets a 404 and BUG-06 destroys the item; Buy again in another warband's stash charges the admin's own (`StashItemList.tsx`, `UnitItemDialogs.tsx`, `useAcquireItemDialogShared.tsx`). Same cause: Buy again on another player's unit card silently does nothing, and a user with no warband of their own (e.g. a campaign admin) can't buy, give or move anything; the only hint is "Not enough gold crowns." in a hover tooltip. *Severity P2 (data loss), listed here with the later finds* | Pass 2 brief research; frontend characterisation | Economy | Confirmed (tests) | 2 |
| BUG-108 | An item taken from the stash for a new henchman leaves the stash through a separate DELETE after the roster batch, so the two can disagree if the second fails (pass 1 made the retry safe; the server half is pass 2's purchase endpoint) | Pass 2 brief research | Economy | Confirmed (code) | 2 |
| BUG-109 | The server accepts a dead hero as a trade's trader (`trades/views.py` filters `not_dismissed`, not `on_roster`) | Pass 2 brief research | Economy | Confirmed (code) | 2 |
| BUG-110 | A purchase into the stash is logged as a hero item, so Logs read "Stash received: …" (`useAcquireItemDialogShared.tsx:857-859, 884-889`) | Pass 2 frontend characterisation | Economy | Confirmed (test) | 2 |
| BUG-111 | A Save's purchase group header names only the first unit that bought something (`pending-purchases.ts:141`) | Pass 2 frontend characterisation | Economy | Confirmed (test) | 2 |
| BUG-112 | The acquire and trade dialogs have no accessible description, and the unit card's item menu button has no name (`LoadoutEntryRow.tsx:64-77`) | Pass 2 frontend characterisation | Economy / a11y | Confirmed (test) | 2 |
| BUG-113 | Opening a trade from `?trade=` reads the trade request twice (`useWarbandTradeSession.ts:109-138, 225-254`) | Pass 2 frontend characterisation | Economy / perf | Confirmed (test) | 2 |
| BUG-114 | Any number of pending trade requests can exist between the same two players (`trades/views.py:360`) | Pass 2 backend characterisation | Economy | Confirmed (test) | 2 |
| BUG-115 | A sender cancelling their own trade request is stored as "declined" (`trades/views.py:705`) | Pass 2 backend characterisation | Economy | Confirmed (test) | 2 |
| BUG-116 | Every campaign member sees every trade in the campaign trade list, offers included, although the detail view answers 404 to non-participants (`trades/views.py:284`) | Pass 2 backend characterisation | Economy / privacy | Confirmed (test) | 2 |
| BUG-117 | The stash re-prices copies: copies of different cost collapse to the oldest copy's cost, and `POST items/` without a cost overwrites the row's cost (`item_moves.py:85, :103`) | Pass 2 backend characterisation | Economy | Confirmed (test) | 2 |
| BUG-118 | Any late write (offer, lock, a GET's expiry check) turned a completed or declined trade into "expired"; expiry now applies only to pending and accepted trades | Pass 2 PR A | Economy | Confirmed; **fixed** | 2 |
| BUG-119 | Clearing a trade-request notification declined the trade with an unlocked read-modify-write, so an accept at the same moment could be overwritten (`notifications/views.py` `_clear_trade_request`) | Pass 2 PR A | Economy | Confirmed; **fixed** | 2 |
| BUG-120 | Confirming "Cancel Trade" never closed the confirmation, so it reopened over the player's next trade | Pass 2 PR A browser check | Economy | Confirmed; **fixed** | 2 |
| BUG-121 | Clearing a reported-result notification declines the result without a lock, so a same-user Approve at the same moment can leave the result applied on a battle that then shows as cancelled (`notifications/views.py` battle-result clear path) | Pass 3 brief research | Battles | Confirmed (reproduced by a two-thread test) | 3 |
| BUG-122 | Heroes' trading actions are reset twice when a battle finishes (`battles/views/combat.py` and again in `shared.py` finalisation) | Pass 3 brief research | Battles | Confirmed (code) | 3 |
| BUG-123 | A malformed armour-save override is accepted mid-battle but only parsed at finalise, so finalising answers 400 (`battles/views/shared.py`) | Pass 3 brief research | Battles | Confirmed (code) | 3 |
| BUG-124 | A finalise that answers 400 part-way keeps what it already wrote, so a retry doubles XP, shards and upkeep: the 400 is returned from inside `transaction.atomic()`, so earlier writes commit (`battles/views/combat.py:458-466`; triggers: a find with no cost, a BUG-123 typo, a dismissed unit, a henchmen mismatch). *Severity P2 (gold and XP), listed here with the later finds* | Pass 3 backend characterisation | Battles | Confirmed (test) | 3 |
| BUG-125 | Battle config stores `out_of_action: "no"` as true (`shared.py:835`), and a non-numeric `declared_rating` answers with Python's `int()` message (`lifecycle.py:590`) | Pass 3 backend characterisation | Battles | Confirmed (test) | 3 |
| BUG-126 | Battle and notification dialogs have no accessible description (`ActiveKillDialog.tsx`, `BattleActive.tsx`, `PrebattleDialogs.tsx`, `NotificationsMenu.tsx`) | Pass 3 frontend characterisation | Battles / a11y | Confirmed (test) | 3 |
| BUG-127 | Postbattle fetches the warband's resources itself on every mount although the warband sheet already has them (`BattlePostbattle.tsx:451-466`) | Pass 3 frontend characterisation | Battles / perf | Confirmed (test) | 3 |
| BUG-128 | A unit's wounds stick at 0 after a kill, OOA, note or stat change in battle: `Number(null)` read as 0 wounds, so − was disabled | Pass 3 browser check | Battles | Confirmed; **fixed, hotfixed to production** (`58358e7`) | 3 |
| BUG-129 | A chat message whose `body` isn't a string is stored as its Python repr (`{"body": ["hello", 2]}` → `"['hello', 2]"`) | Pass 4 backend characterisation | Campaigns | Confirmed (test); **fixed** | 4 |
| BUG-130 | Units reference their race with CASCADE (`heroes.py:9-15`, `henchmen.py:9-15`, `hired_swords.py:9-15`), so `seed_races --truncate` or any race delete removes every unit of that race | Pass 5 brief research | Catalogue | Confirmed (test) | 5 |
| BUG-131 to BUG-139 | Not assigned (the pass 6 brief started at BUG-140) | | | | |
| BUG-140 | A wiped database reuses user ids, and tokens are checked by `user_id` alone, so a token issued before a wipe signs in as whichever new account gets that id. **P2.** Until pass 6's session key lands, rotate `DJANGO_SECRET_KEY` whenever production is wiped | Pass 6 brief research | Auth | Confirmed (code) | 6 |
| BUG-141 | A retried request that still gets a 401 after a successful refresh throws but keeps the tokens, so every later request repeats refresh and retry until a reload (`api-client.ts:190-203`) | Pass 6 brief research | Auth | Confirmed (code) | 6 |
| BUG-142 | Campaign dialogs (Join, Create, Roster, the delete confirms, Chat, Common Rules) have no accessible description | Pass 4 frontend characterisation | Campaigns / a11y | Confirmed (test); **fixed** | 4 |
| BUG-143 | The join code showed to every member in Settings but only to the owner on the campaigns list. Decision 1b: every member sees it in both places | Pass 4 frontend characterisation | Campaigns | Confirmed (test); **fixed** | 4 |
| BUG-144 | A campaign that fails to load is a dead end: a bare red line with no Retry and no way back (`CampaignLayout.tsx:343-351`) | Pass 4 frontend characterisation | Campaigns / UX | Confirmed (test); **fixed** | 4 |
| BUG-145 | A new item property is saved as a book property, so every campaign lists it, and it feeds `seed_items`' unscoped cache (`items/views.py:244`, `items/serializers.py:152-163`) | Pass 5 backend characterisation | Catalogue | Confirmed (test) | 5 |
| BUG-146 | `bestiary_entry_id` on an item create or edit is always a 500: a raw id is handed to the relation (`items/serializers.py:117-119`); latent, no frontend caller | Pass 5 backend characterisation | Catalogue | Confirmed (test) | 5 |
| BUG-147 | A race edit can move the race to another campaign, or with `{"campaign": null}` into the book for every campaign (`races/views.py:77-79`, `races/serializers.py:31`). **P2** (cross-campaign write) | Pass 5 backend characterisation | Catalogue / security | Confirmed (test) | 5 |
| BUG-148 | A refused catalogue delete leaves the confirm open and writes the error into the form behind the modal, so the user sees only "This action cannot be undone" (`AddItemForm.tsx:376-394`, `ItemFormDialog.tsx:421-443` and the skill and spell forms) | Pass 5 frontend characterisation | Catalogue / UX | Confirmed (test) | 5 |
| BUG-149 | The warband pages' Add item creates a property without adding it to the cached `item-properties` list, so its tooltip reads "No description available yet." for up to 5 minutes (`ItemFormDialog.tsx:310-333`) | Pass 5 frontend characterisation | Catalogue | Confirmed (test) | 5 |
| BUG-150 | The bestiary and hired-sword detail's Back is `navigate(-1)`, so on a fresh `?entry=` / `?profile=` link it leaves the app or does nothing (`Bestiary.tsx:134`, `HiredSwords.tsx:78`) | Pass 5 frontend characterisation | Catalogue / UX | Confirmed (test) | 5 |

## By plan phase

Each pass's bug checklist. IDs marked "(part)" are shared between passes; the note says which part.

**Phase 0: Foundations**
- **0.1 production quick wins:** SEC-01, SEC-02, SEC-04 (part: `RATE_LIMIT_NUM_PROXIES` + startup assertion), SEC-16, BUG-01, BUG-25; confirm the email env vars for BUG-56.
- **0.5 TanStack Query / api-client:** BUG-02, BUG-21, BUG-22, BUG-59.
- **Platform findings handled in Phase 0:** SEC-03 (pulled forward from pass 4: S effort, live token-theft path), SEC-15, BUG-19 (part: shared realtime client), BUG-20 (part: notification menus and error feedback), BUG-23, BUG-24, BUG-26, BUG-57, BUG-58, BUG-60, BUG-61.

**Pass 1: Warband roster**
- P1: BUG-03, BUG-04
- P2: BUG-27, BUG-28, BUG-29, BUG-30, BUG-31, BUG-32, BUG-33, BUG-34
- P3: BUG-62, BUG-63, BUG-64, BUG-65, BUG-66, BUG-67, BUG-85 (decided: whole-XP hire cost), BUG-86, BUG-87
- Found by the characterisation tests (expected-failure tests mark the 500s): BUG-88, BUG-89, BUG-90, BUG-91 (500s), BUG-92, BUG-93, BUG-94 (henchmen member sync), BUG-95 (threshold parsing)
- Found during PR A, fixed in PR A part 2: BUG-96 (hire cost overflow), BUG-97 (non-list thresholds)
- Found by the frontend characterisation tests, fixed in PR C on the shared components: BUG-98 to BUG-102. Hero PATCH turning `"5+"` into null is part of BUG-87.
- Found during PR A part 2: BUG-103 (PR B / pass 5), BUG-104 and BUG-105 (PR C), BUG-106 (pass 3)
- **Status: pass 1 complete (2026-10-17).** Every pass 1 bug above is fixed except BUG-103 (pass 5) and BUG-106 (pass 3); SEC-07's unit half and SEC-14 are fixed; BUG-24 re-verified (see [Fix log](#fix-log)).
- Security: SEC-07 (part: unit serializers), SEC-14

**Pass 2: Economy and trades**
- P1: BUG-05, BUG-06, BUG-07, BUG-08; BUG-18 (part: buy-again and recruit pricing)
- P2: BUG-35, BUG-36, BUG-37, BUG-38, BUG-39, BUG-40, BUG-41, BUG-42, BUG-43
- P3: BUG-68, BUG-69, BUG-70
- Found while writing the pass 2 brief: BUG-107 (P2), BUG-108, BUG-109
- Found by the pass 2 characterisation tests: BUG-110 to BUG-117 (all P3). The trade draft also resets when the page's gold changes, which belongs to BUG-42's fix.
- Security: SEC-07 (part: stash and item writes), SEC-08 (part: trades)

**Pass 3: Battles**
- Product question (found in Phase 0): the active-battle stat-override editor has been off screen since a restyle. **Answered: restore it** (pass 3 decision 6).
- Found while writing the pass 3 brief: BUG-121, BUG-122, BUG-123 (all P3).
- Found by the pass 3 characterisation tests: BUG-124 (P2: a failed finalise keeps its earlier writes), BUG-125, BUG-126, BUG-127. A unit's buttons staying enabled while its config save is queued belongs to BUG-44's fix.
- P1: BUG-09, BUG-10, BUG-11; regression tests for BUG-03
- P2: BUG-19 (part: `useBattleState` catch-up), BUG-44, BUG-45, BUG-46, BUG-47, BUG-48
- P3: BUG-71, BUG-72, BUG-73, BUG-74, BUG-75
- Security: SEC-08 (part: battle channel auth), SEC-09, SEC-10

**Pass 4: Campaigns**
- P1: BUG-12, BUG-13, BUG-14, BUG-15 (part: codes, seed migration, members UI)
- P2: BUG-20 (part: chat), BUG-49, BUG-50, BUG-51, BUG-52
- P3: BUG-76, BUG-77, BUG-78
- Security: SEC-13; SEC-03 if it wasn't done in Phase 0
- Found by the pass 4 characterisation tests: BUG-129, BUG-142, BUG-143, BUG-144 (all P3, all fixed in pass 4).

**Pass 5: Catalogue**
- P1: BUG-15 (part: catalogue Edit gates), BUG-16, BUG-17, BUG-18
- P2: BUG-51 (part: re-sync clones from the seeder), BUG-53, BUG-54
- P3: BUG-79, BUG-80, BUG-81, BUG-82
- Security: SEC-06, SEC-07 (part: catalogue writes)
- Order inside the pass: BUG-16 before any production catalogue cleanup; BUG-17 before reseeding for BUG-54.
- Found while writing the brief: BUG-130 (P3). Found by the pass 5 characterisation tests: BUG-147 (P2), BUG-145, BUG-146, BUG-148, BUG-149, BUG-150 (P3).

**Pass 6: Auth and core**
- P2: BUG-55, BUG-56
- P3: BUG-83, BUG-84
- Security: SEC-04 (part: identity-keyed throttles, Redis), SEC-05, SEC-11, SEC-12
- Found while writing the brief: BUG-140 (P2), BUG-141 (P3).
- SEC-05's `CHECK_REVOKE_TOKEN` is S effort: if SEC-01 forces a key rotation, ship it in the same deploy so users are logged out only once.

## Production checks

Run these against the real Render/Neon deployment. All SQL is read-only (`SELECT` only); run it in the Neon SQL editor or `psql` against a branch if you prefer. Don't paste secret values into tickets.

### 1. Render environment (do first: these can be P0)

| Check | Why | Bug |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` is set, at least 50 random chars, not `dev-secret-key`. If it was ever unset, rotate it | Forgeable JWTs and reset tokens | SEC-01 |
| `DJANGO_DEBUG=0` | Public debug pages, per-request query log | SEC-02 |
| `RATE_LIMIT_NUM_PROXIES` is set (likely `1`, after checking Render's `X-Forwarded-For` format) | Otherwise every spoofed header gets a fresh throttle bucket | SEC-04 |
| `FRONTEND_URL` is the Vercel URL (not `http://localhost:5173`), `DEFAULT_FROM_EMAIL` is on a Resend-verified domain, `RESEND_API_KEY` is set. Then request a reset for your own account and confirm the link | Reset emails silently never arrive or point at localhost | BUG-56 |
| Service type and start command. If Docker, `wait_for_db.py` needs the `POSTGRES_*` vars or boot hangs; also confirms whether production runs `runserver` (INFRA-PERF-02) | Boot hang; wrong DB host | BUG-25 |
| `PUSHER_*` credentials are correct | Any Pusher error becomes a 500 after commit | BUG-01 |
| Note: with `DEBUG` off and no `LOGGING` config, 500s leave no traceback in Render's logs (INFRA-CQ-01), so BUG-01's 500s may be invisible today | Visibility | BUG-01 |

### 2. Battles

```sql
-- Open battles and how long they have been idle (BUG-10, BUG-45, BUG-46)
SELECT b.id, b.campaign_id, b.status, b.created_at, b.updated_at,
       (SELECT MAX(e.created_at) FROM battle_event e WHERE e.battle_id = b.id) AS last_event_at,
       (SELECT STRING_AGG(bp.user_id || ':' || bp.status, ', ')
          FROM battle_participant bp WHERE bp.battle_id = b.id) AS participants
FROM battle b
WHERE b.status IN ('inviting', 'prebattle', 'active', 'postbattle', 'reported_result_pending')
ORDER BY b.created_at;

-- Battles cancelled after reaching postbattle: the BUG-09 signature
SELECT b.id, b.campaign_id, b.winner_warband_ids_json, b.updated_at
FROM battle b
WHERE b.status = 'canceled'
  AND EXISTS (SELECT 1 FROM battle_event e
              WHERE e.battle_id = b.id AND e.type = 'battle_entered_postbattle');

-- Win/loss counters vs ended battles (approximates report_win_loss_drift; owners may have hand-edited counters)
WITH ended AS (
  SELECT bp.warband_id,
         COUNT(*) FILTER (WHERE b.winner_warband_ids_json @> to_jsonb(bp.warband_id))     AS won,
         COUNT(*) FILTER (WHERE NOT b.winner_warband_ids_json @> to_jsonb(bp.warband_id)) AS lost
  FROM battle b JOIN battle_participant bp ON bp.battle_id = b.id
  WHERE b.status = 'ended' AND bp.status <> 'canceled_prebattle'
  GROUP BY bp.warband_id
)
SELECT w.id, w.name, w.campaign_id,
       COALESCE(w.wins, 0) AS wins,     COALESCE(e.won, 0)  AS ended_won,
       COALESCE(w.losses, 0) AS losses, COALESCE(e.lost, 0) AS ended_lost
FROM warband w LEFT JOIN ended e ON e.warband_id = w.id
WHERE COALESCE(w.wins, 0) <> COALESCE(e.won, 0) OR COALESCE(w.losses, 0) <> COALESCE(e.lost, 0);

-- Kill events from battles that never ended, which kill history still lists (BUG-11)
SELECT b.id, b.status, COUNT(*) AS kill_events
FROM battle_event e JOIN battle b ON b.id = e.battle_id
WHERE e.type = 'unit_kill_recorded' AND b.status <> 'ended'
GROUP BY b.id, b.status ORDER BY b.id;

-- Heuristic: near-duplicate kill events, as left by retries after a false 500 (BUG-01)
SELECT battle_id, payload_json -> 'killer' ->> 'unit_id' AS killer_id,
       payload_json -> 'victim' ->> 'name' AS victim, COUNT(*), MIN(created_at), MAX(created_at)
FROM battle_event
WHERE type = 'unit_kill_recorded'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1 AND MAX(created_at) - MIN(created_at) < INTERVAL '30 seconds';

-- Serious-injury log volume per warband; draft re-rolls each add an entry (BUG-47)
SELECT warband_id, COUNT(*) FROM warband_log
WHERE feature = 'personnel' AND type = 'serious_injury'
GROUP BY warband_id ORDER BY 2 DESC;
```

### 3. Roster

```sql
-- Kill events by henchmen whose row no longer exists (BUG-04; also hits deliberately dismissed henchmen)
SELECT e.battle_id, e.created_at, e.payload_json -> 'killer' AS killer
FROM battle_event e
WHERE e.type = 'unit_kill_recorded'
  AND e.payload_json -> 'killer' ->> 'unit_type' = 'henchman'
  AND NOT EXISTS (SELECT 1 FROM henchman h
                  WHERE h.id = (e.payload_json -> 'killer' ->> 'unit_id')::int);

-- Dead henchmen still present, at risk on the next group edit until BUG-04 ships
SELECT g.warband_id, g.id AS group_id, g.name AS group_name, h.id, h.name, h.kills
FROM henchman h JOIN henchmen_group g ON g.id = h.group_id
WHERE h.dead;

-- Warbands with more than one living leader (BUG-30, BUG-63)
SELECT warband_id, COUNT(*) FROM hero WHERE is_leader AND NOT dead
GROUP BY warband_id HAVING COUNT(*) > 1;

-- Living heroes above their race maximum (BUG-32; review, some may be legitimate)
SELECT h.id, h.name, h.warband_id, r.name AS race
FROM hero h JOIN race r ON r.id = h.race_id
WHERE NOT h.dead AND (h.movement > r.movement OR h.weapon_skill > r.weapon_skill
   OR h.ballistic_skill > r.ballistic_skill OR h.strength > r.strength OR h.toughness > r.toughness
   OR h.wounds > r.wounds OR h.initiative > r.initiative OR h.attacks > r.attacks
   OR h.leadership > r.leadership);

-- Warbands created with max_units = 0, which the UI treats as full (BUG-67)
SELECT id, name, campaign_id FROM warband WHERE max_units = 0;
```

For BUG-03, list campaigns whose `campaign_settings` thresholds differ from the defaults and units with `half_rate = true`; their `level_up` and `xp` values after battles may need an owner review.

### 4. Economy and trades

```sql
-- Trade outcomes and stuck requests (BUG-05, BUG-08, BUG-41, BUG-69)
SELECT status, COUNT(*) FROM trade_request GROUP BY status;

SELECT id, campaign_id, status, from_accepted, to_accepted, created_at, expires_at
FROM trade_request WHERE status IN ('pending', 'accepted') ORDER BY created_at;

-- Living heroes with a spent trading action (reset only at battle finalise); compare with the stuck trades above
SELECT id, name, warband_id FROM hero WHERE NOT trading_action AND NOT dead;

-- Ledger sign convention: which actions are stored positive vs negative (BUG-37).
-- Expect Buy/Upkeep/Recruit/Hire negative but Bought/Trade sent positive; any other free-text action counts as income.
SELECT action, COUNT(*) AS n, SUM(price) AS total, MIN(price) AS min_price, MAX(price) AS max_price
FROM warband_trades GROUP BY action ORDER BY action;

-- Stash rows with no cost (traded items, BUG-40), which sell for 0
SELECT wi.warband_id, i.name, wi.quantity
FROM warband_items wi JOIN item i ON i.id = wi.item_id
WHERE wi.cost IS NULL;

-- Negative resource amounts, which only the UI prevents (BUG-68)
SELECT * FROM warband_resources WHERE amount < 0;
```

### 5. Catalogue

```sql
-- Campaign items hiding a base item by name (BUG-18). House-rule clones have generated_effect_key set.
-- Rows where type also matches will crash seed_all (BUG-17).
SELECT c.campaign_id, c.id AS campaign_item_id, c.name, c.type,
       b.id AS base_item_id, b.type AS base_type, c.generated_effect_key
FROM item c
JOIN item b ON b.campaign_id IS NULL AND b.name = c.name
WHERE c.campaign_id IS NOT NULL
ORDER BY c.campaign_id, c.name;

-- Same for skills and spells: name-only matching also hides other types
SELECT 'skill' AS kind, c.campaign_id, c.name, c.type, COUNT(b.id) AS base_rows_hidden
FROM skill c JOIN skill b ON b.campaign_id IS NULL AND b.name = c.name
WHERE c.campaign_id IS NOT NULL GROUP BY 1, 2, 3, 4
UNION ALL
SELECT 'spell', c.campaign_id, c.name, c.type, COUNT(b.id)
FROM spell c JOIN spell b ON b.campaign_id IS NULL AND b.name = c.name
WHERE c.campaign_id IS NOT NULL GROUP BY 1, 2, 3, 4;

-- Stash copies still pointing at a shadowed base item (repeat via hero_item, henchmen_group_item, hired_sword_item)
SELECT w.campaign_id, wi.warband_id, wi.item_id, b.name, wi.cost, wi.quantity
FROM warband_items wi
JOIN warband w ON w.id = wi.warband_id
JOIN item b ON b.id = wi.item_id AND b.campaign_id IS NULL
WHERE EXISTS (SELECT 1 FROM item c
              WHERE c.campaign_id = w.campaign_id AND c.name = b.name
                AND c.generated_effect_key IS NULL);

-- Duplicate house-rule clones and rules (BUG-51, BUG-52)
SELECT campaign_id, source_item_id, generated_effect_key, COUNT(*)
FROM item WHERE generated_effect_key IS NOT NULL
GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;

SELECT campaign_id, effect_key, COUNT(*) FROM campaign_house_rule
WHERE effect_key IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- User-created global restrictions (SEC-06): duplicates, and a total to compare with backend/apps/restrictions/data/restrictions.json
SELECT restriction, type, COUNT(*) FROM restriction
WHERE campaign_id IS NULL GROUP BY restriction, type HAVING COUNT(*) > 1;
SELECT COUNT(*) FROM restriction WHERE campaign_id IS NULL;

-- Seed data errors (BUG-54)
SELECT id, name, strength, attacks FROM bestiary_entry WHERE name = 'Giant Spider';
SELECT be.id, be.name, COUNT(bs.id) AS spells
FROM bestiary_entry be LEFT JOIN bestiary_entry_spell bs ON bs.bestiary_entry_id = be.id
WHERE be.name ILIKE '%Dark Mage%' GROUP BY be.id, be.name;
```

### 6. Campaigns, permissions and content

```sql
-- Existing XSS payloads in location content (SEC-03). Scrub before or with the sanitiser.
SELECT id, campaign_id, name, LEFT(content, 200) AS preview
FROM campaign_location
WHERE content ~* '(<script|<iframe|<object|<embed|<svg|javascript:|\son[a-z]+\s*=)';

-- Permission codes present (BUG-15): manage_spells and manage_features are expected to be missing
SELECT code FROM campaign_permission ORDER BY code;

-- Orphan campaigns left by a failed create (BUG-76)
SELECT c.id, c.name FROM campaign c
LEFT JOIN campaign_settings s ON s.campaign_id = c.id WHERE s.id IS NULL;

-- Campaigns over their seat limit (BUG-49)
SELECT s.campaign_id, s.max_players, COUNT(m.id) AS members
FROM campaign_settings s JOIN campaign_membership m ON m.campaign_id = s.campaign_id
GROUP BY s.campaign_id, s.max_players HAVING COUNT(m.id) > s.max_players;

-- Ghost warbands whose owner is no longer a member, and notifications for deleted campaigns (BUG-50)
SELECT w.id, w.name, w.campaign_id, w.user_id FROM warband w
WHERE NOT EXISTS (SELECT 1 FROM campaign_membership m
                  WHERE m.campaign_id = w.campaign_id AND m.user_id = w.user_id);

SELECT COUNT(*) FROM notification n
WHERE NOT EXISTS (SELECT 1 FROM campaign c WHERE c.id = n.campaign_id);
```

### 7. What a production data fix will probably need

- **Battles:** close stuck battles (BUG-10); owner-reviewed win/loss corrections from the drift report (BUG-09).
- **Trades:** expire or close stuck `accepted` and `pending` trades and restore spent trading actions (BUG-05, BUG-08, BUG-69).
- **Permissions:** a data migration seeding every permission code (BUG-15).
- **Catalogue:** a per-override decision on shadowed items and repointing of owned copies (BUG-18); corrected Giant Spider and seed links, but only after BUG-17 makes the seeders safe and BUG-16 stops deletes from cascading (BUG-54).
- **Content:** scrub any location payloads found above (SEC-03); delete user-created global restrictions (SEC-06).
- **Secrets:** rotate `DJANGO_SECRET_KEY` if it was ever unset (SEC-01).
