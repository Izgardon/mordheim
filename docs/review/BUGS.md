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

1. **SEC-01 / SEC-02:** `SECRET_KEY` falls back to `"dev-secret-key"` (signs every JWT) and `DEBUG` defaults to on. P0 if either env var is unset on Render. Check today.
2. **SEC-03:** stored XSS in campaign locations can steal members' 30-day refresh tokens from localStorage.
3. **BUG-01:** a Pusher hiccup turns committed battle, trade and chat writes into HTTP 500s; retries double-count kills.
4. **BUG-02:** any transient `/auth/me` or refresh failure logs the user out, exactly when Render is struggling.
5. **BUG-04:** saving a henchmen group hard-deletes its dead henchmen and their kill records.
6. **BUG-06:** moving an item to a dead or missing unit commits the removal and destroys the item.
7. **BUG-07:** purchases aren't atomic: unpaid items when the ledger write fails, lost or duplicated items across tabs, no server-side gold check.
8. **BUG-05:** any trade with a trader selected can never complete (local DB: 7 trade requests, 0 completed).
9. **BUG-16:** deleting a custom catalogue entry cascades and deletes it from every warband in the campaign.
10. **BUG-09 + BUG-10:** cancelling after "End battle" leaves wins/losses applied, and nothing expires abandoned battles (battle #40 has blocked two players since 2026-04-22).

Next in line: BUG-03 (postbattle XP ignores custom thresholds and half-rate), BUG-18 (any player can silently reprice a base item campaign-wide: the "Axe 25 gc" case), BUG-08 (trade lock races burn trading actions).

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

## By plan phase

Each pass's bug checklist. IDs marked "(part)" are shared between passes; the note says which part.

**Phase 0: Foundations**
- **0.1 production quick wins:** SEC-01, SEC-02, SEC-04 (part: `RATE_LIMIT_NUM_PROXIES` + startup assertion), SEC-16, BUG-01, BUG-25; confirm the email env vars for BUG-56.
- **0.5 TanStack Query / api-client:** BUG-02, BUG-21, BUG-22, BUG-59.
- **Platform findings handled in Phase 0:** SEC-03 (pulled forward from pass 4: S effort, live token-theft path), SEC-15, BUG-19 (part: shared realtime client), BUG-20 (part: notification menus and error feedback), BUG-23, BUG-24, BUG-26, BUG-57, BUG-58, BUG-60, BUG-61.

**Pass 1: Warband roster**
- P1: BUG-03, BUG-04
- P2: BUG-27, BUG-28, BUG-29, BUG-30, BUG-31, BUG-32, BUG-33, BUG-34
- P3: BUG-62, BUG-63, BUG-64, BUG-65, BUG-66, BUG-67, BUG-85 (rules question for William), BUG-86, BUG-87
- Security: SEC-07 (part: unit serializers), SEC-14
- Re-verify BUG-24 once ROST-PERF-07's effect loop is fixed.

**Pass 2: Economy and trades**
- P1: BUG-05, BUG-06, BUG-07, BUG-08; BUG-18 (part: buy-again and recruit pricing)
- P2: BUG-35, BUG-36, BUG-37, BUG-38, BUG-39, BUG-40, BUG-41, BUG-42, BUG-43
- P3: BUG-68, BUG-69, BUG-70
- Security: SEC-07 (part: stash and item writes), SEC-08 (part: trades)

**Pass 3: Battles**
- Product question (found in Phase 0): the active-battle stat-override editor has been off screen since a restyle, but `onSaveOverride` is still threaded through `ActiveUnitCard` / `ActiveHenchmenGroupCard`. Restore the editor or remove the chain?
- P1: BUG-09, BUG-10, BUG-11; regression tests for BUG-03
- P2: BUG-19 (part: `useBattleState` catch-up), BUG-44, BUG-45, BUG-46, BUG-47, BUG-48
- P3: BUG-71, BUG-72, BUG-73, BUG-74, BUG-75
- Security: SEC-08 (part: battle channel auth), SEC-09, SEC-10

**Pass 4: Campaigns**
- P1: BUG-12, BUG-13, BUG-14, BUG-15 (part: codes, seed migration, members UI)
- P2: BUG-20 (part: chat), BUG-49, BUG-50, BUG-51, BUG-52
- P3: BUG-76, BUG-77, BUG-78
- Security: SEC-13; SEC-03 if it wasn't done in Phase 0

**Pass 5: Catalogue**
- P1: BUG-15 (part: catalogue Edit gates), BUG-16, BUG-17, BUG-18
- P2: BUG-51 (part: re-sync clones from the seeder), BUG-53, BUG-54
- P3: BUG-79, BUG-80, BUG-81, BUG-82
- Security: SEC-06, SEC-07 (part: catalogue writes)
- Order inside the pass: BUG-16 before any production catalogue cleanup; BUG-17 before reseeding for BUG-54.

**Pass 6: Auth and core**
- P2: BUG-55, BUG-56
- P3: BUG-83, BUG-84
- Security: SEC-04 (part: identity-keyed throttles, Redis), SEC-05, SEC-11, SEC-12
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
