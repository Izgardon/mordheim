# Pass 6 brief: Auth and core

Step 1 of the pass loop in [PLAN.md](../PLAN.md). Full detail (repro, fix) is in [features/01-auth-core.md](../features/01-auth-core.md), with leftovers from [features/08-infrastructure-performance.md](../features/08-infrastructure-performance.md); IDs are from [BUGS.md](../BUGS.md), [PERFORMANCE.md](../PERFORMANCE.md), [IMPROVEMENTS.md](../IMPROVEMENTS.md) and [TEST_PLAN.md](../TEST_PLAN.md). Every finding was re-checked against today's code: the main checkout `pass3/refactor-frontend` @ `4ebf649` (line numbers are from here). Its auth code (`apps/users`, `apps/core`, `config`, `features/auth`, `lib/api-client.ts`, `utils/storage.ts`) is identical to `main` @ `58358e7` and to `pass4/backend-characterisation`. Pass 4 isn't built yet. This pass needs its PR A (`display_name`) and its PR C (hand-over, leave, archive) first.

**Already done (not proposed again):**
- Phase 0 settings: `DEBUG` is off unless set (`settings.py:31`); startup refuses a missing or old default `SECRET_KEY` (`:33-40`, but not a short one); HTTPS hardening (`:216-220`); `NUM_PROXIES` is read when the variable is set (`:168-170`); the access log records `xff` (`gunicorn.conf.py:35`); persistent DB connections; `wait_for_db` honours `DATABASE_URL` and times out (INFRA-BUG-02).
- Phase 0 sessions: refresh clears tokens only on a 400 or 401 (`api-client.ts:100-106`, BUG-02). Boot keeps the session on an outage, retries with back-off and shows `ConnectionErrorScreen` (`auth-store.tsx:38-54, 84-95`; `ProtectedRoute.tsx:26-28`). A refreshed token for the same user keeps the app mounted (`auth-store.tsx:113-117`, BUG-21). Sign-out clears the query cache and the socket (`:181-190`, BUG-22). Requests time out (BUG-59). Pusher channel auth reads the current token and refreshes on a 401 (`lib/realtime/client.ts:81, 127`; AUTH-BUG-08 as BUG-57).
- Phase 0 email and tests: Resend is called after commit in the background with `timeout=(3, 10)` through one `_post_to_resend` (`emails.py:14-31, 53, 105`), which covers AUTH-PERF-05 and most of AUTH-CQ-02. `NoNetworkTestRunner` blanks Resend and Pusher and blocks outbound sockets (`config/test_runner.py:40-71`, AUTH-CQ-01). Location XSS is fixed (SEC-03). Security headers are on, and the CSP is report-only (`vercel.json`, SEC-15). `getErrorMessage` turns a 429 into readable text (`lib/get-error-message.ts:74-80`).
- Pass 2: warband logs and trades are cursor-paged with composite indexes (INFRA-PERF-11). Pass 4 (planned): `display_name(user)` in players, members, chat, bulletin, encampments, battles and trades (SEC-13, characterised in `test_campaign_characterisation_names.py` on `pass4/backend-characterisation`), and the feedback card on `/campaigns` with "Thanks, report sent" (CAMP-NEW-08).

**Data is disposable** (`CLAUDE.md`): no backfills; the one new migration must run on an empty database.

**Your part:** every decision is answered (see [Decisions](#decisions-answered-by-william-2026-10-18)). The [Calls I made](#calls-i-made) were confirmed on 2026-10-19. What the agents decided along the way is under [Progress](#progress), for you to change. PR C is built on `pass6/pr-c` (2026-10-28), waiting for its two-player browser check.

## What it is today

- **Model.** `django.contrib.auth.User`, with no model of our own: `username` is the lowercased email, and `first_name` is the optional display name ("Alias").
- **Endpoints.** register, login, refresh, me (GET only), password-reset, password-reset-confirm and feedback-report (`users/urls.py:13-25`), plus `health/` and `keep-awake/` (HEAD only). SimpleJWT 5.3.1: access tokens last 1 day and refresh tokens 30 days, with no rotation and no revocation (`settings.py:172-175`).
- **Throttles.** Per IP only (`settings.py:146-156`; `throttling.py:37-39, 122-143`), stored in LocMem in each of gunicorn's 2 workers. Email is not configured in production (NOTES), so reset emails are skipped and feedback reports answer 503.
- **Frontend.** Tokens live in localStorage, and a window event syncs them into `AuthProvider` (`auth-store.tsx` 216 lines, `storage.ts` 40). `AuthCard` (322) holds sign-in, sign-up and forgot-password. `/forgot-password` (84) has no links to it. `ResetPassword` (124) and every auth page sit in `AuthShell` (104) with a YouTube background on desktop.
- **Tests.** Backend: 19 throttle tests, 6 feedback, 4 settings guards and 5 test-safety. Frontend: `auth-store` 7, `api-client` 8 and `token-user` 2. No test covers register, login, refresh, me or reset directly, or `signIn` / `signUp`.

## What's wrong

### Sessions and tokens
- **SEC-05:** nothing can end a session. Sign-out only deletes localStorage (`auth-store.tsx:181-190`), and a reset leaves every old token valid (`views.py:128-130`). Nothing renews the refresh token, so an active player still hits a hard 30-day wall. SimpleJWT's refresh never loads the user (`rest_framework_simplejwt/serializers.py:106-108`), so it mints access tokens for any user, inactive or gone.
- **BUG-140 (new, P2):** a wiped database reuses user ids. Tokens are checked by `user_id` alone (`JWTAuthentication.get_user`; `settings.py:172-175` sets no extra claim). With an unchanged `DJANGO_SECRET_KEY`, a token issued before a wipe (refresh tokens last 30 days) signs in as whichever new account gets that id.
- **BUG-141 (new, P3):** when the retried request still gets a 401 after a successful refresh, `api-client.ts:190-203` throws but keeps the tokens. Every later request repeats refresh and retry until a reload, when the boot `/me` clears the session (`auth-store.tsx:85-87`).
- **PERF-50:** boot waits for `/auth/me` before any data request (`auth-store.tsx:60, 71`; `ProtectedRoute.tsx:18-20`). Sign-in fires `/auth/me` 3 times and sign-up twice. `setToken` and `setRefreshToken` (`auth-store.tsx:152-153, 169-170`) each dispatch into a `syncToken` whose closure still holds the old token (`:105-111`), and then `signIn` hydrates again (`:155`).
- **AUTH-UX-02 / FE-UX-03:** an expired session lands on `/` with no reason and no `state.from` (`ProtectedRoute.tsx:22-24`), and sign-in always goes to `/campaigns` (`AuthCard.tsx:37-41`). Unknown URLs also redirect to sign-in (`routes.tsx:110-111`; `NotFound.tsx` is unused).

### Throttles
- **BUG-55:** register allows 3 an hour per IP, login 5 a minute and reset 3 an hour (`settings.py:147-154`), so the 4th player at a table on one Wi-Fi network can't sign up.
- **SEC-04 (rest):** `RATE_LIMIT_NUM_PROXIES` is unset in production, so the identity is the raw, spoofable `X-Forwarded-For` header. LocMem counters are per worker, capped at 300 entries (`settings.py:201-206`), and wiped on every deploy and every time a worker recycles (about every 1,000 requests, `gunicorn.conf.py:29-30`). Nothing refuses to start without the variable.

### Sign-up, reset and email
- **BUG-84:** `name` is unbounded (`serializers.py:8`), `email` has no `max_length` against the 150-character `username` column (`:10`), and `validate_email` checks before `create` inserts, with nothing in between (`:16-21, 27-34`). Long input or a double sign-up answers 500.
- **BUG-83:** the `try` in `_get_user_from_uid` covers only the decode (`views.py:41-47`), so uid `YWJj` answers 500.
- **AUTH-CQ-04 (b):** `validate_password` runs without the user (`serializers.py:23-25, 80-82`), so a password equal to your email passes.
- **BUG-56:** reset says "a reset link has been sent" (`views.py:108-110`) while `send_password_reset_email` returns False with only a warning (`emails.py:36-39`). `FRONTEND_URL` and `DEFAULT_FROM_EMAIL` fall back to localhost and example.com (`settings.py:226-228`) with no guard.
- **SEC-12:** the reset link carries `uid` and `token` in the query string (`views.py:50-55`; `ResetPassword.tsx:15-16`). **SEC-11:** register says "User already exists" (`serializers.py:16-21`), and there's no verification. Reset timing is already constant, since sending happens after commit.

### Display names (decision 2)
- The name is optional at sign-up (`serializers.py:8`; no `required` at `AuthCard.tsx:198-211`), and nothing can set it later (`MeView` is GET only, `views.py:87-91`).
- Email fallbacks pass 4 replaces: `campaigns/views.py:655, 848, 1037, 1301`, `serializers.py:280`, `realtime/services.py:92`, `battles/views/shared.py:61-65` and `trades/serializers.py:12-14`. Left over after pass 4: the ledger author is a bare `first_name` (`warbands/serializers/ledger.py:52`), and `CampaignsHeader.tsx:16` and `RemoveMemberDialog.tsx:22` fall back to the email.

### Auth pages
- `AuthCard` has 322 lines, a dead `isForgot` branch (`:54-56`) and raw error text (`instanceof Error`, `:69-75, 87-95`), errors without `role="alert"` (`:181, 270`) and a mode switch without `aria-pressed` (`:132-157`). Forgot password exists twice (`AuthCard.tsx:78-96, 164-194` and `ForgotPassword.tsx` at `routes.tsx:57-59`).
- `AuthShell` loads a `youtube.com` embed at once on every desktop auth page, reset and forgot included (`AuthShell.tsx:22, 82-101`). `.landing` is `height: 100vh; overflow: hidden` (`index.css:460-469`, `AuthShell.tsx:63`), which clips sign-up on short screens.
- The show-password toggle covers only the sign-in card's field (`AuthCard.tsx:249-256`). There's no rules hint. The reset page says the link "expires after a short time" (`ResetPassword.tsx:73`), and its form stays live after success (`:51-54`).
- The feedback card has no `maxLength` or counter, and the email subject is just "Bug" or "Feedback" (`emails.py:99-104`).

### Core and infrastructure left from Phase 0
- `health/` and `keep-awake/` run JWT auth, so a stale header gets a 401, and a GET to keep-awake gets a 405 (`core/views.py:6-17`; AUTH-PERF-04 part 1, PERF-07).
- There's no `LOGGING`: with `DEBUG` off, 500 tracebacks reach no handler (INFRA-CQ-01). The browsable API is served in production, and the unused sessions, messages and CSRF apps and middleware stay loaded (`settings.py:45-50, 72-84`; INFRA-CQ-03). CI has no `check --deploy`. The local-only Dockerfile uses `uv:latest` without `--frozen` (`Dockerfile:3, 11`; INFRA-CQ-02).
- PERF-05 is not done: the SPA calls Render cross-origin (`vercel.json` connect-src) and sends `Content-Type` on every GET (`api-client.ts:160-163`).

## What I propose for this pass

Order: characterisation tests → PR A → PR B → PR C (Planned changes).

### PR A: fixes

Decision-independent, backend
- BUG-84: `name` up to 40 characters, `email` up to 150; `create` turns an `IntegrityError` into 400 "User already exists"; login's `email` becomes a real `EmailField` (IMP-95a). BUG-83: `_get_user_from_uid` catches the lookup too. AUTH-CQ-04 (b): register, reset and the new change-password endpoint validate against the user.
- BUG-55, SEC-04: identity-keyed throttles (rates in [Calls](#calls-i-made)), keyed on the normalised email from the body. LocMem `MAX_ENTRIES` goes to 10,000. With `DEBUG` off, startup refuses to run without `RATE_LIMIT_NUM_PROXIES`, or with a `SECRET_KEY` under 50 characters (ship with the rotation, [Production checks](#production-checks)).
- BUG-56: with no `RESEND_API_KEY`, `password-reset/` answers 503 `email_unavailable` for every address and logs at ERROR. Once the key is set, startup requires real `FRONTEND_URL` and `DEFAULT_FROM_EMAIL` values. SEC-12: reset links use `#uid=…&token=…`.
- Login returns `{access, refresh, user}` like register (PERF-50's server half). `health/` and `keep-awake/` drop auth and throttles, keep-awake answers GET and HEAD with 204, and both use 0 queries. `LOGGING` sends output to stdout (`django.request` at WARNING), and production renders JSON only.

Decision-independent, frontend
- PERF-50: one `setTokens()` that notifies once; sign-in and sign-up use the returned user; the user is cached beside the tokens, so boot renders at once and revalidates `/me` in the background. BUG-141: a 401 on the retried request clears the session.
- AUTH-UX-02: redirect with `state.from` and a reason ("Your session ended. Please sign in again."), then return to that page after sign-in. FE-UX-03: `*` renders `NotFound`. The auth forms use `getErrorMessage`, with `role="alert"` and `aria-pressed`; `.landing` becomes `min-height: 100dvh; overflow-y: auto`.
- Reset: after success, "Password updated" and a Sign in button replace the form; the copy says "valid for 1 hour"; the page reads the fragment and strips it with `history.replaceState`. Feedback: `maxLength={2000}` with a counter; subject `[Mordheim] Bug from <name>: <first 60 characters>`.

Decision-driven, backend
- SEC-05, BUG-140 (decision 4): `users.UserAccount` (one-to-one, `session_key` UUID), created on login or register. Tokens carry it as `sk`. A `JWTAuthentication` subclass `select_related`s the account (still 1 query) and refuses a missing or changed key, or an inactive user. The refresh serializer checks the same (1 query) and rotates the refresh token (`ROTATE_REFRESH_TOKENS`, no blacklist). Old tokens have no `sk`, so everyone signs out once.
- `POST auth/password/` (current and new password) and `POST auth/sign-out-others/` give the user a new key and return a fresh pair for this device; reset-confirm gives a new key too (decisions 1 and 4).
- Decision 2: `name` is required at register (trimmed, 1-40 characters); `PATCH auth/me/` changes it and rewrites the stored name on the user's chat messages and bulletin notes. Anything pass 4's `display_name` hasn't covered switches to it, the ledger author included.

Decision-driven, frontend (the minimum to stay honest): store the rotated `refresh` (`api-client.ts:111` keeps only `access` today); the Alias field becomes "Display name" and is required; the one-time sign-out shows the reason above.

### PR B: refactor (no behaviour change)

Backend
- `apps/users/services/{tokens,accounts}.py` (`issue_tokens(user)`, the auth class and refresh serializer, rename and password); views at most 40 lines a method; IMP-95 (c)-(e): `filter(username=email)`, module-level imports, no hand-built token pair.
- Throttle scopes from one table instead of 20 one-line classes (`throttling.py:50-119`); one email-configured check in `emails.py`. Settings hygiene: drop the unused apps and middleware, add `check --deploy` to CI, and pin uv with `--frozen` in the Dockerfile.

Frontend
- IMP-92: `lib/session.ts` (`useSyncExternalStore`; `status: booting | authenticated | anonymous | offline`) replaces the window event and the three setters; `auth-store.tsx` shrinks to the provider.
- IMP-94: `AuthCard` under 250 lines as `LoginForm`, `RegisterForm`, `ForgotForm` and `AuthModeSwitch`, with shared `AuthField` and `PasswordInput` (`ResetPassword` reuses them).

### PR C: your decisions and Planned changes

Every row below is Agreed. AUTH-TWEAK-01 to -04 land in PR A (they fix SEC-05, SEC-13 and BUG-140). The rest build on PR B's session module and forms, in this order: the name prompt (AUTH-NEW-06), the account page (AUTH-NEW-01 to -04), the auth pages (AUTH-TWEAK-05 to -07), then deleting an account (AUTH-NEW-05, after pass 4's PR C). Only new table: `users.UserAccount` (PR A).

### Query and request targets

| Request | Today | After pass 6 | Test |
| --- | --- | --- | --- |
| Sign in / sign up (browser) | 3 / 2 `/auth/me` (traced) | 0 / 0 | AUTH-TEST-22 |
| Reload or deep link | `/auth/me` before any data request | renders from the cached user; `/me` in the background | AUTH-TEST-23 |
| `GET auth/me/`, and the identity cost of any request | 1 | 1 (user and account joined) | AUTH-TEST-08 |
| `POST auth/refresh/` | 0 (never checks the user) | 1 | AUTH-TEST-07 |
| `POST auth/login/` / `register/` | 1 / 2 | ≤ 2 / ≤ 3 | AUTH-TEST-01, -05 |
| `health/`, `keep-awake/` with a token | 1, a bad token 401, keep-awake GET 405 | 0, always 2xx | AUTH-TEST-14 |
| Password change, sign out others | none | ≤ 4 | AUTH-TEST-13 |

## Characterisation tests to write first

Backend (real JWTs, Resend mocked; known bugs pinned with their ID so they flip in PR A)
- Register, login, refresh, me: AUTH-TEST-01, -02, -05 to -08; register with no name succeeding (decision 2); a password equal to the email accepted (AUTH-TEST-03).
- 500s, as expected failures: a 151-character email or name, and two threads registering one email (BUG-84, AUTH-TEST-04, `TransactionTestCase`); uid `YWJj`, `!!!` and empty (BUG-83, AUTH-TEST-12).
- Reset: AUTH-TEST-09 to -11, the link in the query string (SEC-12); with no `RESEND_API_KEY`, the generic 200 and no send (BUG-56).
- Sessions: an access and a refresh token still working after a reset (SEC-05, AUTH-TEST-13); refresh minting an access token for an inactive user; a token for a deleted user signing in as the next user given that id (BUG-140, expected failure).
- Throttles: the 4th sign-up in an hour and the 6th sign-in in a minute from one IP answering 429 (BUG-55); with `NUM_PROXIES` unset, a rotating XFF getting a fresh bucket (SEC-04); AUTH-TEST-17 for the intended setting.
- Core: a garbage token on `health/` answering 401 and GET on `keep-awake/` answering 405 (AUTH-TEST-14); budgets at today's counts (me 1, login 1, register 2, refresh 0, health 0).

Frontend (the fake API server, `src/test/fake-api.ts`)
- `AuthProvider`: 3 `/auth/me` on sign-in and 2 on sign-up (AUTH-TEST-22); `LoadingScreen` until `/me` resolves (AUTH-TEST-23). `api-client`: a 401 on the retried request keeping the tokens (BUG-141, AUTH-TEST-21).
- Pages: `AuthCard` showing the raw throttle text (AUTH-TEST-26), sign-up without a name, the inline forgot mode; `/forgot-password` rendering; `ResetPassword` reading the query and staying live after success (AUTH-TEST-27); a logged-out deep link ending on `/campaigns` after sign-in (AUTH-TEST-28); `/nope` redirecting to `/` (FE-TEST-18); the `youtube.com` iframe on desktop for Landing and ResetPassword (decision 5); 2,001 characters accepted by the feedback card (AUTH-TEST-29).
- Manual QA: `features/01-auth-core.md` steps 1-18 (step 7 passes since Phase 0; run 11-14 locally with the send patched). E2E waits for Playwright (0.14c).

## Decisions (answered by William, 2026-10-18)

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Deleting an account | **Default A:** the user is anonymised as "Former player"; their warbands stay as retired records; campaigns they own must be handed over first (pass 4 builds hand-over). **Plus** an account settings page to change display name and password (AUTH-NEW-01 to -05). |
| 2 | Display names | **Required** at sign-up; **no prompt for existing users** (2026-10-19: data is disposable, so don't build one); every email fallback shows the name (SEC-13); "Player N" wherever a fallback is still needed, never an email (AUTH-TWEAK-01, -02, AUTH-NEW-06). |
| 3 | Email verification | **Parked:** it needs a custom domain for Resend first. Listed under [Parked for later](#parked-for-later) with turning on email in production. |
| 4 | Sessions | **A:** sessions renew while in use; a password change or "Sign out everywhere" ends all other sessions; everyone is signed out once when this ships (AUTH-TWEAK-03, -04, AUTH-NEW-03, -04). |
| 5 | Landing video | **A:** on the landing page only, loaded late, in YouTube's no-cookie mode; sign-in, reset and other auth pages don't load it (AUTH-TWEAK-05). |
| 6 | Forgot password and sign-up | **A:** forgot password stays in the sign-in card and the separate page is deleted; a show-password toggle and a password-rules hint (AUTH-TWEAK-06, -07). |
| j | "Waking the server" message | **Dropped:** Render is always on; Neon's one or two seconds after idle are acceptable. |

## Calls I made

**Confirmed by William on 2026-10-19**, except the display-name prompt for existing users, which isn't built (decision 2).
- **Sessions: a per-user session key, not the blacklist.**

  | | SimpleJWT blacklist | Session key (picked) |
  | --- | --- | --- |
  | Other devices end | when their access token expires (1 day, or a refresh every 15 minutes per tab if shortened) | at once: checked inside the existing user query |
  | Writes | a row per sign-in and refresh, plus `flushexpiredtokens` on a schedule (no cron on Render) | only on password change, sign out others, reset and delete |
  | Two tabs refreshing together | rotation plus blacklist signs one out (single-flight is per tab) | both succeed |
  | After a database wipe | old tokens still pass (BUG-140) | a random key never matches |
  | Sign out one other device | yes | no; only "everywhere else", which is all decision 4 asks |

- **Session details.** Access tokens keep their 1-day lifetime, since the key is checked on every request. PERF-51 (caching the user) is dropped because it would delay a sign-out. Plain "Log out" stays this-device only. Each refresh returns a new 30-day refresh token, so a player active once a month never signs in again.
- **Display names.** Trimmed, 1 to 40 characters, not unique. The prompt is a one-field dialog in `ProtectedLayout` while `name` is blank. It has no Skip, because the name is required; until it's saved, others see "Player N". A rename rewrites the user's stored chat and bulletin names; notifications already sent keep the old one. Owners and admins keep the members list's email column (pass 4's call).
- **Account page.** `/account`, linked from the Campaigns header beside Log out and from campaign Settings → Personal. It has four sections: Display name, Password (current and new, no confirm field), "Sign out everywhere else", and Delete account. Email change is parked.
- **Deleting an account.** Confirmed with the password, after a preview (`GET auth/me/deletion/`). Campaigns you own that have other members block it, each with a link to hand over. A campaign where you're the only member is archived as part of the deletion. Every other membership goes through pass 4's removal clean-up (open battles and trades close, notifications resolve). Warbands, battles and the ledger stay and show "Former player". The user row stays but is anonymised: name "Former player", username `deleted-{id}`, email blank (so the address can sign up again), an unusable password, inactive, and a new session key. Their own notifications are deleted. The dialog says it can't be undone.
- **Throttles.** Login: 30 a minute per IP, plus 10 a minute and 30 an hour per email. Register: 20 an hour and 50 a day per IP. Reset: 20 an hour per IP and 3 an hour per email. Reset confirm: 20 an hour per IP. Refresh: 60 a minute per IP. Password change, sign out others and delete: 5 a minute per user. LocMem stays, so with 2 workers a limit is at most doubled. Someone spamming a player's email can delay that player's sign-in by a minute; accepted.
- **Email off.** The 503 reads: "Password reset by email isn't switched on yet. Ask the app's admin to reset your password." It's the same for every address, so it reveals no accounts. The admin route is `manage.py changepassword <email>` in the Render shell. SEC-11: register keeps saying an email is taken (players need to know to sign in), and this is documented as accepted.
- **Password hint**, shown under sign-up, reset and change password: "At least 8 characters. Not a common password, not all numbers, and not too like your name or email." Sign-up gets no confirm field; the reset page keeps its existing one. No support for old query-string reset links: email is off, so none were sent.
- **Landing video.** `youtube-nocookie.com`, mounted after the page has loaded, rendered by Landing only. `AuthShell` loses the iframe. The CSP gains the no-cookie host; narrowing `frame-src` waits for CSP enforcement.
- **Keep-awake** stays as an alias of health, so the UptimeRobot monitor works with either method, with no DB ping.

## Parked for later

For a later conversation with William; nothing here is built in this pass.
- **Email verification** (SEC-11's other half), once Resend has a custom domain.
- **Turning on email in production**, so password reset and feedback reports (pass 4's card on `/campaigns` included) work. It needs `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL` on the verified domain, `FRONTEND_URL` and `FEEDBACK_REPORT_TO_EMAIL`, plus a `send_test_email` command. PR A's 503 goes away by itself once the key is set.
- **Changing your email address**, which needs verification.
- **Same-origin API** (PERF-05, AUTH-PERF-03), a Vercel `/api` rewrite. It changes the `X-Forwarded-For` chain the throttles key on, so it waits until `RATE_LIMIT_NUM_PROXIES` is settled; afterwards, re-read `xff`. An httpOnly refresh cookie waits on it.
- **A shared throttle cache** (Render Key Value), only if the service runs more than one instance.
- **Ops leftovers outside auth:** measure Render → Neon RTT (PLAN 0.0, PERF-06); move `migrate` to Render's pre-deploy command; enforce the CSP.

## Planned changes

Types: **New**, **Tweak**, **Remove**. IDs: `AUTH-NEW-NN`, `AUTH-TWEAK-NN`. Status: Proposed → Agreed → Done.

| ID | Type | Change | Notes / acceptance | Status |
| --- | --- | --- | --- | --- |
| AUTH-NEW-01 | New | Account settings page | Decision 1. `/account`, linked from the Campaigns header and campaign Settings → Personal; sections for display name, password, sessions and deletion. | Done (PR C) |
| AUTH-NEW-02 | New | Change your display name | Decision 1. Saved through `PATCH auth/me/`; shows everywhere at once, chat and bulletin included. | Done (PR C; every campaign's cached lists read again after a rename) |
| AUTH-NEW-03 | New | Change your password | Decisions 1 and 4. Current and new password, with the toggle and the hint; other devices are signed out; this one stays signed in. | Done (PR C) |
| AUTH-NEW-04 | New | Sign out everywhere else | Decision 4. One button; every other device's next request lands on sign-in with "Your session ended". | Done (PR C) |
| AUTH-NEW-05 | New | Delete your account | Decision 1. Password confirm and a preview; owned campaigns with members are handed over first; you show as "Former player"; your warbands stay as retired records; it can't be undone. | Done (PR C: `GET` / `POST auth/me/deletion/`) |
| AUTH-NEW-06 | New | Asked once for a display name | Decision 2. A user with no name gets a one-field dialog on the next signed-in screen; until it's saved, others see "Player N". | Done (PR C, built as PR C's task asked on 2026-10-28; decision 2 had said not to build it, so drop the commit if that still stands. Sign-up requires a name, so only users made by createsuperuser or a seeder see it) |
| AUTH-TWEAK-01 | Tweak | Display name required at sign-up | Decision 2. "Display name" replaces "Alias"; 1-40 characters; the server refuses a blank one. | Done |
| AUTH-TWEAK-02 | Tweak | No email shown as a name | Decision 2, SEC-13. Players, members, chat, bulletin, encampments, battle labels, trade names and the ledger show the name, or "Player N"; never an email. | Done (the members list keeps its email column for owners and admins, pass 4's call) |
| AUTH-TWEAK-03 | Tweak | Sessions renew while in use | Decision 4. Each refresh returns a new 30-day refresh token; only 30 idle days sign you out. | Done |
| AUTH-TWEAK-04 | Tweak | Everyone signed out once when this ships | Decision 4. Old tokens are refused; the landing page says "Your session ended. Please sign in again." | Done |
| AUTH-TWEAK-05 | Tweak | Landing video: landing only, late, no-cookie | Decision 5. `youtube-nocookie.com` after load, on desktop Landing only; reset never loads it. | Done (PR C) |
| AUTH-TWEAK-06 | Tweak | One forgot-password flow | Decision 6. The sign-in card's flow stays; `/forgot-password` and `ForgotPassword.tsx` are deleted (the URL shows NotFound). | Done (PR C) |
| AUTH-TWEAK-07 | Tweak | Show-password toggle and rules hint | Decision 6. One `PasswordInput` with show and hide on sign-in, sign-up, reset and change password; the hint under every new password. | Done (PR C; the account page's current password has the toggle too) |

## Progress

| Step | State |
| --- | --- |
| Characterisation tests | **Done.** Backend 958 → 1,056 with real JWTs (6 expected failures: BUG-84's two over-long fields and its sign-up race, BUG-140, and BUG-83's two uids); frontend 1,246 → 1,321 through the fake API server, plus a fake `fetch` behind the real api-client. Found BUG-153 to BUG-158. |
| PR A (fixes) | **Done.** Backend 1,056 → 1,096, every expected failure flipped: a per-user session key (`sk`) in every token, checked on each request and refresh, with rotating refresh tokens; a reset, `POST auth/password/` and `POST auth/sign-out-others/` end every other session (401 `session_ended`); `PATCH auth/me/` renames and restamps the user's chat and bulletin names; a display name of 1 to 40 characters is required at sign-up; login answers `{access, refresh, user}` and records `last_login`; identity-keyed throttles (loose per address, tight per email, 10,000 counters); with `DJANGO_DEBUG` off, a key under 50 characters stops startup, `RATE_LIMIT_NUM_PROXIES` defaults to 1 with a warning, and a set `RESEND_API_KEY` needs real `FRONTEND_URL` and `DEFAULT_FROM_EMAIL` values; reset answers 503 `email_unavailable` while email is off, and its link uses the fragment; health and keep-awake run no authentication or query; `LOGGING` to stdout; JSON-only renderers in production. Frontend 1,321 → 1,356: sign-in and sign-up read no `/auth/me` (3 and 2 before); the user is cached beside the tokens, so a reload paints at once; a 401 after a refresh signs out; sign-in returns to the page you were on, and an ended session says so; unknown URLs show NotFound; the auth forms use `getErrorMessage`, with `role="alert"` and `aria-pressed`; the landing box scrolls; the reset page reads the fragment and ends on "Password updated"; the feedback card stops at 2,000 characters; the rotated refresh token is stored. |
| PR B (refactor) | **Done.** Backend 1,096 → 1,102 with no query count changed: `apps/users/services/accounts.py` (no view method over 14 lines), the reset finds its user by username (IMP-95 c), throttle scopes come from one table (`SCOPES`), one `email_configured()` and one `_queue_email`, the unused sessions, messages and CSRF machinery is gone and CI runs `check --deploy`, the Dockerfile pins uv 0.13.1 with `--frozen`, and `test_rate_limiting.py` is split. Frontend 1,356 → 1,371: `lib/session.ts` owns the tokens, the cached user and the session's status (`auth-store.tsx` 249 → 121 lines); `AuthCard` 322 → 79 as `LoginForm`, `RegisterForm`, `ForgotForm` and `AuthModeSwitch` on a shared `AuthField` and `PasswordInput`. |
| PR C (decisions and features) | **Done** (`pass6/pr-c`, 2026-10-28; its two-player browser check is next). Backend 1,531 → 1,548: `GET auth/me/deletion/` previews deleting your account, campaign by campaign (`hand_over_first` for one you own with other members, `archived` for one you're alone in, `left` for the rest, with the warband kept) plus the open battles and trades that close, in 4 queries however many campaigns (5 with the token); `POST` with the current password deletes it in one transaction under the owned campaigns' row locks, through pass 4's archive and removal clean-up, and keeps the user row as "Former player" (username `deleted-<id>`, no email, an unusable password, inactive, a new session key; chat and bulletin names restamped; their notifications deleted); it joins the account throttle. Startup also refuses a `DEFAULT_FROM_EMAIL` on `resend.dev` once `RESEND_API_KEY` is set. Frontend 1,806 → 1,830: a user without a display name is asked for one in a dialog with no Skip (AUTH-NEW-06); `/account` (linked from the campaigns list beside Log out and from Settings → Personal) changes the display name, changes the password, signs out everywhere else and deletes the account after a preview and the password (AUTH-NEW-01 to -05); the landing video plays on Landing only, from the no-cookie embed, after the page has loaded (AUTH-TWEAK-05); `/forgot-password` is gone (AUTH-TWEAK-06); one `PasswordInput` with show and hide everywhere and the rules hint under every new password (AUTH-TWEAK-07). Fixed BUG-170 and BUG-171. |
| Combined browser check (`release/p5-p6`) | **Passed**, with no email sent (the reset request was stubbed in the page). It found and fixed BUG-163: the landing box still didn't scroll on a short desktop window. |

William changed one call during PR A: with `RATE_LIMIT_NUM_PROXIES` unset in production, the throttles assume Render's one proxy and gunicorn warns once per start, instead of refusing to start.

Decided during PR A and B (change any of them):
- The session key lives on a `UserAccount` row, created at sign-up and at the first sign-in for users made another way (`createsuperuser`, the seeders); no signal.
- A sign-in records `last_login`, which spends any outstanding reset link (BUG-154); login costs 2 queries.
- The session key changes before the new password is saved, without a transaction: if the save failed, the old password would still work and everyone would just sign in again.
- `manage.py changepassword`, the admin route while email is off, doesn't end sessions yet (BUG-169).
- The password change and sign-out-others answer `{access, refresh, user}`, as login does, and share one throttle (5 a minute per user) that the account delete can join.
- A rename rewrites the user's stored chat and bulletin names, removed posts included, in one transaction, with no realtime event: open chats show it on their next load, and notifications keep the old name.
- The feedback report bounds its fields but doesn't check that the reporter can see the campaign or warband it names; the email is only for the admin.
- Register, reset and reset-confirm still answer 401 to a stale bearer header (BUG-173); the app never sends one there.
- A reset finds its user by username only, as sign-in does, so an account whose username isn't its lowercased email (only `createsuperuser` makes one) gets no link.
- The cached user is trusted only when its id matches the token's. A background check that meets an outage keeps it, with no error screen.
- Log out keeps no return path, so the next person on a shared device starts at `/campaigns`. A cold signed-out visit returns to its page with no message; an ended session returns to it with "Your session ended".
- Any JSON 503 with a `detail` shows that detail (the feedback card's 503 included); a bare 502, 503 or 504 still reads "Can't reach the server".
- A user's first notifications load replaces the bell, so nothing from before sign-in lingers.
- Your own header says "Welcome back" with no name, rather than your "Player N".
- A reset done on a signed-in device signs that device out the way Log out does, with no "session ended" notice.
- Settings drop `AuthenticationMiddleware` along with sessions (DRF authenticates every request from its token) and silence W003; only the test runner uses a session engine.

Decided during PR C (change any of them):
- **AUTH-NEW-06 is built**, because PR C's task listed it first, though decision 2 (2026-10-19) said not to build a prompt. It shows only to a user without a name, which sign-up no longer makes (only `createsuperuser` and the seeders do), so it is harmless; drop its commit if decision 2 stands. The dialog can't be closed or skipped, since the name is required.
- A rename makes every campaign's cached queries read again (`["campaign"]`), so the page under the name prompt shows the new name at once; the account page has none open.
- Deleting: an owned campaign with other members blocks it even when archived. An archived campaign can't be handed over, so the preview says to restore it and hand it over, or delete it for good.
- A campaign the user is alone in is archived and keeps its owner's membership, now "Former player", so nobody can restore it; one already archived stays as it was.
- Memberships in other people's archived campaigns are taken out too: the deletion is the one write an archived campaign takes, and it changes nothing there but the membership.
- The battles a deletion closes use the leave mode (`member_left`): to the other players it reads as if the player left. The user is anonymised before the clean-up, so everything written during it names "Former player".
- The preview counts the open battles and trades rather than listing them one by one as Leave does, so it stays at 4 queries however many campaigns the user is in.
- A wrong password counts against the account throttle (5 a minute per user), shared with the password change and sign-out-others; the preview doesn't count.
- After a deletion this device signs out the way Log out does, with the toast "Your account is deleted." rather than "Your session ended"; other devices meet "Your session ended" at their next request.
- The password change and sign-out-others keep this browser's other tabs signed in (they share the stored tokens); "Sign out everywhere else" has no confirm, since nothing is lost.
- Sign-up, the name prompt and the account page show each refusal under its field (BUG-171); the reset page keeps its one line under the form.
- The reset page keeps the dark half where the video was, so its layout doesn't move. The landing video waits for the window's load event, or for the next task when the page has already loaded (moving to `/` inside the app), never the first render.
- `frame-src` names `https://www.youtube-nocookie.com` beside `https:`, so `https:` can go when the CSP is enforced.

## Production checks

Environment variables only (names, never values). Data is disposable, so there is no SQL to run.
- **`DJANGO_SECRET_KEY`: 50+ characters, rotated in this deploy.** With `DJANGO_DEBUG` off, startup now refuses a shorter key, so check it first: gunicorn shows the message, but a failing `manage.py migrate` shows only `AppRegistryNotReady` (BUG-172). A new random value clears Phase 0's open rotation, and everyone is signed out once by the session key anyway. Once the session key is deployed, a wiped database no longer needs a rotation (BUG-140).
- **`RATE_LIMIT_NUM_PROXIES`: optional** (William's change during PR A). Unset, production assumes 1 proxy and gunicorn logs a warning once per start; a value that isn't a whole number of 0 or more stops startup. To confirm 1 is right, count the addresses in a normal request's `xff="..."` in Render's log (the client's address should be the last), or send `curl -H "X-Forwarded-For: 1.2.3.4" https://mordheim-1.onrender.com/api/health/` and check that the logged `xff` ends with your real IP. Set it to `1` to silence the warning.
- **No email variables:** they stay unset until [email is turned on](#parked-for-later), so reset answers the 503. Once `RESEND_API_KEY` is set, startup also needs an https `FRONTEND_URL` and a real `DEFAULT_FROM_EMAIL`.
- **Deploy the backend and frontend together.** The frontend stores the rotated refresh token, sends `name` at sign-up, handles `session_ended` and reads the reset link's fragment. Everyone signs in once (AUTH-TWEAK-04).
- **PR C:** no new variable and no migration. Deploy the backend with the frontend, since the account page calls the new `auth/me/deletion/`. When email is turned on, `DEFAULT_FROM_EMAIL` must be on the verified domain: startup now refuses Resend's shared `resend.dev` sender as well as example.com.
