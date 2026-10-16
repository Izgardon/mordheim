# Engineering Rules

The base rules every change to Mordheim Chronicler should follow. They come out of the October 2026 review (`docs/review/`). Each rule exists because the codebase currently breaks it somewhere.

Rules marked **(proposed)** depend on a decision still open in the review. Confirm or amend them before the first feature pass. The condensed version lives in the repo's `CLAUDE.md`.

## 0. Principles

1. **The server is the source of truth.** Business rules (costs, XP thresholds, level-ups, permissions, battle outcomes) live in the backend. The frontend displays them and does not re-implement them.
2. **Query count is latency.** Production talks to Neon in London from Render in Frankfurt, so every SQL query is a network round trip. A screen should load in a small, fixed number of queries, whatever the size of the warband or campaign.
3. **Small, single-purpose units.** If a file needs scrolling to understand, split it. If two blocks look alike, they should be one thing.
4. **Behaviour changes and refactors never share a commit.** A refactor PR must leave behaviour identical (tests prove it); feature or bug-fix PRs change behaviour on purpose.
5. **Green stays green.** Tests, lint, format and typecheck pass on every commit, and the tooling enforces it.

## 1. Backend (Django + DRF)

### Structure

- **Views stay thin:** parse the request, check permissions, call a service, return a serializer. No business logic in views.
- **Business logic goes in services:** `apps/<app>/services/<topic>.py`, as plain functions that take models and values and return results, so they can be unit-tested without HTTP.
- **Serializers shape data only.** A `SerializerMethodField` must not run a query unless the data was prefetched by the view.
- **Size limits** (soft, but anything over needs a reason): files ≤ **400 lines**, functions ≤ **60 lines**, views ≤ **40 lines per method**.
- **Shared unit behaviour is written once.** Heroes, henchmen groups and hired swords share stats, XP, level-ups, items, skills and specials, so they share base models, serializer mixins and service functions. Unit-type differences are expressed as configuration, not copy-paste.

### Queries and performance

- Every list or detail endpoint declares its `select_related` / `prefetch_related` (or uses `Prefetch(...)` with a filtered queryset).
- **No queries inside loops.** Aggregate in the database (`annotate`, `Count`, `Sum`, `Subquery`) and write with `bulk_create` / `bulk_update`.
- **Every heavy endpoint has a query budget**, enforced with `assertNumQueries` in tests. The budget must not grow with row count.
- Don't return more than the screen needs. Catalogue data is fetched once and cached, not embedded in every response.
- Read-mostly, shared data (catalogue, rules) is cacheable: send `ETag` / `Cache-Control` and invalidate on write.
- Filtered and ordered columns get indexes; composite filters get composite indexes.

### Writes, money and concurrency

- Multi-row writes run inside `transaction.atomic()`.
- **Gold, stock and XP change through `F()` expressions or under `select_for_update()` on the owning row**, never read-modify-write in Python.
- Every gold change writes its ledger row in the **same transaction**. Ledger and balance can't drift.
- One-shot actions (finalise battle, complete trade, level-up) are **idempotent**: a repeat request is detected and returned unchanged, never applied twice.
- Hold locks for as short a time as possible, and never across an external HTTP call.

### Permissions

- **Every endpoint enforces permissions server-side**, through one helper or DRF permission class per resource (`can_view_warband`, `can_edit_warband`, ...). Frontend gating is only cosmetic.
- API responses include the capability flags the UI needs (`can_edit`, `can_manage_items`, ...), so the UI never shows an action the server will reject.

### External services (Pusher, Resend)

- **Never block the response on an external call.** Dispatch after commit (`transaction.on_commit`) to a background worker or thread, with a short timeout. Log failures; don't raise them.
- **Realtime events carry the change itself**, or enough to update the client's cache, rather than a bare "something changed, refetch everything" ping that makes every connected client re-request the world.

### Errors, typing, settings

- Errors use one shape: `{"detail": str, "code": str, "fields": {name: [msg]}}`.
- `ruff check`, `ruff format --check` and `mypy` pass. No untyped dynamic model lookups (`object` types).
- **Settings are secure by default.** `DEBUG` is off unless explicitly enabled, secrets have no fallback values in production, and persistent DB connections are configured.
- **Migrations** contain one logical change each; data migrations are reversible where possible.

## 2. Frontend (React + TypeScript)

### Structure

- Feature folders follow `features/<feature>/{api,hooks,components,routes,utils,types}`.
- **Route files are thin composition:** route → hooks (data + state) → presentational components. A route file is ≤ **250 lines**; components are ≤ **250 lines**, and anything over gets split by sub-section.
- Components shared across heroes, henchmen and hired swords take a `unitKind` (or config object) instead of being triplicated.

### Data and state

- All server state goes through **TanStack Query** (decided 2026-10-16): cached, de-duplicated, invalidated by query key after mutations. No ad-hoc `fetch` in `useEffect`, and no copying server data into global context.
- **Global context holds only small, rarely-changing app state** (current user, current campaign id, UI preferences). No single mega-store whose every update re-renders the tree.
- **After a mutation, update or invalidate only the affected query keys**, not "refetch the whole warband". Use optimistic updates only with rollback on error.
- **Realtime handlers update the query cache from the event payload.** They refetch only as a fallback.

### Behaviour and UX

- Every async action has **loading, error and success** states, and errors are shown to the user, not swallowed.
- **Destructive actions** (delete, dismiss, sell, cancel battle) ask for confirmation, or offer undo.
- Hide or disable actions the user can't perform, based on API capability flags.
- **Battle screens are mobile-first.** They're used at the table on phones.
- **Accessibility:** interactive elements are real `<button>` / `<a>` with labels; custom dropdowns and comboboxes use Radix/cmdk primitives so they work by keyboard.

### Types and lint

- `tsc --noEmit` passes, with TypeScript strict mode on.
- No `any` without a comment explaining why.
- Unused variables, props and exports are removed, not left behind.

## 3. Testing

- **Every bug fix ships with a test that fails before the fix.**
- **Backend:** per endpoint, cover the happy path, permission denied, validation error and not found; add `assertNumQueries` for list and detail endpoints; add concurrency tests for gold, trades and battle finalisation where practical.
- **Frontend:** one test file per unit, **next to the code** (no duplicate copies in `__tests__/`). Test behaviour through Testing Library (what the user sees and does), not implementation details. Pure utils get unit tests.
- **(proposed) E2E:** Playwright covers the golden paths: register → join → build warband → 2-player battle → postbattle → level-up.
- Tests run in CI on every push.

## 4. Definition of done (every PR)

- [ ] Behaviour change **or** refactor, not both
- [ ] Tests added or updated, and a regression test for any bug fixed
- [ ] Backend: `manage.py test`, `ruff check`, `ruff format --check`, `mypy` all pass
- [ ] Frontend: `vitest run` and `tsc --noEmit` pass
- [ ] Query counts for touched endpoints measured and within budget (before/after in the PR description)
- [ ] The feature's manual QA script (from `docs/review/features/*.md`) run in the browser, including mobile width for battle and warband screens
- [ ] The feature file in `docs/review/` updated: findings marked fixed, status table updated
