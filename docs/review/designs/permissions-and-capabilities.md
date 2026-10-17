# Design 0.29 · One permission pattern + capability flags

> Status: **draft for sign-off** (PLAN 0.29, IMP-25). Each feature pass applies it to its own endpoints: pass 1 warbands (IMP-28), pass 2 trades (IMP-40), pass 3 battles (IMP-53), pass 4 campaigns (IMP-63/64), pass 5 catalogue (IMP-79). Companion: [unit-abstraction.md](unit-abstraction.md) (0.28), whose generic unit views sit on `WarbandScopedView`.
> Verified against `chore/foundations-0d` (6198d6a) on 2026-10-17. Line numbers are from that commit.

## 1. Goal and non-goals

**Goal.** One way to answer "may this user do this here?", written once per resource and used twice: to **enforce** on the endpoint and to **report** as a capability flag in the payload. The UI renders a control only when its flag is true, so it can no longer offer an action the server rejects (ENGINEERING_RULES §1 Permissions, §2 Behaviour).

**Non-goals.** No new roles. No product changes to who may do what. Those are separate decisions (§7), and the pattern is built so that each decision is a one-line rule change that the UI follows automatically. No change to status codes: non-members get 404, members without the right get 403, as today.

## 2. Today (verified)

### 2.1 The model

- Roles: `owner`, `admin`, `player` (`CampaignRole`, `campaigns/models.py:134-145`). Grants: `CampaignMembershipPermission` → `CampaignPermission(code)` (`:151-195`).
- `has_campaign_permission` treats owner and admin as holding every code; players need a row (`campaigns/permissions.py:16-24`). Joining grants `add_custom` (`campaigns/views.py:556-560`).
- Codes are defined in **three** places: `PERMISSION_SEED` (`campaigns/views.py:85-94`, 8 codes, seeded lazily by `_ensure_permissions`, `:110-120`), the seed command (`campaigns/management/commands/seed_campaign_users.py:22-30`, 7 codes), and the frontend grant list (`frontend/src/features/campaigns/constants/campaign-settings.ts:3-34`, 6 codes). No migration seeds them.

### 2.2 Every code checked in the backend

| Code | Checked at | Gate |
| --- | --- | --- |
| `add_custom` | `items/views.py:101`, `:230`; `skills/views.py:46`; `spells/views.py:46`; `special/views.py:46` | create custom item, property, skill, spell, special |
| `manage_items` | `items/views.py:150`, `:185` | PATCH / DELETE custom item |
| `manage_skills` | `skills/views.py:83`, `:104` | PATCH / DELETE custom skill |
| `manage_spells` | `spells/views.py:83`, `:104` | PATCH / DELETE custom spell |
| `manage_features` | `special/views.py:83`, `:104` | PATCH / DELETE custom special |
| `manage_rules` | `campaigns/views.py:1176`, `:1194`, `:1214` | house rules create / edit / delete |
| `manage_warbands` | `warbands/permissions.py:46` (`CanEditWarband`, used by 27 handlers); `bestiary/views.py:172`, `:197`; dead copy `warbands/views/helpers.py:19` | edit any warband; bestiary favourites |
| `manage_encampments` | `campaigns/views.py:876`, `:898` | create / edit encampments (plus feature flag) |
| `manage_locations` | `campaigns/views.py:938`, `:957` | create / edit locations (plus feature flag) |
| `manage_bestiary` | `bestiary/views.py:64`, `:113`, `:138`, `:294`, `:373`, `:430` | bestiary entries and hired-sword profiles |

Role- and ownership-only checks: owner for campaign DELETE (`campaigns/views.py:458`), PATCH incl. `in_progress` (`:472`), active battles (`:702`, `:745`), role change (`:1116`), member removal (`:1145`); owner or admin for the members list (`:995`) and grants (`:1076`) and race edit (`races/views.py:74`); warband's own user for warband DELETE (`warbands/views/warbands.py:270`); bulletin author for bulletin DELETE (`campaigns/views.py:849`); battle creator (`battles/views/lifecycle.py:971`, `:1001`; `combat.py:330`); trade participants (`trades/views.py:406` and 5 more). `POST /restrictions/` checks nothing beyond login (`restrictions/views.py:43-50`, SEC-06).

### 2.3 Drift

| Code | Checked | In `PERMISSION_SEED` | In seed command | Grantable in UI | Effect |
| --- | --- | --- | --- | --- | --- |
| `manage_spells` | yes | **no** | no | no | Only owner/admin can ever edit or delete custom spells. The grant API silently drops unknown codes (`campaigns/views.py:1095`). |
| `manage_features` | yes | **no** | no | no | Same for specials. |
| `manage_encampments` | yes | yes | **no** | **no** | Owners can't delegate encampments; DBs built by the seed command lack the row. |
| `manage_bestiary` | yes | yes | yes | **no** | Owners can't delegate the bestiary from the UI. |
| the other six | yes | yes | yes | yes | consistent |

`GET /campaigns/:id/permissions/` already returns the seeded list (`campaigns/views.py:1032-1043`) but nothing calls it.

### 2.4 Membership is fetched again and again

| Request | Queries before any work (excl. JWT user) | Where |
| --- | --- | --- |
| Warband write by its owner | 2: warband, membership | `warbands/views/mixins.py:30-35`; `CanViewWarband` `warbands/permissions.py:22` |
| Warband write by an admin | 3: + membership again | `CanEditWarband` `warbands/permissions.py:42` |
| Warband write by a `manage_warbands` player | 4: + permission `EXISTS` | `campaigns/permissions.py:21-24` |
| Location / encampment write | 3: membership, feature flag, permission | `campaigns/views.py:933-938`, `_campaign_feature_enabled` `:169-171` |
| Campaign detail | 2–3: membership, campaign, codes (players) | `_get_campaign_for_user` `:145-157`, `_permission_codes_for` `:430-438` |

`get_membership(` has about 84 live call sites (32 in `campaigns/views.py` alone); the warband preamble is hand-written in 43 handlers (43 `CanViewWarband`, 27 `CanEditWarband` calls). On the frontend, nine pages each fetch `/permissions/me/` on mount: `Bestiary.tsx:69`, `HiredSwords.tsx:54`, `Encampments.tsx:72`, `Locations.tsx:73`, `Items.tsx:312`, `HouseRules.tsx:103`, `Skills.tsx:116`, `Spells.tsx:110`, and `useCampaignMemberPermissions.ts:32` (warband page). Since 6198d6a, `GET /campaigns/:id/` carries `permissions: string[]` (`campaigns/views.py:450`), so these fetches are redundant.

### 2.5 How the frontend gates today

Each page re-derives rights from `campaign.role` plus fetched codes: `Warband.tsx:296-302` (`canEdit = owner-of-warband || staff || manage_warbands`), `Items.tsx:213-220`, `Skills.tsx:61-64`, `Spells.tsx:60-63`, `HouseRules.tsx:52-55`, `Encampments.tsx:62-64`, `Locations.tsx:63-65`, `Bestiary.tsx:61-63`, `HiredSwords.tsx:46-48`; role-only flags in `useCampaignOverview.ts:226`, `use-campaign-settings.ts:54-57`, `CampaignSettings.tsx:42`, `:117`, `WarbandDiceSettingsCard.tsx:46-48`. `canEdit` is then drilled through `WarbandTabContent` into sections and cards, and some leaves never receive it.

### 2.6 Where the UI and the server disagree (each verified)

**Shown, then rejected:**

| UI action | Frontend | Server | Result |
| --- | --- | --- | --- |
| Hero "Trade" badge | a button for anyone while `trading_action` is true, no `canEdit` prop (`warbands/components/heroes/blocks/HeroCardHeader.tsx:84-93`); `try/finally` without `catch` (`:37-45`) | hero PATCH needs `CanEditWarband` (`views/heroes.py:155`) | 403, dialog stuck, unhandled rejection (BUG-31) |
| XP +/- on every unit | `ExperienceBar.tsx:65-77`, `:113-124`, shown when `isMobile \|\| isHovered` (`:41`) with no edit check; 9 render sites (hero/henchmen/hired-sword summary and expanded cards); `useExperienceBar.ts:123-125` has no `catch` | unit PATCH needs `CanEditWarband` | optimistic change snaps back, silent 403 |
| Pending "New Skill/Spell" entries | `HeroListBlocks.tsx:145-153` → `HeroSummaryCard.tsx:132-133`, dialogs `:139-152`; same in `HiredSwordSummaryCard.tsx:130-131` | the dialogs PATCH the unit | 403 for viewers |
| Kick | `CampaignSettings.tsx:211` (`canKickPlayers={isOwner}`), `MembersCard.tsx:210-218`, `:295-303` → `use-campaign-settings.ts:263` `deleteWarband(...)` | warband DELETE: the warband's own user only (`warbands/views/warbands.py:270`) | always 403 for the owner (BUG-12) |
| Start campaign | `useCampaignOverview.ts:226` (owner **or admin**) → `CampaignOverview.tsx:177` | PATCH campaign: owner only (`campaigns/views.py:472`) | 403 for admins (BUG-13) |
| Skill Edit pencil | `skills/routes/Skills.tsx:284-299`, shown for every custom entry | `manage_skills` (`skills/views.py:83`, `:104`) | 403 for plain players (BUG-15) |
| Spell Edit pencil | `spells/routes/Spells.tsx:274-290` | `manage_spells`, never seeded | 403 for every non-staff member |

**Hidden, though allowed:** Backstory edit is gated on `isWarbandOwner` (`BackstoryTab.tsx:45`) while warband PATCH allows staff and `manage_warbands` (`warbands/views/warbands.py:251`); dice colour likewise (`WarbandDiceSettingsCard.tsx:46-48`); the grant UI can't grant `manage_encampments` or `manage_bestiary` (`campaign-settings.ts:3-34`).

**Correctly gated** (checked so they stay that way): level-up controls (`WarbandHeroesSection.tsx:332`, `WarbandHenchmenSection.tsx:598`, `WarbandHiredSwordsSection.tsx:633`), the item kebab (`HeroListBlocks.tsx:223`), Items Edit (`Items.tsx:816`), and the owner-only settings cards (`CampaignSettings.tsx:215-237`).

## 3. Target backend

### 3.1 One source of truth for codes and roles

```python
# apps/campaigns/access/codes.py
class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    PLAYER = "player"

STAFF_ROLES = frozenset({Role.OWNER, Role.ADMIN})

class Perm(StrEnum):
    ADD_CUSTOM = "add_custom"
    MANAGE_ITEMS = "manage_items"
    MANAGE_SKILLS = "manage_skills"
    MANAGE_SPELLS = "manage_spells"
    MANAGE_SPECIALS = "manage_specials"   # renamed from manage_features (no rows exist; Q1)
    MANAGE_RULES = "manage_rules"
    MANAGE_WARBANDS = "manage_warbands"
    MANAGE_ENCAMPMENTS = "manage_encampments"
    MANAGE_LOCATIONS = "manage_locations"
    MANAGE_BESTIARY = "manage_bestiary"

@dataclass(frozen=True)
class PermInfo:
    label: str
    description: str   # served by GET /permissions/ for the grant UI; no DB column needed

PERM_INFO: Mapping[Perm, PermInfo] = {
    Perm.ADD_CUSTOM: PermInfo("Add custom", "Add new custom items, skills, spells and specials."),
    Perm.MANAGE_ENCAMPMENTS: PermInfo("Manage encampments", "Create and edit campaign encampments."),
    # ... one entry per code; a test asserts every Perm has one
}
DEFAULT_PLAYER_PERMS = frozenset({Perm.ADD_CUSTOM})
```

A data migration upserts the roles and all ten codes and renames `manage_features`. Migrations must not import live code, so it carries a frozen copy:

```python
# campaigns/migrations/00NN_seed_roles_and_permissions.py
CODES = {"add_custom": "Add custom", ..., "manage_bestiary": "Manage bestiary"}

def seed(apps, schema_editor):
    Permission = apps.get_model("campaigns", "CampaignPermission")
    Permission.objects.filter(code="manage_features").update(code="manage_specials")
    for code, name in CODES.items():
        Permission.objects.update_or_create(code=code, defaults={"name": name})
    # roles likewise

operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
```

Then: `_ensure_roles` / `_ensure_permissions` leave the request path (8–11 queries after each deploy, CAMP-CQ-03); the seed command imports `Perm`/`Role`; the grant serializer rejects unknown codes with 400 instead of dropping them; `GET /permissions/` returns `{code, label, description}` from `PERM_INFO`.

### 3.2 A request-cached access context

```python
# apps/campaigns/access/context.py
@dataclass(frozen=True)
class CampaignAccess:
    user_id: int
    campaign_id: int
    membership_id: int
    role: Role
    codes: frozenset[Perm]
    settings: CampaignSettings          # feature flags, limits, thresholds: no extra query

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    def has(self, perm: Perm) -> bool:
        return self.is_staff or perm in self.codes

def load_campaign_access(request: Request, campaign_id: int) -> CampaignAccess | None:
    """Membership, role, settings and codes in one query, cached on the request."""
    cache: dict[int, CampaignAccess | None] = request.__dict__.setdefault("_campaign_access", {})
    if campaign_id not in cache:
        row = (
            CampaignMembership.objects.filter(campaign_id=campaign_id, user_id=request.user.id)
            .select_related("role", "campaign__settings")
            .annotate(codes=ArrayAgg("permissions__permission__code", distinct=True,
                                     filter=Q(permissions__isnull=False), default=Value([])))
            .first()
        )
        cache[campaign_id] = None if row is None else CampaignAccess(
            user_id=request.user.id, campaign_id=campaign_id, membership_id=row.id,
            role=Role(row.role.slug), codes=frozenset(Perm(c) for c in row.codes),
            settings=row.campaign.settings,
        )
    return cache[campaign_id]
```

Postgres is the only backend (including tests), so `ArrayAgg` is safe. The single-query claim is locked by an `assertNumQueries(1)` test. `get_membership` and `has_campaign_permission` stay as thin wrappers until their last caller moves (deleted in pass 6).

### 3.3 Rules, declared once per resource

```python
# apps/campaigns/access/rules.py
Rule = Callable[[CampaignAccess, Any], bool]   # (access, scoped object or None) -> allowed

def member(access: CampaignAccess, obj: Any = None) -> bool: return True
def owner(access: CampaignAccess, obj: Any = None) -> bool: return access.role is Role.OWNER
def staff(access: CampaignAccess, obj: Any = None) -> bool: return access.is_staff
def has(perm: Perm) -> Rule: return lambda access, obj=None: access.has(perm)
def feature(flag: str) -> Rule: return lambda access, obj=None: bool(getattr(access.settings, flag))
def any_of(*rules: Rule) -> Rule: return lambda access, obj=None: any(r(access, obj) for r in rules)
def all_of(*rules: Rule) -> Rule: return lambda access, obj=None: all(r(access, obj) for r in rules)

# apps/warbands/access.py
def warband_owner(access: CampaignAccess, warband: Warband) -> bool:
    return warband.user_id == access.user_id

can_edit_warband = any_of(warband_owner, has(Perm.MANAGE_WARBANDS))

WARBAND_RULES: Mapping[str, Rule] = {
    "view": member,
    "edit": can_edit_warband,
    "level_up": can_edit_warband,
    "trade": can_edit_warband,          # trading action, trade sessions
    "manage_items": can_edit_warband,   # stash, transfers, sales, resources
    "edit_backstory": can_edit_warband, # brief decision 13
    "delete": warband_owner,            # Q3 may widen this
    "add_custom": has(Perm.ADD_CUSTOM),
}

CAMPAIGN_RULES: Mapping[str, Rule] = {
    "view": member,
    "edit_settings": owner,
    "start": owner,                      # PATCH with only in_progress; Q3
    "delete": owner,
    "view_members": staff,
    "grant_permissions": staff,
    "change_roles": owner,
    "remove_members": owner,
    "manage_active_battles": owner,
    **{p.value: has(p) for p in Perm if p not in (Perm.MANAGE_LOCATIONS, Perm.MANAGE_ENCAMPMENTS)},
    "manage_locations": all_of(feature("enable_locations"), has(Perm.MANAGE_LOCATIONS)),
    "manage_encampments": all_of(feature("enable_encampments"), has(Perm.MANAGE_ENCAMPMENTS)),
}
```

### 3.4 Scoped views: load once, check declaratively, deny by default

```python
# apps/campaigns/access/views.py
class CampaignScopedView(APIView):
    permission_classes = [IsAuthenticated]
    rule_table: Mapping[str, Rule] = CAMPAIGN_RULES
    rules: Mapping[str, str] = {"GET": "view"}   # HTTP method -> rule name
    feature_flag: str | None = None              # off -> 404, as today

    access: CampaignAccess
    scope_object: Any = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)  # authentication, IsAuthenticated (401), throttles
        self.load_scope(**kwargs)                  # 404 for missing objects and non-members
        if self.feature_flag and not getattr(self.access.settings, self.feature_flag):
            raise NotFound("Not found")
        name = self.rules.get(request.method)
        if name is None and request.method in SAFE_METHODS:
            name = "view"
        if name is None or not self.rule_table[name](self.access, self.scope_object):
            raise PermissionDenied("Forbidden")    # an undeclared unsafe method is denied

    def load_scope(self, *, campaign_id: int, **kwargs):
        access = load_campaign_access(self.request, campaign_id)
        if access is None:
            raise NotFound("Not found")
        self.access = access

    def capabilities(self) -> dict[str, bool]:
        return {name: rule(self.access, self.scope_object)
                for name, rule in self.rule_table.items() if name != "view"}

# apps/warbands/views/base.py
class WarbandScopedView(CampaignScopedView):
    rule_table = WARBAND_RULES
    rules = {"GET": "view", "POST": "edit", "PATCH": "edit", "PUT": "edit", "DELETE": "edit"}
    warband_prefetch: tuple[str, ...] = ()

    def load_scope(self, *, warband_id: int, **kwargs):
        warband = (Warband.objects.select_related("campaign__settings")
                   .prefetch_related(*self.warband_prefetch).filter(id=warband_id).first())
        if warband is None:
            raise NotFound("Not found")
        super().load_scope(campaign_id=warband.campaign_id)
        self.warband = self.scope_object = warband
```

Declaring a view is then one line per method that differs from the default:

```python
class WarbandDetailView(WarbandScopedView):
    rules = {"GET": "view", "PATCH": "edit", "DELETE": "delete"}

class UnitLevelUpView(WarbandScopedView):              # design 0.28
    rules = {"POST": "level_up"}

class CampaignLocationsView(CampaignScopedView):
    feature_flag = "enable_locations"
    rules = {"GET": "view", "POST": "manage_locations"}
```

Every warband-scoped request costs 2 queries before work (warband, access) for every actor, down from 2–4. The explicit `"Not found"` / `"Forbidden"` messages keep today's response bodies byte-identical. Object rules that need a second object (bulletin author, battle creator, trade participant) stay in the view as `self.check_rule("delete", entry)` against the same table, or in subclasses `BattleScopedView` (pass 3) and `get_trade_for_participant` (pass 2).

### 3.5 Capability flags in payloads

The same tables fill a `capabilities` object, computed from the loaded context at **0 extra queries**:

```json
GET /api/campaigns/1/
{ "id": 1, "role": "admin", "permissions": ["add_custom", "manage_items", "..."],
  "capabilities": { "edit_settings": false, "start": false, "view_members": true,
                    "grant_permissions": true, "manage_locations": true, "manage_spells": true, "...": "..." } }

GET /api/warbands/2/   (and the sheet endpoint, PERF-24)
{ "id": 2, "user_id": 1, "...": "...",
  "capabilities": { "edit": true, "level_up": true, "trade": true, "manage_items": true,
                    "edit_backstory": true, "delete": false, "add_custom": true } }
```

- `permissions: string[]` stays (grant UI, old clients). `capabilities` is what controls read.
- Keys are verbs without a `can_` prefix because the object name carries it; this supersedes the `can_*` keys sketched in the pass 1 brief. ENGINEERING_RULES' `can_edit` example maps to `capabilities.edit`.
- Capabilities express **permission**, not state. "Level Up!" still needs `level_up > 0`, the Trade badge still needs `trading_action`, Start still needs `!in_progress`. The UI combines both.
- Unit payloads carry no per-unit flags: rights are per warband. Per-row flags appear only where rights differ per row: catalogue entries if Q2 lands (`can_edit` from `created_by`), trade requests (pass 2), battles (pass 3).

## 4. Target frontend

```ts
// src/features/campaigns/capabilities.ts: the only module that knows roles and codes
export const CAMPAIGN_CAPABILITIES = [
  "edit_settings", "start", "delete", "view_members", "grant_permissions", "change_roles",
  "remove_members", "manage_active_battles", "add_custom", "manage_items", "manage_skills",
  "manage_spells", "manage_specials", "manage_rules", "manage_warbands", "manage_bestiary",
  "manage_locations", "manage_encampments",
] as const;
export const WARBAND_CAPABILITIES = [
  "edit", "level_up", "trade", "manage_items", "edit_backstory", "delete", "add_custom",
] as const;

export type CampaignCapability = (typeof CAMPAIGN_CAPABILITIES)[number];
export type WarbandCapability = (typeof WARBAND_CAPABILITIES)[number];
export type Capabilities<K extends string> = Readonly<Record<K, boolean>>;
export type CampaignCapabilities = Capabilities<CampaignCapability>;
export type WarbandCapabilities = Capabilities<WarbandCapability>;

/** Missing payloads and unknown keys read as false: the UI fails closed. */
export function readCapabilities<K extends string>(keys: readonly K[], raw: unknown): Capabilities<K> {
  const source = (raw ?? {}) as Partial<Record<string, unknown>>;
  return Object.fromEntries(keys.map((key) => [key, source[key] === true])) as Capabilities<K>;
}

export function useCampaignCapabilities(campaignId: number): CampaignCapabilities {
  const { data } = useCampaignQuery(campaignId);            // 0.21: one campaign query per campaign
  return useMemo(() => readCapabilities(CAMPAIGN_CAPABILITIES, data?.capabilities), [data?.capabilities]);
}

export function useWarbandCapabilities(warbandId: number): WarbandCapabilities {
  const { data } = useWarbandSheet(warbandId);              // design 0.28 / PERF-24
  return useMemo(() => readCapabilities(WARBAND_CAPABILITIES, data?.warband.capabilities),
    [data?.warband.capabilities]);
}
```

**The rule:** a control that triggers a server action renders only when its capability is true. Without it the component renders its read-only form (a static badge, an XP bar without +/-, a list entry that isn't a button), not a disabled button. Disabled-with-a-reason is for *state* ("Maximum of 6 heroes"), never for permission.

```tsx
<ExperienceBar xp={unit.xp} readOnly={!capabilities.edit} onSave={...} />

{unit.trading_action && capabilities.trade
  ? <TradeBadgeButton unit={unit} />                        // mutation with an error toast (0.26)
  : <TradeBadgeStatic available={unit.trading_action} />}

{capabilities.start && !campaign.in_progress ? <StartCampaignButton /> : null}
```

Components take `capabilities` (or read the hook) instead of a drilled `canEdit`. A lint rule keeps it that way:

```js
// frontend/eslint.config.js
{
  files: ["src/features/**/*.{ts,tsx}"],
  ignores: ["src/features/campaigns/capabilities.ts"],
  rules: {
    "no-restricted-syntax": ["warn",   // "error" once pass 4 has moved the last campaign pages
      { selector: "MemberExpression[object.name=/^campaign$/][property.name='role']",
        message: "Gate on capabilities (design 0.29), not on the viewer's role." },
      { selector: "CallExpression[callee.property.name='includes'][arguments.0.value=/^(add_custom|manage_)/]",
        message: "Gate on capabilities (design 0.29), not on permission codes." }],
  },
}
```

Displaying *other* members' roles (`MembersCard`) is data, not gating, and is unaffected. `useCampaignMemberPermissions` and the nine `/permissions/me/` fetches are deleted.

## 5. Migration, pass by pass

| When | Backend | Frontend | Closes |
| --- | --- | --- | --- |
| Phase 0 (0.21) | nothing new (`permissions` already in the detail payload) | campaign query exposes `permissions`; the nine `/permissions/me/` fetches go | PERF-15 |
| Pass 1 | `apps/campaigns/access/` (codes, context, rules, `CampaignScopedView`); the seed migration (Q4); `WarbandScopedView` on all 43 handlers; warband `capabilities`; delete `views/helpers.py` | `capabilities.ts`; Trade badge, XP bar, pending entries, level-up, Backstory, dice colour from `useWarbandCapabilities`; delete the `canEdit` derivation in `Warband.tsx:296-302`; lint rule added as `warn` | BUG-31, IMP-28, ROST-CQ-02; backend half of BUG-15 if Q4 |
| Pass 2 | `get_trade_for_participant` on the access context; trade-request `capabilities` (`accept`, `decline`, `cancel`, `edit_offer`) | trade dialogs from flags | ECON-CQ-03, IMP-40 |
| Pass 3 | `BattleScopedView` (participant and creator rules, allowed statuses, row lock); battle `capabilities` | start / finish / cancel / postbattle controls from flags | BATL-CQ-05, IMP-53 |
| Pass 4 | `CampaignScopedView` on the 24 campaign-scoped view classes; campaign `capabilities`; `GET /permissions/` with descriptions; grant API rejects unknown codes; `_ensure_*` and the seed duplicates deleted; Kick and Start per Q3 | `MembersCard` built from `GET /permissions/`; overview and settings gates from flags; the lint rule switches to `error` | BUG-12, BUG-13, BUG-15, CAMP-CQ-01/03, IMP-63/64 |
| Pass 5 | `CampaignCatalogueListView` / `DetailView` with rules; per-entry `can_edit` if Q2; `POST /restrictions/` requires membership | Skills / Spells / Items / Bestiary Edit from flags | CAT-BUG-04, CAT-CQ-01, IMP-79, SEC-06 (part) |
| Pass 6 | realtime channel auth (`realtime/channel_auth.py:46`) on the loader; delete the `get_membership` / `has_campaign_permission` wrappers; retire `/permissions/me/` once no old clients call it | — | — |

Each step is a refactor PR (status codes and bodies unchanged, proven by the matrix tests below) except where a row says it closes a bug; those land in the pass's fix PR with a failing-first test.

## 6. Tests

**API: endpoint × role matrix.** One shared harness and one data table per app:

```python
# apps/core/testing/access_matrix.py
ACTORS = ("anonymous", "non_member", "player", "player+manage_warbands", "admin", "owner", "warband_owner")

class AccessMatrixMixin:
    def assert_matrix(self, method: str, url: str, expected: Mapping[str, int], data=None): ...

# apps/warbands/tests/test_access_matrix.py
MATRIX = [
    ("GET",    "/api/warbands/{w}/heroes/",        {"anonymous": 401, "non_member": 404, "player": 200}),
    ("PATCH",  "/api/warbands/{w}/heroes/{h}/",    {"non_member": 404, "player": 403,
                                                    "player+manage_warbands": 200, "admin": 200,
                                                    "owner": 200, "warband_owner": 200}),
    ("DELETE", "/api/warbands/{w}/",               {"player": 403, "admin": 403, "warband_owner": 204}),
    # ... every warband route (ROST-TEST-11), then campaign, catalogue, trade, battle routes in their passes
]
```

The reference campaign builder (`apps/core/testing.py:78`) gains the admin, granted-player and non-member actors.

**Capability truth.** For each actor, the GET payload's `capabilities[name]` is true exactly when that capability's representative request succeeds (for example `trade` ↔ `PATCH hero {trading_action: false}`, `start` ↔ `PATCH campaign {in_progress: true}`). This is the test that stops UI/API drift from coming back.

**Registry and structure.**
- After migrations, the `campaign_permission` codes equal `{p.value for p in Perm}`; every `Perm` has a `PERM_INFO` entry.
- Every concrete view class in `apps.warbands.views` (later campaigns, catalogue) derives from a scoped base, with an explicit allowlist. A new handler cannot skip the check.
- `load_campaign_access` runs 1 query; a warband-scoped request has a 2-query preamble for every actor (query budgets updated).

**UI.** Per component, rendered with all-false and all-true capabilities: no Trade button, no XP +/-, pending entries not clickable, no Kick, no Start campaign, no Skill/Spell pencil when false; present when true. Plus `readCapabilities` unit tests (missing payload → all false) and the lint rule in CI.

## 7. Risks

- **Status or body drift** while swapping 84 call sites to base classes (404 vs 403 order, `"Not found"` vs DRF's `"Not found."`). Mitigation: the matrix asserts status and body, written before each pass's refactor.
- **Two patterns side by side** for several passes. The wrappers keep old code correct, and the structure test makes new code use the new base.
- **Rules that also depend on state** (level-up count, battle status, trade expiry). Capabilities stay permission-only and the state checks stay in services, so the flag never claims an action will succeed regardless of state.
- **Rename on production data.** `manage_features` has no rows locally (8 codes in the DB); the migration renames with `update()`, which is safe if production has any.
- **Role changes while a page is open.** Capabilities refresh with the campaign query. A realtime "membership changed" event that patches the cache belongs with 0.25 and pass 4.

## 8. Open questions for William

1. **Spells and specials codes.** Seed `manage_spells` and rename `manage_features` → `manage_specials` (default), or fold both into `manage_skills`?
2. **Editing your own catalogue entries (CAT-BUG-04).** Should `add_custom` also let a player edit and delete entries they created? This needs a `created_by` column on the six catalogue tables (none have one today). Default: yes, in pass 5.
3. **Start and Kick (CAMP-BUG-01/02, CAMP-UX-02).** May admins start the campaign (default: yes, `start = staff`)? And what does Kick do: remove the member, retire their warband (soft, pairs with roster decision 4), or go away? Today warband DELETE is its owner's alone.
4. **Seed the codes in pass 1** instead of pass 4 (BUGS.md plan phase)? It is one migration, and pass 1's matrix tests then run against the real code list. Default: yes; the members UI change stays in pass 4.
