# Auth, users and core

> Scope: `backend/apps/users/` (views, serializers, urls, emails, tests), `backend/apps/core/` (health, keep-awake, throttling, tests), auth-related parts of `backend/config/settings.py` (SimpleJWT, throttle rates, cache, CORS, email settings) and `backend/config/urls.py`; `frontend/src/features/auth/` (Landing, AuthCard, AuthShell, ForgotPassword, ResetPassword, auth-api, auth-store), `frontend/src/utils/storage.ts`, `frontend/src/lib/api-client.ts`, `frontend/src/components/ProtectedRoute.tsx`, the token use in `frontend/src/lib/realtime.ts`, and `frontend/src/features/campaigns/components/settings/FeedbackReportCard.tsx`.

## Summary

| Dimension | Verdict |
| --- | --- |
| Performance | Not a main driver of the Render slowdown, but it adds fixed overhead to every session: `/auth/me` blocks every page load (serial waterfall), login fires `/auth/me` 3 times, each access-token refresh remounts the whole app, and production likely pays a CORS preflight per distinct URL. |
| Bugs | The session layer overreacts. Any transient 5xx, 429 or network error on `/auth/me` or `/auth/refresh` wipes both tokens and logs the user out (P1), which hits hardest exactly when Render is struggling. Sign-out leaks the previous user's in-memory state to the next user. Several edge inputs return 500. |
| Code quality | The backend is small and readable. On the frontend, auth state is spread across localStorage, React state and a window event bus, and that split is the root cause of most of the bugs above. Email code and the forgot-password UI are duplicated. A backend test sends real email through Resend. |
| UI / UX | Works, but rough: raw backend strings ("Expected available in 3540 seconds", "Failed to fetch", "Given token not valid…"), silent session expiry, no success feedback on feedback reports, no account management. |
| Security | Two P1s: `SECRET_KEY` silently falls back to `"dev-secret-key"` (which also signs JWTs), and campaign locations allow stored XSS that can read the 30-day refresh token from localStorage. There is no way to revoke a session, and the auth throttles are bypassable via `X-Forwarded-For` and per-process LocMem. |
| Tests | Throttles (21 tests) and the feedback endpoint (6 backend + 5 frontend tests) are covered. Register, login, refresh, me and both password-reset endpoints have no direct tests. The frontend auth layer (api-client refresh, auth-store, ProtectedRoute, auth pages) has none. |

**Top 5 findings**

1. **AUTH-BUG-01 (P1):** any transient failure of `/auth/me` or `/auth/refresh` deletes both tokens and logs the user out.
2. **AUTH-SEC-02 (P1):** stored XSS in location content plus tokens in localStorage means a campaign owner can steal members' 30-day refresh tokens.
3. **AUTH-SEC-01 (P1, P0 if unset on Render):** the `SECRET_KEY` fallback `"dev-secret-key"` signs JWTs, so tokens are forgeable if the env var is missing.
4. **AUTH-PERF-01 (P2):** every full page load waits on `/auth/me` before any data request.
5. **AUTH-PERF-03 (P2):** the cross-origin API means a CORS preflight per distinct URL in production. Local dev hides this.

Next in line: AUTH-BUG-02 (token refresh remounts the whole app and loses unsaved state) and AUTH-BUG-03 (sign-out leaks state to the next user on a shared device).

## How it works

### Endpoints

Query counts marked *measured* come from `CaptureQueriesContext` against the local stack with a real bearer token for user 1. The rest are derived from code, because POST endpoints were not executed.

| Endpoint | Method | Auth | Throttle (scope: rate) | DB work | Notes |
| --- | --- | --- | --- | --- | --- |
| `/api/auth/register/` | POST | none | IP: 3/hour, 10/day | 1 `EXISTS` + 1 `INSERT`, 1 PBKDF2 hash | Lowercases email, sets `username = email`, `first_name = name`. Returns `{access, refresh, user}` (`views.py:57-74`) |
| `/api/auth/login/` | POST | none (SimpleJWT views set `authentication_classes = ()`) | IP: 5/min, 30/hour | 1 `SELECT`, 1 PBKDF2 hash | `EmailTokenObtainPairSerializer` → `authenticate(username=email)`. Failure gives 400 `{"non_field_errors": ["Invalid credentials"]}` |
| `/api/auth/refresh/` | POST | none | IP: 30/min | 0 | Returns a new `access` only. No rotation and no blacklist (`settings.py:136-139`) |
| `/api/auth/me/` | GET | JWT | none | **1 (measured)**: the JWT user lookup | `{id, email, name}`, 68 bytes |
| `/api/auth/password-reset/` | POST | none | IP: 3/hour, 10/day | 1 `SELECT`, plus a synchronous Resend HTTP call if the account exists | Always returns "If an account exists for that email, a reset link has been sent." |
| `/api/auth/password-reset-confirm/` | POST | none | IP: 10/hour | 1 `SELECT` + 1 `UPDATE`, 1 PBKDF2 hash | Django `PasswordResetTokenGenerator`, `PASSWORD_RESET_TIMEOUT` = 3600 s |
| `/api/auth/feedback-report/` | POST | JWT | user: 3/min, IP: 10/min | 1 (auth) plus a synchronous Resend call | Returns 503 if the email can't be sent |
| `/api/health/` | GET | global JWT auth still runs | none | **0 without a token, 1 with one (measured)**. A bad token returns **401 (measured)** | `{"status": "ok"}` |
| `/api/keep-awake/` | HEAD only | global JWT auth still runs | none | 0 | **GET returns 405 (measured)** |

There are no models in `apps/users`; it uses `django.contrib.auth.User`. Password hashing is PBKDF2-SHA256 with 720,000 iterations, measured at 0.08 s per hash on the dev machine. Expect several times that on a fractional Render CPU.

### Frontend flow

- **Storage** (`utils/storage.ts`): `mordheim_token` (access) and `mordheim_refresh_token` live in localStorage. `setToken`, `setRefreshToken` and `clearToken` each dispatch a window event, `auth:tokens-changed`.
- **AuthProvider** (`features/auth/stores/auth-store.tsx`) holds `token`, `user`, `isReady` and `isSubmitting`. On mount, and on every `auth:tokens-changed` or cross-tab `storage` event, `syncToken` compares the stored token with state. On any difference it calls `hydrateUser`, which sets `isReady=false` and calls `GET /auth/me`. `signIn` and `signUp` store tokens and then hydrate. `signOut` clears tokens and `user`.
- **ProtectedRoute** (`components/ProtectedRoute.tsx`) shows `LoadingScreen` while `!isReady` and redirects to `/` with no token. It also mounts `useNotifications()` (`GET /notifications/` plus a Pusher user channel).
- **api-client** (`lib/api-client.ts`) adds `Authorization: Bearer <access>` (and `Content-Type: application/json`) to every request. On a 401 it does a single-flight `POST /auth/refresh/`, then retries the request once with the new token. If the refresh fails, it calls `clearToken()`.
- **Pages:** `/` is `Landing` (`AuthShell` with a YouTube background on desktop, plus `AuthCard` with login, register and inline forgot-password modes). `/forgot-password` is a standalone page with no links to it. `/reset-password?uid=&token=` is the reset form.
- **Feedback:** `FeedbackReportCard` sits only in a campaign's Settings, on the personal tab.

### How often `/auth/me` runs

| Trigger | `/auth/me` calls | Side effects |
| --- | --- | --- |
| Full page load or reload, deep link, new tab | 1, **blocking** (nothing else starts until it returns) | +1 `/notifications/`, +1 Pusher auth |
| Login | **3** | Up to 3× `/notifications/` and 3 Pusher connect/teardown cycles |
| Register | **2** (observed) | **3× `/notifications/`, 3× Pusher auth (observed in the live-run log, 13:28:42-43)** |
| Access-token refresh (once a day per session) | 1-2, and the app remounts via `LoadingScreen` | Every mounted screen refetches its data |
| Token refresh in *another* tab | 1 per other open tab, and each remounts | Same as above |
| In-app navigation | 0 | none |

### Throttling

`apps/core/throttling.py` defines IP-scoped and user-or-IP-scoped `SimpleRateThrottle` subclasses with a global kill switch (`RATE_LIMIT_ENABLED`). Mixed GET/POST views use `MethodScopedThrottleMixin`, so only POSTs count. All other throttled views are POST-only (checked across battles, campaigns and trades). State lives in the default cache, a **LocMemCache** (per process, `MAX_ENTRIES=300`, cull 1/3, measured). The client IP comes from DRF `get_ident`. `NUM_PROXIES` is set only if `RATE_LIMIT_NUM_PROXIES` is present, and it isn't in the local env.

### Keep-awake: who pings it?

Nothing in the repo does. There is no GitHub workflow, no cron job and no frontend call (grep for `keep-awake`/`keepAwake`/`/health` finds only the URLconf, the view, a test and the README). It must be an external monitor (UptimeRobot, cron-job.org or similar) that William configured. Its frequency and HTTP method are unknown. See AUTH-PERF-06.

## Performance

### AUTH-PERF-01 · P2 · Every full page load waits for `/auth/me` before any data request
- **Where:** `frontend/src/features/auth/stores/auth-store.tsx:28`, `:36-56`; `frontend/src/components/ProtectedRoute.tsx:19-21`
- **What:** With a stored token, `isReady` starts `false`. `ProtectedRoute` renders `LoadingScreen` until `GET /auth/me` resolves, and only then do the route components mount and fire their own requests. The live-run backend log shows `/auth/me` first on every load (for example 13:29:32), with campaign, catalogue and overview requests starting only afterwards. The payload is 68 bytes (`{id, email, name}`) and never changes during a session. If the access token has expired, the waterfall becomes 401 → refresh → retry, which is three serial round trips before the first data request.
- **Impact:** Every reload, deep link and new tab gains one full browser → Render → Neon round trip in series (1 query, measured). Under load, `/me` queues behind other requests on the busy instance and the user sees a spinner for that whole time.
- **Fix:** Persist the user next to the tokens (for example `mordheim_user`, written on login, register and `/me`). Render the protected tree immediately from the cached user (or from the JWT `user_id` claim) and revalidate `/me` in the background, logging out only on a 401 (see AUTH-BUG-01). Sketch:
  ```ts
  const cached = readCachedUser()           // JSON from localStorage, try/catch
  const [user, setUser] = useState(cached)
  const [isReady, setIsReady] = useState(Boolean(cached) || !getToken())
  useEffect(() => { if (getToken()) revalidateMe() }, [])   // background, no spinner
  ```
- **Effort:** S · **Confidence:** Confirmed

### AUTH-PERF-02 · P2 · Login fires `/auth/me` three times (register twice), and each response re-runs the notifications effect
- **Where:** `frontend/src/utils/storage.ts:10-36`; `frontend/src/features/auth/stores/auth-store.tsx:59-85`, `:92-95`, `:109-112`; `frontend/src/features/realtime/hooks/useNotifications.ts:170-338` (deps include the `user` object, line 337)
- **What:** `signIn` calls `setToken` and then `setRefreshToken`. Each dispatches `auth:tokens-changed` synchronously into the bound `syncToken`, whose closure still holds `token = null` because React has not re-rendered yet, so each one starts its own `hydrateUser` → `fetchMe`. `signIn` then awaits its own `hydrateUser`, making 3 calls. `signUp` makes 2 (its explicit hydrate uses the returned profile). Each response sets a new `user` object, which re-runs `useNotifications` (`GET /notifications/`, a new Pusher connection, `POST /realtime/pusher/auth/`) and re-renders every app-store consumer, because `user` is in the app-store context value (`stores/app-store.tsx:422-424`). This was observed in the live run: one `POST /register/` was followed within one second by 2× `/auth/me`, 3× `/notifications/` and 3× Pusher auth.
- **Impact:** Login or register sends about 9 requests (about 9 queries, plus 3 Pusher connections opened and closed) instead of 3. Logins are rare per user, but they bunch up when a group starts a session together.
- **Fix:** Add one `setTokens({ access, refresh })` that writes both and notifies once. Make `syncToken` compare against a ref rather than closure state, and skip when nothing changed. Don't let `signIn`/`signUp` both trigger the event path and hydrate explicitly. Key effects on `user?.id`, not on the `user` object.
- **Effort:** S · **Confidence:** Confirmed (code trace and live-run log)

### AUTH-PERF-03 · P2 · The cross-origin API means a CORS preflight for every distinct URL (local dev hides it)
- **Where:** `frontend/src/config/env.ts:1`; `frontend/src/lib/api-client.ts:72-80`; `frontend/vite.config.js` (dev proxy); `frontend/vercel.json`; `backend/config/settings.py:174-175`
- **What:** In production the Vercel SPA calls the Render API directly. `vercel.json` has only the SPA fallback, so `VITE_API_BASE_URL` must be the Render origin. Every request carries `Authorization` (and `Content-Type: application/json`, even on GETs). Neither header is CORS-safelisted, so the browser sends an `OPTIONS` preflight first. django-cors-headers answers with `access-control-max-age: 86400` (measured), but Chrome caps the preflight cache at 7200 s, and the cache is per URL and method. Locally, the Vite proxy makes `/api` same-origin, so preflights never show up in dev or in the backend log.
- **Impact:** On a cold visit, the number of requests to Render roughly doubles. The 17 calls in the live-run campaign overview load would become about 34, and each first-seen URL waits one extra round trip before the real request. Preflights are cheap for Django (0 queries, short-circuited in `CorsMiddleware`), but they still use dev-server threads and the instance's small CPU share. URLs containing IDs (`/warbands/2/`, `/heroes/5/`) are separate cache entries, so they keep missing.
- **Fix:** Add a Vercel rewrite before the SPA fallback, `{ "src": "/api/(.*)", "dest": "https://<render-host>/api/$1" }`, and set `VITE_API_BASE_URL=/api`. Same-origin requests need no preflight and no CORS config, and this also makes a future httpOnly refresh cookie first-party (AUTH-SEC-04). Measure the extra Vercel → Render hop (both in Europe). Separately, send `Content-Type` only when there is a body.
- **Effort:** S · **Confidence:** Likely (confirm `VITE_API_BASE_URL` on Vercel; NOTES open question 5)

### AUTH-PERF-04 · P3 · Every authenticated request pays one `auth_user` lookup, health checks included
- **Where:** `backend/config/settings.py:108`; `backend/apps/core/views.py:6-17`
- **What:** SimpleJWT `JWTAuthentication.get_user` runs `SELECT … FROM auth_user WHERE id = …` on every request that has a bearer token. Measured: `GET /api/auth/me/` makes 1 query, and so does `GET /api/health/` when a token is sent. With a bad token, `/api/health/` returns 401. `HealthView` and `KeepAwakeView` inherit the global authentication classes.
- **Impact:** One extra Neon round trip per API call, about 10-20 ms each from Render Frankfurt to Neon London according to `ENGINEERING_RULES.md`. The roughly 17-call campaign overview spends about 17 queries on identity alone. A health probe that happens to send a stale header does DB work and fails.
- **Fix:** (1) Set `authentication_classes = []` and `throttle_classes = []` on `HealthView` and `KeepAwakeView`. (2) Optionally, once INFRA connection pooling lands, subclass `JWTAuthentication` with a short (30-60 s) per-process cache of `user_id → user`, invalidated on password change, or simply accept the cost. Do this only after the per-endpoint query fixes, which matter more.
- **Effort:** S for (1), M for (2) · **Confidence:** Confirmed

### AUTH-PERF-05 · P3 · Resend calls block the request for up to 10 s and leak account existence through timing
- **Where:** `backend/apps/users/emails.py:31-40`, `:111-120`; `backend/apps/users/views.py:102-109`, `:140`
- **What:** Password reset and feedback reports call `requests.post(..., timeout=10)` inline. The timeout applies separately to connect and to read. Password reset calls Resend only when the account exists.
- **Impact:** The endpoints are rare, so the total cost is small. But each call holds a request thread (or a whole sync gunicorn worker after the INFRA change) for the Resend round trip, and a Resend outage stalls each request for 10 s or more. The response-time difference also reveals whether an email is registered (minor, because register already reveals it; see AUTH-SEC-05).
- **Fix:** Send email in the background, for example a module-level `ThreadPoolExecutor(max_workers=2)` wrapped in `transaction.on_commit`, with `timeout=(3, 5)`. The feedback endpoint can return 202. This matches the ENGINEERING_RULES rule "never block the response on an external call".
- **Effort:** S · **Confidence:** Confirmed

### AUTH-PERF-06 · P3 · Keep-awake warms only the web process, accepts only HEAD, and nothing in the repo pings it
- **Where:** `backend/apps/core/views.py:13-17`; `backend/apps/core/urls.py:7`
- **What:** `KeepAwakeView` implements only `head()`, so `GET /api/keep-awake/` returns 405 (measured). Neither keep-awake nor `/health` touches the DB. No code in the repo pings either endpoint, so an external monitor of unknown frequency and method must be doing it.
- **Impact:**
  - If the monitor uses GET, it gets a 405. Many monitors then report the site as down, although Render still wakes.
  - Neon's compute still suspends after its idle timeout, so the first real request after a quiet spell pays a Neon cold start even though Render is awake.
  - Cost: on Render's free tier, a service kept awake 24/7 uses roughly the whole monthly free instance-hour allowance (about 750 h). On a paid instance there is no spin-down, so the ping does nothing.
  - It doesn't address the "slow with several users" complaint either, because that is load, not cold start.
- **Fix:** Answer NOTES question 2 (the Render plan) first.
  - **Free tier:** accept GET and HEAD (define `get()` returning 204; Django maps HEAD to GET), drop auth and throttles (AUTH-PERF-04), ping every 10-14 minutes, and document the monitor in the README. Optionally warm the server from the landing page (AUTH-UX-03).
  - **Paid plan:** delete the endpoint and the monitor.
  - Either way, don't add a DB query unless keeping Neon warm is worth the compute hours.
- **Effort:** S · **Confidence:** Confirmed (code) / Speculative (pinger and plan)

## Bugs

### AUTH-BUG-01 · P1 · Any transient failure of `/auth/me` or `/auth/refresh` deletes both tokens and logs the user out
- **Where:** `frontend/src/features/auth/stores/auth-store.tsx:50-56`; `frontend/src/lib/api-client.ts:45-59`
- **What:** The `catch` in `hydrateUser` calls `clearToken()` for every error: a 500, a 502 or 503 from Render during a deploy, restart or OOM, a 429, a dropped connection, or a CORS failure while the server boots. The `catch` in `refreshAccessToken` does the same for any non-OK refresh response or fetch failure. Only a 401 from `/me`, or a 400/401 from `/refresh`, actually means the session is invalid.
- **Impact:** When the app is struggling (an overloaded or restarting Render instance), users who reload, or whose access token is due for refresh, get thrown back to the login screen and lose their 30-day refresh token. Logging in again adds load (a PBKDF2 hash plus 3× `/me`, see AUTH-PERF-02). Users will describe this as "it keeps logging me out".
- **Redirect loop?** No. After a failed refresh the tokens are cleared, `ProtectedRoute` redirects to `/`, and `AuthCard` only redirects to `/campaigns` when a token exists. The problem is overeager logout, not looping. Requests whose 401 arrives after the refresh has failed find no refresh token and simply throw.
- **Fix:** Clear tokens only on real auth failures. Otherwise keep the tokens and show a retry state:
  ```ts
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearToken(); setTokenState(null); setUser(null)
    } else {
      setBootError(true)          // ProtectedRoute shows "Can't reach the server" + Retry
    }
    setIsReady(true)
  }
  ```
  In `refreshAccessToken`, call `clearToken()` only when `response.status` is 400 or 401. Return `null` without clearing for network errors, 429 and 5xx.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-BUG-02 · P2 · An access-token refresh (in this tab or any other) unmounts the whole app and refetches everything
- **Where:** `frontend/src/features/auth/stores/auth-store.tsx:36-38`, `:59-68`, `:78-80`; `frontend/src/components/ProtectedRoute.tsx:19-21`; `frontend/src/lib/api-client.ts:53`
- **What:** `refreshAccessToken` → `setToken(new)` → `auth:tokens-changed` → `syncToken` sees a different token → `hydrateUser` → `setIsReady(false)`. `ProtectedRoute` then swaps the entire protected tree for `LoadingScreen` until a new `/me` returns. The cross-tab `storage` event does the same in every other open tab.
- **Impact:** This happens about once a day per session (access tokens last 24 h), usually on the first action after returning to an open tab.
  - Unsaved form state is lost: the postbattle form, item dialogs, chat drafts.
  - Every mounted screen refetches all its data. In the live-run log the catalogue alone (items, skills, spells, special) was about 375 KB per load.
  - All Pusher channels reconnect, and N open tabs means N full reloads.
  - The original request is retried and succeeds, but the component that sent it has already unmounted, so its success handling never runs.

  If access tokens are shortened to 15-30 minutes (AUTH-SEC-04), this would happen every 15-30 minutes for every user. **Fix this first.**
- **Fix:** Treat a token change for the same user as a silent update. Decode `user_id` from the new JWT; if it equals `user.id`, update the token without calling `hydrateUser` or `setIsReady(false)`. Hydrate only on first boot or on an account switch. Hold the token in a ref or `useSyncExternalStore` so consumers don't re-render on refresh.
- **Effort:** S · **Confidence:** Confirmed (code trace)

### AUTH-BUG-03 · P2 · Signing out leaves the previous user's state in memory for the next user in the same tab
- **Where:** `frontend/src/features/auth/stores/auth-store.tsx:121-126`; `frontend/src/stores/app-store.tsx:83-118` (no reset path); `frontend/src/features/realtime/hooks/useNotifications.ts:181-202`
- **What:** `signOut` clears only the tokens and `user`. `AppStoreProvider` keeps `warband`, `tradeRequestNotifications`, `battleInviteNotifications`, `battleResultRequestNotifications`, `currentBattleSession`, `tradeSession` and the catalogue caches. Nothing resets them when the user changes, and the `add*` setters merge into the existing arrays.
- **Impact:** On a device shared at the table (a tablet passed between players), player B sees player A's pending trade and battle notifications and A's "current battle" session. Acting on them calls the API as B, which gives 403s at best. It also exposes A's data on a shared computer.
- **Fix:** Key the store by user: `<AppStoreProvider key={user?.id ?? "anon"}>` in `app/provider.tsx`, so a user change remounts it with empty state. Alternatively add a `resetAll()` that `signOut` calls. A full reload on sign-out (`window.location.assign("/")`) is a cheap extra safeguard.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-BUG-04 · P2 · Per-IP auth limits lock out groups sharing one IP, which is how this app is normally used
- **Where:** `backend/config/settings.py:110-118`; `backend/apps/core/throttling.py:28-30`
- **What:** Register is limited to 3/hour and 10/day per IP, login to 5/min and 30/hour per IP, password reset to 3/hour per IP. Players usually sit at one table on one Wi-Fi network (one public IP), and mobile carriers use CGNAT.
- **Impact:** At a first game night, the 4th player to create an account gets HTTP 429 with "Request was throttled. Expected available in 3540 seconds.", shown verbatim (AUTH-UX-01). Six players signing in within a minute means the 6th is throttled. This blocks onboarding in the app's main use case.
- **Fix:** Loosen the IP limits and add identity-keyed limits: register 20/hour per IP; login 20/min per IP plus 5/min per (IP, email) and 20/hour per email; reset 5/hour per email plus 20/hour per IP. Email-keyed throttles can read `request.data.get("email", "").strip().lower()` in `get_cache_key`.
- **Effort:** S · **Confidence:** Likely

### AUTH-BUG-05 · P2 · Password reset reports success even when no usable email can be sent; email settings fall back to placeholders
- **Where:** `backend/config/settings.py:177-183`; `backend/apps/users/emails.py:11-14`, `:45-53`; `backend/apps/users/views.py:103-109`
- **What:** The settings fall back silently:
  - `FRONTEND_URL` defaults to `http://localhost:5173`. It is unset in the local container (confirmed).
  - `DEFAULT_FROM_EMAIL` defaults to `no-reply@example.com`, and Resend rejects unverified sender domains.
  - `RESEND_API_KEY` defaults to `""`, in which case the send is skipped with a warning.

  The view ignores the send result and always returns the generic success message.
- **Impact:** If any of these is missing on Render, reset emails either never arrive or link to localhost, and users only ever see "a reset link has been sent". Nobody notices until a player is locked out.
- **Fix:** When `DEBUG` is off, raise `ImproperlyConfigured` at startup if `FRONTEND_URL`, `DEFAULT_FROM_EMAIL` or `RESEND_API_KEY` is missing or still a default. Keep the generic response for enumeration resistance, but log send failures at ERROR level so they can be alerted on. Add a `send_test_email` management command for checking production config.
- **Effort:** S · **Confidence:** Confirmed (no guard) / Speculative (production values)

### AUTH-BUG-06 · P3 · `password-reset-confirm` returns 500 for a malformed uid
- **Where:** `backend/apps/users/views.py:40-46`
- **What:** The `try` covers only the base64 decode. A uid that decodes to a non-numeric string makes `filter(pk="abc")` raise `ValueError`, which becomes a 500. Verified in the shell: `_get_user_from_uid(urlsafe_base64_encode(b"abc"))` raises "Field 'id' expected a number but got 'abc'". Out-of-range numbers and invalid UTF-8 correctly return `None`.
- **Impact:** A link mangled by an email client shows "Request failed (500)" instead of "Invalid or expired token", and adds error-log noise.
- **Fix:** Do what Django's `PasswordResetConfirmView.get_user` does: wrap both the decode and the lookup, and catch `(TypeError, ValueError, OverflowError, ValidationError)`. Alternatively add `if not user_id.isdigit(): return None`.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-BUG-07 · P3 · Register can return 500 for an over-long alias or email, or for two simultaneous sign-ups with the same email
- **Where:** `backend/apps/users/serializers.py:8-10`, `:16-21`, `:28-34`
- **What:** `name` has no `max_length` but is stored in `first_name` (varchar 150). The email is copied into `username` (varchar 150) while `EmailField` accepts up to 254 characters. Shell check: `RegisterSerializer` with a 162-character email and a 300-character name passes `is_valid()`, and saving would raise `DataError`. `validate_email` checks and then inserts, so two devices registering the same address at once race to an `IntegrityError` on `username`.
- **Impact:** The sign-up form shows "Request failed (500)" for edge inputs. Double-clicks are already blocked in the UI by `isSubmitting`, so the race is mostly a cross-device case.
- **Fix:** Use `name = CharField(max_length=150, ...)` and `email = EmailField(max_length=150)`. In `create`, catch `IntegrityError` and raise `ValidationError({"email": ["User already exists"]})`.
- **Effort:** S · **Confidence:** Confirmed (validation probe) / Likely (race)

### AUTH-BUG-08 · P3 · Pusher channel authorization uses the token captured when the socket was created
- **Where:** `frontend/src/lib/realtime.ts:100-110`, `:151-160`, `:193-202`, `:235-244`, `:274-283`
- **What:** All five socket factories pass `headers: { Authorization: "Bearer <token at creation>" }`. pusher-js re-authorizes channels after every reconnect (network blip, laptop sleep). If the socket has outlived the 24 h access token, re-auth gets a 401 and the channel silently stays unsubscribed. Nothing triggers a token refresh.
- **Impact:** In a tab left open overnight, realtime updates (notifications, chat, battle updates) silently stop until some API call happens to trigger a refresh, and that refresh then remounts everything (AUTH-BUG-02). Players see stale battle state.
- **Fix:** Use `channelAuthorization.headersProvider: () => ({ Authorization: "Bearer " + getToken() })` (supported in pusher-js 8), or a `customHandler` that posts through `apiRequest`, which already refreshes on 401. Put it in one shared helper for all five factories, which also removes the duplication.
- **Effort:** S · **Confidence:** Likely

## Code quality

### AUTH-CQ-01 · P2 · Backend tests send real email through Resend
- **Where:** `backend/apps/core/tests/test_rate_limiting.py:186-201`; `backend/config/settings.py:9`, `:180`; `docker-compose.yml` (`env_file: ./backend/.env`)
- **What:** Settings load `backend/.env` (`load_dotenv()`) and compose injects it too, so the backend container has a 36-character `RESEND_API_KEY` (checked by length only). `test_password_reset_request_is_rate_limited_by_ip` posts to `/api/auth/password-reset/` for `owner@example.com` without a mock, so its first request makes a real `POST https://api.resend.com/emails`. The feedback tests do mock the call.
- **Impact:** Every backend test run makes a real external HTTP call. That is slow and flaky offline, uses up the Resend quota, and sends mail to example.com, which bounces and can hurt the sender domain's reputation. Every future reset test will do the same.
- **Fix:** Add a test settings guard, either a `config/settings_test.py` or a shared base `TestCase` with `override_settings(RESEND_API_KEY="", PUSHER_APP_ID="")`. Patch `send_password_reset_email` in this test. The same risk probably applies to Pusher keys in other apps' tests.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-CQ-02 · P3 · The Resend client code is duplicated in `emails.py`
- **Where:** `backend/apps/users/emails.py:24-53` and `:104-133`
- **What:** The payload, headers, `requests.post`, exception handling and status check are copied verbatim.
- **Fix:** Extract `_send_resend_email(*, to: str, subject: str, text: str, kind: str) -> bool` and call it from both. That function is also the natural place for background dispatch (AUTH-PERF-05) and the test guard (AUTH-CQ-01).
- **Effort:** S · **Confidence:** Confirmed

### AUTH-CQ-03 · P3 · There are two forgot-password implementations, `/forgot-password` is unreachable, and `AuthCard` is oversized
- **Where:** `frontend/src/features/auth/components/AuthCard.tsx:78-96`, `:150-180`, `:54-56`; `frontend/src/features/auth/routes/ForgotPassword.tsx:13-85`; `frontend/src/app/routes/routes.tsx:49-52`
- **What:** `AuthCard` has an inline forgot mode. `ForgotPassword` is a full page with the same form and different copy, and nothing links to `/forgot-password` (grep). The `if (isForgot) return` branch in `handleSubmit` can never run, because the forgot form has its own submit handler. `ForgotPassword` and `ResetPassword` copy the card shell classes. `AuthCard` is 308 lines (over the 250-line rule) and mixes three forms with two layouts.
- **Fix:** Keep one implementation: delete the route, or turn "Forgot password?" into a link to it and remove the inline mode. Split `AuthCard` into `LoginForm`, `RegisterForm` and `ForgotForm`, sharing an `AuthField` and a `PasswordInput` with show/hide that `ResetPassword` can reuse too.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-CQ-04 · P3 · The serializers and lookups contain misleading and dead code
- **Where:** `backend/apps/users/serializers.py:24`, `:45-65`, `:81`; `backend/apps/users/views.py:31-37`, `:49-54`, `:66-74`
- **What:**
  - (a) The `email = serializers.EmailField` on `EmailTokenObtainPairSerializer` is overwritten by `TokenObtainSerializer.__init__` with a `CharField`, so email format is never validated. `username_field = "email"` exists only to make that work.
  - (b) `validate_password(value)` is called without `user`, so the configured `UserAttributeSimilarityValidator` never runs: a password equal to your own email is accepted, both at register and at reset.
  - (c) `_get_user_by_email` filters `email__iexact OR username__iexact`, which compiles to unindexed `UPPER()` comparisons, although every user has `username == lower(email)` (verified: 0 of 4 users differ).
  - (d) `from django.conf import settings` is imported inside `_build_reset_url`.
  - (e) `RegisterView` builds the token pair by hand, duplicating the login serializer.
- **Fix:**
  - Override `__init__` so `"email"` really is an `EmailField`, or subclass `TokenObtainSerializer` cleanly.
  - Pass `user=User(username=email, email=email, first_name=name)` to `validate_password` at register. At reset-confirm, validate inside the view after the user lookup, so the real user is passed.
  - Use `filter(username=email)` in `_get_user_by_email`.
  - Import `settings` at module level.
  - Add an `issue_tokens(user) -> dict` helper used by both register and login.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-CQ-05 · P3 · Auth state lives in three places held together by a window event
- **Where:** `frontend/src/utils/storage.ts`; `frontend/src/features/auth/stores/auth-store.tsx:24-85`; `frontend/src/lib/api-client.ts:26-65`; `frontend/src/lib/realtime.ts` (5× `getToken()`)
- **What:** The token is held in localStorage, in React state, and re-read ad hoc by api-client and realtime. Changes travel through a custom window event plus cross-tab `storage` events into a callback whose identity changes with `token`, so the listeners are re-bound on every change. `hydrateUser` handles boot, login, refresh and account switch with a single `isReady` flag. This design is the common root of AUTH-PERF-01, AUTH-PERF-02, AUTH-BUG-01 and AUTH-BUG-02.
- **Fix:** A small session module of about 80 lines: `session.get()`, `session.set({ access, refresh, user })` (one notify), `session.setAccess(access)` (no user refetch), `session.clear()` and `session.subscribe(fn)`, consumed through `useSyncExternalStore`. Track `status: "booting" | "authenticated" | "anonymous" | "offline"` instead of `isReady`. Cover it with unit tests (AUTH-TEST-19 to AUTH-TEST-25).
- **Effort:** M · **Confidence:** Confirmed

## UI / UX

### AUTH-UX-01 · P2 · Users see raw backend error strings
- **Where:** `frontend/src/lib/api-client.ts:116-138`; `frontend/src/features/auth/components/AuthCard.tsx:69-74`, `:87-92`; `frontend/src/features/auth/routes/ResetPassword.tsx:55-59`; `frontend/src/features/campaigns/components/settings/FeedbackReportCard.tsx:75-80`
- **What:** The client shows `detail`, `error` or the first field message verbatim. Users see "Request was throttled. Expected available in 3540 seconds.", "Failed to fetch" (network error or cold start), "Given token not valid for any token type" (session expiry), and only the first of several password-validator messages. The auth endpoints use three different error shapes (`non_field_errors`, a field dict, and `detail`). The pattern `err instanceof Error ? err.message : fallback` appears 27 times across the frontend, and `ApiError.status` is never read anywhere.
- **Fix:** Add `getErrorMessage(error, fallback)` in `lib/`:
  - 429 → "Too many attempts. Try again in N minutes." (from `Retry-After` or the `detail` seconds)
  - fetch `TypeError` → "Can't reach the server. It may be waking up, try again in a moment."
  - 5xx → a generic message
  - field errors → join all messages for the field

  Move the auth endpoints to the `{"detail", "code", "fields"}` error shape from ENGINEERING_RULES.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-UX-02 · P3 · Session expiry is silent and loses where the user was
- **Where:** `frontend/src/components/ProtectedRoute.tsx:23-25`; `frontend/src/features/auth/components/AuthCard.tsx:37-41`; `backend/config/settings.py:136-139`
- **What:** When the refresh token expires (a hard 30 days after login, with no sliding renewal because `ROTATE_REFRESH_TOKENS` is off), the user is bounced to `/` with no message. After signing in again, `AuthCard` always navigates to `/campaigns`.
- **Fix:** Use `<Navigate to="/" replace state={{ from: location, reason: "expired" }} />`, show "Your session expired, please sign in again", and navigate back to `state.from` after login. Rotating refresh tokens (AUTH-SEC-04) would mean active users never hit the 30-day wall.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-UX-03 · P3 · A cold-start login shows "Working..." with no explanation
- **Where:** `frontend/src/features/auth/components/AuthCard.tsx:257-260`; `frontend/src/features/auth/routes/Landing.tsx`
- **What:** If Render has spun the service down (free tier), the first request takes tens of seconds and the button just says "Working...".
- **Fix:** On `Landing` mount, fire `fetch(API_BASE_URL + "/keep-awake/", { method: "HEAD" })` and ignore the result. HEAD without custom headers is a simple CORS request, so it needs no preflight, and the server warms up while the user types. After 5 s of submitting, show "Waking the server, this can take up to a minute."
- **Effort:** S · **Confidence:** Speculative (depends on the Render plan)

### AUTH-UX-04 · P3 · The feedback report gives no success confirmation and hides its 2000-character limit
- **Where:** `frontend/src/features/campaigns/components/settings/FeedbackReportCard.tsx:64-74`, `:121-128`; `frontend/src/features/campaigns/routes/CampaignSettings.tsx:176-181`; `backend/apps/users/emails.py:104-108`
- **What:** On success the dialog simply closes, with no toast. The textarea has no `maxLength` or counter, so a long report fails only after typing, with "Ensure this field has no more than 2000 characters." The card exists only inside a campaign's Settings, not on `/campaigns` or the landing page. The email subject is just "Bug" or "Feedback", which makes inbox triage hard.
- **Fix:** Show a "Thanks, report sent" toast. Add `maxLength={2000}` and a counter. Also offer the card from the Campaigns page. Use a subject like `[Mordheim] Bug from <name>: <first 60 chars>`, and include the app version, user agent and current URL in the body.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-UX-05 · P3 · The reset and sign-up forms need polish
- **Where:** `frontend/src/features/auth/routes/ResetPassword.tsx:24`, `:46-54`, `:74`, `:113`; `frontend/src/features/auth/components/AuthCard.tsx:182-262`
- **What:** The reset page doesn't check the link until the user has typed two passwords. After success the form stays active, so resubmitting gives "Invalid or expired token", and there is no "Sign in" button. The copy says the link "expires after a short time" (it is 1 hour). There is no show-password toggle, although `AuthCard` has one. Register gives no hint of the password rules and has no confirm field.
- **Fix:** After success, replace the form with "Password updated" and a "Sign in" button. Say "valid for 1 hour". Reuse a shared `PasswordInput`. Add the hint "At least 8 characters, not a common password". Optionally, validate the token when the page loads.
- **Effort:** S · **Confidence:** Confirmed

### AUTH-UX-06 · P3 · There is no account management
- **Where:** `backend/apps/users/urls.py:12-24`; `frontend/src/features/campaigns/components/settings/PersonalSettingsCard.tsx:14-28`
- **What:** Signed-in users can't change their alias, email or password (only the reset-by-email flow exists), can't delete their account, and can't sign out other devices.
- **Fix:** Add `PATCH /auth/me` (name), `POST /auth/change-password` (current + new password; revokes other sessions through AUTH-SEC-04) and `DELETE /auth/me` (confirmed with the password; decide what happens to the user's warbands and owned campaigns). Add an Account card in settings and on the campaigns page.
- **Effort:** M · **Confidence:** Confirmed

### AUTH-UX-07 · P3 · The auth shell clips on short screens, doesn't announce errors, and loads a heavy video
- **Where:** `frontend/src/index.css:465-474`, `:549-554`; `frontend/src/features/auth/components/AuthShell.tsx:13-27`, `:93-104`; `frontend/src/features/auth/components/AuthCard.tsx:125-144`, `:167`, `:256`
- **What:**
  - `.landing { height: 100vh; overflow: hidden }` can clip the register form with no way to scroll, on landscape phones or zoomed desktops.
  - Error and notice paragraphs are not live regions, so screen readers don't announce failures.
  - The Sign in / Create Account switch has no `aria-pressed` or tab semantics.
  - On desktop, every auth page (reset-password included) loads an autoplaying `youtube.com` iframe, adding third-party JS and cookies to the first visit.
- **Fix:** Use `min-height: 100dvh; overflow-y: auto`. Put `role="alert"` on error text. Add `aria-pressed` to the mode buttons. Switch to `youtube-nocookie.com`, defer the iframe until after first paint, and skip it on the forgot and reset pages.
- **Effort:** S · **Confidence:** Likely

## Security

**Token storage tradeoff.** Tokens in localStorage are readable by any script on the origin. That is acceptable only if there are no XSS sinks and sessions can be revoked, and today neither holds (AUTH-SEC-02, AUTH-SEC-04). An httpOnly refresh cookie is the hardened alternative, but between `*.vercel.app` and `*.onrender.com` it would be a third-party cookie, which Safari and Firefox block. That option only opens up once the API is same-origin (the Vercel rewrite in AUTH-PERF-03) or both sites share a custom domain. The pragmatic path is to remove the XSS sink, add CSP and revocation, and shorten the access-token lifetime once AUTH-BUG-02 is fixed.

### AUTH-SEC-01 · P1 · `SECRET_KEY` silently falls back to `"dev-secret-key"`, which also signs every JWT and reset token
- **Where:** `backend/config/settings.py:27`, `:136-139`
- **What:** `SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key")`. SimpleJWT's `SIGNING_KEY` defaults to `SECRET_KEY`, and `PasswordResetTokenGenerator` uses it too. Nothing refuses to start with the default when `DEBUG` is off. The live-run log shows PyJWT's `InsecureKeyLengthWarning` ("The HMAC key is 14 bytes long") because compose sets the dev key.
- **Impact:** If `DJANGO_SECRET_KEY` is not set on Render, anyone who knows the default (it is in the source) can mint an access token for any user id, or forge reset tokens. That is a full takeover of every account, and P0 if the variable is unset.
- **Fix:**
  ```python
  if not DEBUG and (SECRET_KEY == "dev-secret-key" or len(SECRET_KEY) < 50):
      raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set to a long random value")
  ```
  Check the Render env now. If it was ever unset, rotate the key (this logs everyone out once).
- **Effort:** S · **Confidence:** Confirmed (code) / Speculative (production value)

### AUTH-SEC-02 · P1 · Stored XSS in campaign locations can steal 30-day refresh tokens from localStorage
- **Where:** `frontend/src/features/campaigns/components/LocationsTable.tsx:44-48`; `backend/apps/campaigns/serializers.py:323-341`; `backend/apps/campaigns/views.py:920-955`; `backend/apps/campaigns/permissions.py:16-24`; `frontend/src/utils/storage.ts:1-2`
- **What:** `CampaignLocationWriteSerializer` accepts `content` as raw text. The backend never sanitises it (there is no bleach or nh3 anywhere), and `LocationsTable` renders it with `dangerouslySetInnerHTML`. Anyone with `manage_locations` can store a payload such as `<img src=x onerror=...>`. That includes every campaign owner and admin, and any registered user can create a campaign and share its join code. The tokens sit in localStorage under fixed, well-known keys (`mordheim_token`, `mordheim_refresh_token`).
- **Impact:** Every member who expands that location sends their refresh token to the attacker. It stays valid for 30 days, and neither logging out nor resetting the password revokes it (AUTH-SEC-04). This is the concrete cost of the localStorage choice.
- **Fix:** Do both:
  - Sanitise on write with an nh3 allow-list (`p, br, strong, em, ul, ol, li, h3, h4, table, thead, tbody, tr, th, td`).
  - Sanitise on render with DOMPurify.

  Also add a Content-Security-Policy header in `vercel.json` (`script-src 'self'`, `frame-src https://www.youtube-nocookie.com`) to blunt future sinks. The Locations feature belongs to the Campaigns area: cross-reference CAMP.
- **Effort:** S · **Confidence:** Confirmed (code path; not exploited)

### AUTH-SEC-03 · P2 · The auth throttles are easy to bypass or weaken in production
- **Where:** `backend/config/settings.py:132-134`, `:165-170`; `backend/apps/core/throttling.py:28-38`
- **What:**
  - (a) `RATE_LIMIT_NUM_PROXIES` is unset in the local env and documented nowhere. With `NUM_PROXIES=None`, DRF uses the *whole* `X-Forwarded-For` header (spaces stripped) as the identity. Behind Render's proxy, a client that sends its own random `X-Forwarded-For` gets a fresh bucket on every request. The tests force `NUM_PROXIES=1`, so they can't catch this.
  - (b) LocMemCache is per process. With `gunicorn -w N` or several Render instances, every limit is multiplied by N and enforced inconsistently, and all counters reset on each deploy or restart.
  - (c) `MAX_ENTRIES=300` with a 1/3 cull (measured), so many distinct keys evict real request histories.
  - (d) `SimpleRateThrottle` does a non-atomic read-modify-write.
- **Impact:** The login throttle won't stop a scripted brute-force attempt. Each login attempt costs one PBKDF2 hash (720,000 iterations, 0.08 s on a desktop core, several times more on a fractional Render CPU), so unthrottled login spam is also a cheap way to saturate the instance.
- **Fix:** Set `RATE_LIMIT_NUM_PROXIES=1` on Render, after confirming the format of the XFF header Render sends (consider `True-Client-IP` or `CF-Connecting-IP` if present), and fail startup when it is unset and `DEBUG` is off. When moving to several workers, point the throttle cache at Redis (Render Key Value). Not `DatabaseCache`: that would add Neon round trips to every throttled POST. If staying on LocMem, raise `MAX_ENTRIES`.
- **Effort:** S · **Confidence:** Likely

### AUTH-SEC-04 · P2 · There is no way to revoke a session: logout is client-only, and a password reset leaves old tokens valid
- **Where:** `backend/config/settings.py:136-139`; `frontend/src/features/auth/stores/auth-store.tsx:121-126`; `backend/apps/users/views.py:123-129`
- **What:** `SIMPLE_JWT` sets only the lifetimes (access 1 day, refresh 30 days). There is no blacklist app, no rotation, and `CHECK_REVOKE_TOKEN` is off. `signOut` only deletes localStorage. After a password reset, every previously issued token keeps working for up to 30 days.
- **Impact:** A stolen token (via AUTH-SEC-02, a shared computer, or copied localStorage) can't be invalidated by its victim.
- **Fix:**
  - (1) Set `"CHECK_REVOKE_TOKEN": True`, which the installed SimpleJWT 5.3.1 supports. Tokens then embed a hash of the password and stop working once it changes. It costs no extra query, because `JWTAuthentication.get_user` already loads the user, and refreshed access tokens copy the claim. Switching it on logs everyone out once.
  - (2) Add `rest_framework_simplejwt.token_blacklist`, a `POST /auth/logout/` that blacklists the refresh token, and `ROTATE_REFRESH_TOKENS` plus `BLACKLIST_AFTER_ROTATION`. These write on each refresh, which is rare.
  - (3) Then cut `ACCESS_TOKEN_LIFETIME` to 15-30 minutes, but only after AUTH-BUG-02 is fixed.
- **Effort:** S for (1), M for (2) and (3) · **Confidence:** Confirmed

### AUTH-SEC-05 · P3 · Accounts can be enumerated, and emails are never verified
- **Where:** `backend/apps/users/serializers.py:16-21`; `backend/apps/users/views.py:102-109`
- **What:** Register answers "User already exists" for a taken address (throttled to 3/hour per IP, but bypassable per AUTH-SEC-03). Reset returns a generic message but takes noticeably longer when the account exists (the synchronous Resend call). There is no email verification, so anyone can register an address they don't own.
- **Impact:** Low for a hobby campaign app. The list of players' emails is discoverable, and an address can be squatted (the real owner can recover it with a reset, since they control the inbox).
- **Fix:** Either accept and document this, or move register to a "check your inbox" verification-link flow. Make reset asynchronous (AUTH-PERF-05) so its timing is constant.
- **Effort:** M · **Confidence:** Confirmed

### AUTH-SEC-06 · P3 · The reset token travels in the query string
- **Where:** `backend/apps/users/views.py:49-54`; `frontend/src/features/auth/routes/ResetPassword.tsx:14-16`
- **What:** `?uid=…&token=…` lands in browser history and Vercel access logs. The token stays valid for an hour, or until the password changes. The YouTube iframe on the page already gets only the origin (`strict-origin-when-cross-origin`), so the Referer is not a leak.
- **Fix:** Put both values in the fragment (`/reset-password#uid=…&token=…`), which is never sent to a server, and call `history.replaceState` to strip it once read.
- **Effort:** S · **Confidence:** Confirmed

## Test plan

### Existing coverage

| File | Tests | What they cover |
| --- | --- | --- |
| `backend/apps/core/tests/test_rate_limiting.py` (537 lines) | 21 | A snapshot of the rate settings. Login, register, password reset, reset confirm and refresh throttles (by forwarded IP with `NUM_PROXIES=1`, including `Retry-After` and no leak between IPs). Feedback user and IP limits. Chat, ping, battle and trade write limits plus their IP backstops. Health and keep-awake are not throttled. A normal battle flow stays under the limits. Register, login, refresh and reset are exercised only incidentally, as throttle targets. |
| `backend/apps/users/tests/test_feedback_report_api.py` (143 lines) | 6 | Happy path, auth required, blank message, more than 2000 characters, 503 when the send fails, and the email helper's payload (with `requests.post` mocked). |
| `frontend/src/features/campaigns/components/settings/FeedbackReportCard.test.tsx` | 5 | Renders, blocks blank submissions, switches placeholder by type, closes and clears on submit, shows API errors inline. |

There are no tests for register, login, refresh or `/me` behaviour, password reset (request or confirm), token expiry or revocation, health and keep-awake semantics, or settings guards. On the frontend, `api-client`, `auth-store`, `storage`, `ProtectedRoute`, `AuthCard`, `ForgotPassword` and `ResetPassword` are untested.

### Gaps and proposed tests

| ID | Level | Scenario | Expected result | Priority |
| --- | --- | --- | --- | --- |
| AUTH-TEST-01 | API | Register with a valid email, password and name | 201 with `access`, `refresh` and `user`; email lowercased; `username == email`; `first_name == name` | P1 |
| AUTH-TEST-02 | API | Register `Foo@X.com` after `foo@x.com` exists | 400 `{"email": [...]}`; no second user | P1 |
| AUTH-TEST-03 | API | Register with passwords `12345678`, `password`, `short`, and one equal to the email (after AUTH-CQ-04) | 400, with **all** validator messages returned | P2 |
| AUTH-TEST-04 | API | Register with a 151-character email or a 151-character name | 400, not 500 (AUTH-BUG-07) | P2 |
| AUTH-TEST-05 | API | Login: correct credentials / wrong password / unknown email / inactive user | 200 with tokens / identical 400 "Invalid credentials" for the three failures | P1 |
| AUTH-TEST-06 | API | Login with `Owner@Example.COM` for `owner@example.com` | 200 | P2 |
| AUTH-TEST-07 | API | Refresh with a valid, expired (`freezegun` +31 days) and garbage token | 200 with a new `access` / 401 `token_not_valid` / 401 | P1 |
| AUTH-TEST-08 | API | `GET /auth/me` with a valid token, no token, and an expired token | 200 `{id, email, name}` within `assertNumQueries(1)` / 401 / 401 | P1 |
| AUTH-TEST-09 | API | Password reset for an existing and an unknown email (mock `send_password_reset_email`) | Identical status and body; the mock is called once, for the existing user only, with a URL starting with `FRONTEND_URL` and containing `uid` and `token` | P1 |
| AUTH-TEST-10 | API | Reset confirm with a valid token, then the same token again | 200; login with the new password works and the old one fails; the reuse gets 400 "Invalid or expired token" | P1 |
| AUTH-TEST-11 | API | Reset confirm after `PASSWORD_RESET_TIMEOUT` (freezegun) | 400 | P2 |
| AUTH-TEST-12 | API | Reset confirm with uid `YWJj`, `!!!`, the base64 of a huge number, and an empty string | 400, never 500 (AUTH-BUG-06) | P2 |
| AUTH-TEST-13 | API | After `CHECK_REVOKE_TOKEN`: issue tokens, reset the password, then call `/me` with the old access token and `/refresh` with the old refresh token | 401 / the new access token fails on `/me` (AUTH-SEC-04) | P1 (after fix) |
| AUTH-TEST-14 | API | Health and keep-awake via GET and HEAD, with no header and with `Authorization: Bearer garbage` | 2xx in every case, 0 queries (after AUTH-PERF-04/06) | P3 |
| AUTH-TEST-15 | Unit | Test settings guard: `RESEND_API_KEY` is empty in tests; `requests.post` is never called during the suite (autouse patch that fails if called) | No external HTTP (AUTH-CQ-01) | P1 |
| AUTH-TEST-16 | Unit | `_send_resend_email` when `requests` raises, and on a Resend 4xx/5xx | Returns `False` and logs; never raises | P3 |
| AUTH-TEST-17 | Unit | Throttle identity with `NUM_PROXIES=1` and XFF `"6.6.6.6, 203.0.113.9"` | Bucket keyed on `203.0.113.9`; a rotating spoofed prefix doesn't reset the count (AUTH-SEC-03) | P2 |
| AUTH-TEST-18 | Unit | Import settings with `DJANGO_DEBUG=0` and the default `SECRET_KEY`, or without `RATE_LIMIT_NUM_PROXIES` or `FRONTEND_URL` (subprocess) | `ImproperlyConfigured` (AUTH-SEC-01, AUTH-BUG-05) | P1 |
| AUTH-TEST-19 | Unit (Vitest) | `api-client`: three parallel requests all get 401 | Exactly one `/auth/refresh/`; all three retry with the new token and resolve | P1 |
| AUTH-TEST-20 | Unit (Vitest) | `api-client`: refresh returns 401, then refresh returns 503 or the network fails | 401 clears both tokens and throws `ApiError` 401; 503 or network failure **keeps** the tokens (AUTH-BUG-01) | P1 |
| AUTH-TEST-21 | Unit (Vitest) | `api-client`: the retried request gets 401 again | Throws; only one refresh; no loop | P2 |
| AUTH-TEST-22 | Component | `AuthProvider` `signIn` / `signUp` with mocked fetch | Exactly one `/auth/me` on login and none on register (AUTH-PERF-02) | P2 |
| AUTH-TEST-23 | Component | Boot with a cached user while `/me` is pending; boot where `/me` returns 500 | Children render immediately; on 500 the tokens are kept and a retry UI shows (AUTH-PERF-01, AUTH-BUG-01) | P1 |
| AUTH-TEST-24 | Component | Token refresh while a protected child holds local state (a typed input) | The child is not unmounted and its state survives (AUTH-BUG-02) | P1 |
| AUTH-TEST-25 | Component | Seed app-store notifications as user A, `signOut`, sign in as user B | Store empty for B (AUTH-BUG-03) | P2 |
| AUTH-TEST-26 | Component | `AuthCard` with a 429 response carrying `Retry-After`, a fetch `TypeError`, and a two-message password error | Friendly throttle text, an offline hint, both password messages shown (AUTH-UX-01) | P3 |
| AUTH-TEST-27 | Component | `ResetPassword` with missing params, mismatched passwords, and a success response | Submit disabled with the explanation; "Passwords do not match"; form replaced by a success state with a Sign in link (AUTH-UX-05) | P3 |
| AUTH-TEST-28 | Component | `ProtectedRoute` when unauthenticated at `/campaigns/1/settings`, then login | Redirect to `/` carrying `state.from`; after login, lands back on `/campaigns/1/settings` (AUTH-UX-02) | P3 |
| AUTH-TEST-29 | Component | `FeedbackReportCard` with 2001 characters typed, and on success | Input capped at 2000 and a counter shown; success toast (AUTH-UX-04) | P3 |
| AUTH-TEST-30 | Component | Pusher auth header after a token change (mock pusher-js) | `headersProvider` returns the current token (AUTH-BUG-08) | P3 |
| AUTH-TEST-31 | API + manual | Location content `<img src=x onerror=alert(1)>` saved, then fetched and rendered | Stored or returned sanitised (no `onerror`); no alert when the row is expanded (AUTH-SEC-02) | P1 |

### Manual QA script

Setup: local stack running (`docker compose up`). Use two browser profiles: **A** (normal Chrome) and **B** (Firefox or a Chrome guest profile). Keep DevTools open on Network with "Preserve log", and use `docker logs -f mordheim-backend-1` as the server-side request log.

1. **Register (A).** Create an account with a new email, an alias and a valid password. Expect to land on `/campaigns`. In Network, count `/auth/me` (today 2, target 0-1), `/notifications/` (today 3, target 1) and `/realtime/pusher/auth/` (today 3, target 1).
2. **Register validation.** Try an existing email in different case (expect "User already exists"), `password` (expect all validator messages, not just one), and a 200-character alias (expect a field error, not "Request failed (500)").
3. **Logout and login (A).** Click "Log out" on `/campaigns`. Expect the landing page, with `mordheim_token` and `mordheim_refresh_token` gone from Application → Local Storage. Log in with a wrong password ("Invalid credentials"), then the right one. Count `/auth/me` calls: today 3, target 1.
4. **Reload waterfall.** Open `/campaigns/1` and reload. Confirm that `/auth/me` finishes before any campaign request starts (today), and that after the AUTH-PERF-01 fix the campaign requests start immediately.
5. **Expired access token.** Type a chat message without sending it. In Local Storage, replace `mordheim_token` with `x`, then open a warband. Expect exactly one `POST /auth/refresh/`, then a successful request. Today the page flashes `LoadingScreen`, refetches everything and loses the chat draft (AUTH-BUG-02). After the fix: no flash, and the draft survives.
6. **Expired refresh token.** Set both tokens to `x` and click anything. Expect a redirect to `/` with no loop. After AUTH-UX-02: a "session expired" message, and after logging in you are back on the same page.
7. **Server outage during reload.** Run `docker stop mordheim-backend-1`, then reload `/campaigns`. Today: the tokens are wiped and you are logged out (AUTH-BUG-01). After the fix: a "Can't reach the server" screen with Retry, tokens intact. Run `docker start mordheim-backend-1` and retry: you are still logged in.
8. **Multi-tab.** Open `/campaigns/1` in two tabs of A. Corrupt the access token in tab 1 and act there. Today tab 2 also flashes and reloads its data. After the fix, neither tab remounts.
9. **Shared device (multi-user).** Log in as X in A and as Y in B, both members of campaign 1. In B, Y invites X to a battle; leave it pending in A. In A, log out and log in as a third user Z. Today Z sees X's battle invite or current-battle banner (AUTH-BUG-03). Expected: nothing from X.
10. **Shared IP throttle (multi-user).** With `RATE_LIMIT_ENABLED` on, register four accounts from the same machine within an hour. Today the 4th gets 429 "Expected available in ~3540 seconds" (AUTH-BUG-04, AUTH-UX-01). After the fix, all four succeed, and any throttle message is human-readable.
11. **Password reset, happy path.** Unset `RESEND_API_KEY` locally, or patch the send, so no real mail goes out. Generate a link with `docker exec mordheim-backend-1 python manage.py shell -c "..."` (`urlsafe_base64_encode` plus `PasswordResetTokenGenerator().make_token`), or read it from a debug log. Submit "Forgot password?" for an existing email and then for an unknown one: the same message, with similar timing after AUTH-PERF-05. Open `/reset-password?uid=…&token=…`. Mismatched passwords show an error, `password1` shows the validator errors, and a valid password shows success. Reuse the same link and get "Invalid or expired token". The new password logs in and the old one fails.
12. **Reset expiry.** Restart the backend with `PASSWORD_RESET_TIMEOUT=60`, generate a link, wait 61 s and submit. Expect "Invalid or expired token".
13. **Malformed link.** Open `/reset-password?uid=YWJj&token=x` and submit a valid password. Expect "Invalid or expired token", not "Request failed (500)" (AUTH-BUG-06).
14. **Old sessions after reset (multi-user, same account).** Log in as the same user in A and B. Reset the password from A. After AUTH-SEC-04, B's next action returns 401 and lands on the login page. Today B stays logged in.
15. **Feedback report.** Open campaign Settings → Send report. Blank is blocked. 2001 characters are capped once AUTH-UX-04 is fixed. Send succeeds and shows a toast after the fix. With `FEEDBACK_REPORT_TO_EMAIL` unset, expect the inline "Unable to send feedback report right now." Four sends within a minute give a readable throttle message.
16. **Health and keep-awake.** `curl -I http://localhost:8000/api/keep-awake/` → 204. `curl -i http://localhost:8000/api/keep-awake/` → 405 today, 204 after the fix. `curl -i -H "Authorization: Bearer x" http://localhost:8000/api/health/` → 401 today, 200 after the fix.
17. **Production configuration (Render and Vercel dashboards).** Check that `DJANGO_SECRET_KEY` is set and long, `RATE_LIMIT_NUM_PROXIES=1`, `FRONTEND_URL` is the Vercel URL, `DEFAULT_FROM_EMAIL` is on a Resend-verified domain, and `VITE_API_BASE_URL` is set. On the production site, open a campaign overview with DevTools and count `OPTIONS` requests (AUTH-PERF-03). Request a reset for your own account and confirm the link points at the Vercel domain.
18. **Mobile layout.** Open the landing page at 375×667, then landscape at 667×375. In register mode, every field and the submit button must be reachable, and errors visible, with the on-screen keyboard open. Repeat for `/reset-password`.
19. **XSS check (multi-user).** As the campaign owner, enable Locations and create a location whose content is `<img src=x onerror="alert(document.domain)">`. As a member in B, open Locations and expand the row. Today the alert fires (AUTH-SEC-02). After the fix, nothing executes and the stored content is sanitised.
