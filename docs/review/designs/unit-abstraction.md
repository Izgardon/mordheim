# Design 0.28 · Shared unit abstraction (heroes, henchmen groups, hired swords)

> Status: **draft for sign-off** (PLAN 0.28, IMP-24). Implemented in pass 1 PR B (IMP-26 backend, IMP-27 frontend); economy (pass 2) and battles (pass 3) build on it. Companion design: [permissions-and-capabilities.md](permissions-and-capabilities.md) (0.29), which supplies `WarbandScopedView` and the `capabilities` payload used below.
> Verified against `chore/foundations-0d` (6198d6a) on 2026-10-17. Line numbers are from that commit.

## 1. Goal and non-goals

**Goal.** Heroes, henchmen groups and hired swords are written once. Their real differences are declared as data in one registry (backend `UnitKindSpec`, frontend `UnitKindConfig`), plus a few named hooks or slots where a difference is behaviour (leader sync, the henchmen member list, Lad's Got Talent). A fix lands once and applies to all three, which stops the drift bugs (BUG-29, -33, -62, -65, PERF-28).

**Non-goals.**
- No change to the three tables, their ids or the link tables. Battle drafts and kill events store `(unit_type, unit_id)` pairs, so ids must survive.
- No change to the API: same URLs, URL names, payload keys and status codes. Old clients keep working.
- No product changes. Pass 1 decisions 1–13 land in PR A/PR C; this design only makes sure each one is a single change (see §7).
- No merging of Skill, Spell and Special (CAT-CQ-01 long run).

## 2. What differs today (verified)

| Aspect | Hero | Henchmen group | Hired sword |
| --- | --- | --- | --- |
| Model | `models/heroes.py:7-73` | `models/henchmen.py:7-56` (+ `Henchman` 59-69) | `models/hired_swords.py:7-77` |
| Shared scalar fields | name, unit_type (`db_column="type"`), price, xp Decimal(6,1), level_up, level_up_history, deeds, armour_save, large, half_rate, dead, created/updated (all three) | same | same |
| Own fields | kills, is_leader, caster, available_skills, trading_action | max_size, no_level_ups | kills, caster, available_skills, no_level_ups, rating, blood_pacted, hire_cost_expression, upkeep_price, upkeep_cost_expression |
| Links (through tables) | items (with cost), skills, specials, spells | items, skills, specials (**no spells**) | items, skills, specials, spells |
| FK names on links | `hero`, related `hero_items`… | `henchmen_group`, related `henchmen_group_items`… | `hired_sword`, related `hired_sword_items`… |
| XP → level-ups on PATCH | `count_new_level_ups` (Decimal), `hero_level_thresholds` (`serializers/heroes.py:477-487`) | `count_new_henchmen_level_ups` (int), `henchmen_level_thresholds`, skipped if `no_level_ups` (`serializers/henchmen.py:313-325`) | henchmen counter, `hired_sword_level_thresholds` (defaults to the henchmen table, `campaigns/models.py:112`), skipped if `no_level_ups` (`serializers/hired_swords.py:356-368`) |
| Level-ups on create | client may seed `level_up` (Lad's Got Talent sends 2; `serializers/heroes.py:357-358`) | always 0 (`serializers/henchmen.py:217`) | always 0 (`serializers/hired_swords.py:239`) |
| Level-up advances | M WS BS S T W I A Ld + Skill/Spell/Special placeholders; any or no `advance.id` accepted (`views/heroes.py:325-366`) | WS BS S I A Ld only; unknown id → 400; `no_level_ups` → 400 (`views/henchmen.py:296-347`) | as hero, plus `no_level_ups` → 400 (`views/hired_swords.py:314-364`) |
| Postbattle XP | default table, full XP (`battles/views/shared.py:1748-1754`) | default table, `no_level_ups` zeroes (`:1794`, `:1817-1825`) | default table, `no_level_ups` zeroes (`:1769-1779`) |
| Half-rate | field exists; ignored server-side (frontend XP bar steps 0.5) | same; henchmen XP bars omit the prop (BUG-33) | same as hero |
| Trait specials | Large + Wizard/Priest synced with `large`/`caster` | Large only | Large + Wizard/Priest |
| Leader | `ensure_single_living_leader` after create (`serializers/heroes.py:389`), update (`:540`), delete (`views/heroes.py:265`), postbattle (`shared.py:1815`) | — | — |
| Cap on create | `max_heroes` (default 6), counts **all** heroes incl. dead; client `ignore_max_heroes` skips it (`views/heroes.py:66-77`) | none (`max_size`, `max_units` unenforced) | `max_hired_swords` (default 3), living and not blood-pacted; blood-pacted exempt (`views/hired_swords.py:68-80`) |
| Members | — | `Henchman` rows; list/detail prefetch living only (`views/henchmen.py:42-43`); PATCH `henchmen` list adds, updates, and hard-deletes any id not sent, dead included (`serializers/henchmen.py:360-386`, BUG-04) | — |
| Recruit ledger | one `Recruited` trade "{name} the {type}" + log `new_hero`, atomic (`views/heroes.py:81-98`) | one `Recruited` trade **per member** "{member} into {group}" at `group.price`, a group header when >1, logs per member; not atomic (`views/henchmen.py:83-128`). Members added by PATCH: per-member trade at `entry.cost` or `price + Σ group item costs + 2×xp` (`:25-39`, `:225-263`) | one `Hired` trade + log `new_hired_sword`; not atomic (`views/hired_swords.py:82-100`) |
| Upkeep | — | — | `upkeep_price` charged at postbattle (battles) |
| Trading action | `trading_action`, spent by trades/rarity rolls, reset by battle finalisation (`shared.py:725-743`) | — | — |
| Loadout logs on PATCH | added skills/specials/spells logged (`views/heroes.py:180-234`) | none | same as hero, payload key `"hero"` (`views/hired_swords.py:182-234`) |
| Dismiss | DELETE: log `remove_hero`, hard delete (items cascade), no refund, atomic + leader sync | log, hard delete, not atomic | log, hard delete, not atomic |
| Death | `dead=True` at postbattle; hidden from every roster endpoint | per-member `dead`; group `dead` when all members dead (`shared.py:1826-1829`) | as hero |
| Detail lookups | GET/PATCH filter `dead=False`; DELETE and level-up don't | same | same |
| Summary payload | no `dead`, `kills`, `deeds`, `race` | has `dead`, members; no `deeds`, `race` | has `dead`; no `kills`, `deeds`, `race` |
| Response after write | `refresh_from_db()` then unprefetched serialize (PERF-23) | prefetch caches popped | caches popped; level-up re-fetches |

Two findings that simplify the design:
- **The two XP counters agree on every valid input.** For integer thresholds `t` and `xp ≥ 0`, `xp ≥ t ⇔ floor(xp) ≥ t`, so `count_new_level_ups` (`utils/hero_level.py:64-75`) and `count_new_henchmen_level_ups` (`utils/henchmen_level.py:48-58`) return the same count. They differ only in parsing (`int("4.5")` raises, ROST-TEST-26) and in which default table they fall back to. One counter with a per-kind fallback is enough.
- **`UNIT_TYPE_CONFIG` already exists** (`views/warbands.py:56-91`) and drives item transfer and sale generically. The registry generalises it.

## 3. Duplication inventory

Measured 2026-10-17 with `difflib` after normalising unit names; "redundant" = lines of a sibling that match an earlier sibling. Totals: **13,220 lines in these files, ~5,240 redundant** (the review's 5,200 of 12,400 holds after formatting).

| Area | Files (lines: hero / henchmen / hired) | Similarity H–Hm / H–HS / Hm–HS | Redundant |
| --- | --- | --- | --- |
| Backend views | `views/heroes.py` 412, `henchmen.py` 374, `hired_swords.py` 378 | 0.55 / **0.85** / 0.58 | ~470 |
| Backend serializers | `serializers/heroes.py` 549, `henchmen.py` 398, `hired_swords.py` 430 | 0.59 / 0.70 / 0.79 | ~550 |
| Kill history | `views/kill_history.py` 71-98 / 127-158 / 99-126 (one file, 3 views of 28–32 lines) | same structure; henchmen sum member kills | — |
| Sections | `WarbandHeroesSection` 434, `WarbandHenchmenSection` 682, `WarbandHiredSwordsSection` 719 | 0.44 / 0.45 / 0.70 | ~700 |
| Summary cards | 185 / 183 / 184 | 0.73 / **0.92** / 0.76 | ~290 |
| Expanded cards | 603 / 451 / 528 | 0.70 / 0.81 / 0.74 | ~790 |
| List blocks (wrappers over shared `UnitListBlocks`) | 277 / 261 / 287 | 0.73 / **0.95** / 0.70 | ~420 |
| Form cards | 221 / **969** / 222 | 0.27 / **0.90** / 0.25 | ~340 (+ henchmen re-implements `UnitBasicInfo`/`UnitLoadout`) |
| Add forms | 250 / 207 / 474 | 0.70 / 0.60 / 0.47 | ~365 |
| Level-up dialogs | 168 / 202 / 168 | 0.69 / **0.98** / 0.67 | ~285 |
| Level-up controls | 51 / 54 / 51 | 0.85 / 0.93 / 0.90 | ~80 |
| Level-up hooks | 202 / 343 / 203 | 0.44 / 0.84 / 0.40 | ~260 |
| Save hooks | `useWarbandSave` 245 / `useWarbandHenchmenSave` 450 / `useWarbandHiredSwordsSave` 239 | 0.45 / 0.52 / 0.40 | ~275 |
| Forms + creation hooks | 89+123 / 75+127 / 77+148 | 0.63–0.76 | ~280 |
| API modules | `api/warbands-heroes.ts` 75 / `-henchmen.ts` 77 / `-hiredswords.ts` 84 | 0.69 / 0.82 / 0.70 | ~100 |

Representative block pairs:

| Block | Locations | Lines each |
| --- | --- | --- |
| Create + ledger | `views/heroes.py:56-99` · `henchmen.py:71-132` · `hired_swords.py:56-102` | 44 / 62 / 47 |
| PATCH + added-entry logging | `views/heroes.py:148-236` · `hired_swords.py:151-236` (henchmen `183-265` swaps logging for member sync) | 89 / 86 / 83 |
| Level-up body | `views/heroes.py:269-380` · `hired_swords.py:267-378` · `henchmen.py:293-374` | 112 / 112 / 82 |
| Update serializer (XP, loadout replace, trait sync, cache pops) | `serializers/heroes.py:397-545` · `henchmen.py:249-394` · `hired_swords.py:277-426` | 149 / 146 / 150 |
| Create serializer | `serializers/heroes.py:290-394` · `henchmen.py:150-246` · `hired_swords.py:163-274` | 105 / 97 / 112 |
| Summary + detail serializers | `serializers/heroes.py:152-265` · `henchmen.py:38-147` · `hired_swords.py:36-160` | 114 / 110 / 125 |
| Expand-collapse timer | `WarbandHeroesSection.tsx:177-191` · `WarbandHenchmenSection.tsx:379-393` · `WarbandHiredSwordsSection.tsx:464-478` | 15 each |
| Catalogue loading `statusNode` | `WarbandHeroesSection.tsx:193-207` · `WarbandHenchmenSection.tsx:463-476` · `WarbandHiredSwordsSection.tsx:488-503` | 14–16 |
| `merge*` after save | `useWarbandSave.ts:64-77` · `useWarbandHenchmenSave.ts:232-245` · `useWarbandHiredSwordsSave.ts:62-75` · `useWarbandUpdateListener.ts:24-39` | 14 each |
| Form mappers / validators | `utils/warband-utils.ts:182-212`, `213-247`, `327-362`; `302-326`, `370-395` | ~30 each |
| XP savers (send the whole unit) | `utils/warband-utils.ts:560-573`, `575-592`, `594-606` | ~14 each |

## 4. Backend target

### 4.1 Data model: keep three tables

| Option | Verdict |
| --- | --- |
| **Abstract `RosterUnit(StatBlock)` + registry-driven link handling** | **Chosen.** No migration (`makemigrations --check` stays empty: fields move to an abstract parent with identical definitions; `warband`/`race` FKs stay on the concrete models because their `related_name`s differ). All sharing happens in services keyed by the registry. |
| Multi-table inheritance (`Unit` + 3 children) | Rejected: a join on every read (query count is latency), a data migration of every unit, and new parent ids that break `(unit_type, unit_id)` references in battle drafts and `BattleEvent.payload_json`. |
| Single `unit` table with `kind` | Rejected for now: nullable kind-specific columns, a 12 → 4 link-table merge, and the same id remap. Revisit only if a fourth kind appears. |
| Generic relations for links (`content_type`, `object_id`) | Rejected: no FK integrity or cascade, no `select_related`, clumsier prefetch. |

`RosterUnit` holds the 13 shared scalars from §2. Kind-only fields stay on each model.

### 4.2 Package layout (`backend/apps/warbands/units/`)

This supersedes the brief's `unit_kinds.py` + `services/` split; the content is the same, kept in one package. Every file stays under 400 lines.

```
units/
  kinds.py        # LinkSpec, CapSpec, RecruitSpec, UnitKindSpec, HERO, HENCHMEN_GROUP, HIRED_SWORD, KINDS
  hooks.py        # differences that are behaviour: leader sync, henchmen members, henchmen recruit ledger
  serializers.py  # UnitSummarySerializer / UnitDetailSerializer / UnitWriteSerializer bases
  views.py        # UnitListCreateView, UnitDetailListView, UnitDetailView, UnitLevelUpView, UnitKillHistoryView
  urls.py         # unit_urlpatterns(kind): today's paths and names, generated
  services/
    create.py  update.py  xp.py  level_up.py  loadout.py  dismiss.py  promote.py
```

`views/warbands.py` imports `KINDS` instead of `UNIT_TYPE_CONFIG`; `battles/views/shared.py` postbattle calls `services/xp.py` (BUG-03 fix in PR A puts that function in place first).

### 4.3 The registry

```python
# units/kinds.py
UnitKindKey = Literal["hero", "henchmen_group", "hired_sword"]  # same keys as item-transfer source_type

@dataclass(frozen=True)
class LinkSpec:
    relation: str               # reverse accessor on the unit, e.g. "hero_skills"
    model: type[models.Model]   # through model, e.g. HeroSkill
    target: str                 # FK on the through model, e.g. "skill"
    log_entry: str | None = None  # loadout log entry when an entry is added; None = don't log

@dataclass(frozen=True)
class RecruitSpec:
    trade_action: str           # "Recruited" | "Hired"
    log_new: str                # "new_hero"
    log_remove: str             # "remove_hero"
    client_may_seed_level_up: bool = False

@dataclass(frozen=True)
class CapSpec:
    setting: str                # CampaignSettings attribute
    default: int
    counted: Callable[[QuerySet], QuerySet]
    exempt: Callable[[Mapping[str, Any]], bool] = lambda data: False

@dataclass(frozen=True)
class UnitKindSpec:
    key: UnitKindKey
    label: str
    url_segment: str            # "heroes" -> paths and URL names stay as today
    url_kwarg: str              # "hero_id" kept so reverse(...) callers don't change
    model: type[RosterUnit]
    parent_field: str           # FK name on the through models
    items: LinkSpec
    skills: LinkSpec
    specials: LinkSpec
    spells: LinkSpec | None     # None: kind has no spells
    thresholds_setting: str
    default_thresholds: tuple[int, ...]
    stat_advances: tuple[str, ...]
    placeholder_advances: frozenset[str]
    advance_log_type: str
    has_no_level_ups: bool
    caster_traits: bool
    can_lead: bool
    has_members: bool
    has_trade_action: bool
    recruit: RecruitSpec
    cap: CapSpec | None
    hooks: "UnitHooks" = field(default_factory=lambda: UnitHooks())

    def links(self) -> tuple[LinkSpec, ...]:
        return tuple(link for link in (self.items, self.skills, self.specials, self.spells) if link)

    def visible(self, qs: QuerySet) -> QuerySet:
        return qs.filter(dead=False)  # the one place decision 4 ("dismissed") changes
```

How each kind declares its differences:

```python
ALL_STATS = ("M", "WS", "BS", "S", "T", "W", "I", "A", "Ld")
PLACEHOLDERS = frozenset({"Skill", "Spell", "Special"})

HERO = UnitKindSpec(
    key="hero", label="Hero", url_segment="heroes", url_kwarg="hero_id",
    model=Hero, parent_field="hero",
    items=LinkSpec("hero_items", HeroItem, "item"),
    skills=LinkSpec("hero_skills", HeroSkill, "skill", log_entry="hero_skill"),
    specials=LinkSpec("hero_specials", HeroSpecial, "special", log_entry="hero_special"),
    spells=LinkSpec("hero_spells", HeroSpell, "spell", log_entry="hero_spell"),
    thresholds_setting="hero_level_thresholds", default_thresholds=HERO_LEVEL_THRESHOLDS,
    stat_advances=ALL_STATS, placeholder_advances=PLACEHOLDERS, advance_log_type="hero",
    has_no_level_ups=False, caster_traits=True, can_lead=True, has_members=False, has_trade_action=True,
    recruit=RecruitSpec("Recruited", "new_hero", "remove_hero", client_may_seed_level_up=True),
    cap=CapSpec("max_heroes", 6, counted=lambda qs: qs),  # PR A: qs.filter(dead=False) (BUG-29)
    hooks=UnitHooks(after_write=sync_leader, after_delete=sync_leader),
)

HENCHMEN_GROUP = UnitKindSpec(
    key="henchmen_group", label="Henchmen group", url_segment="henchmen-groups", url_kwarg="group_id",
    model=HenchmenGroup, parent_field="henchmen_group",
    items=LinkSpec("henchmen_group_items", HenchmenGroupItem, "item"),
    skills=LinkSpec("henchmen_group_skills", HenchmenGroupSkill, "skill"),      # no loadout logs today
    specials=LinkSpec("henchmen_group_specials", HenchmenGroupSpecial, "special"),
    spells=None,
    thresholds_setting="henchmen_level_thresholds", default_thresholds=HENCHMEN_LEVEL_THRESHOLDS,
    stat_advances=("WS", "BS", "S", "I", "A", "Ld"), placeholder_advances=frozenset(),
    advance_log_type="henchmen",
    has_no_level_ups=True, caster_traits=False, can_lead=False, has_members=True, has_trade_action=False,
    recruit=RecruitSpec("Recruited", "new_henchmen_group", "remove_henchmen_group"),
    cap=None,  # PR A: max_size and max_units (BUG-67)
    hooks=UnitHooks(after_write=sync_members, recruit_ledger=henchmen_recruit_ledger),
)

HIRED_SWORD = UnitKindSpec(
    key="hired_sword", label="Hired sword", url_segment="hired-swords", url_kwarg="hired_sword_id",
    model=HiredSword, parent_field="hired_sword",
    items=LinkSpec("hired_sword_items", HiredSwordItem, "item"),
    skills=LinkSpec("hired_sword_skills", HiredSwordSkill, "skill", log_entry="hired_sword_skill"),
    specials=LinkSpec("hired_sword_specials", HiredSwordSpecial, "special", log_entry="hired_sword_special"),
    spells=LinkSpec("hired_sword_spells", HiredSwordSpell, "spell", log_entry="hired_sword_spell"),
    thresholds_setting="hired_sword_level_thresholds", default_thresholds=HENCHMEN_LEVEL_THRESHOLDS,  # decision 8
    stat_advances=ALL_STATS, placeholder_advances=PLACEHOLDERS, advance_log_type="hired_sword",
    has_no_level_ups=True, caster_traits=True, can_lead=False, has_members=False, has_trade_action=False,
    recruit=RecruitSpec("Hired", "new_hired_sword", "remove_hired_sword"),
    cap=CapSpec("max_hired_swords", 3,
                counted=lambda qs: qs.filter(dead=False, blood_pacted=False),
                exempt=lambda data: bool(data.get("blood_pacted"))),
)

KINDS: dict[UnitKindKey, UnitKindSpec] = {k.key: k for k in (HERO, HENCHMEN_GROUP, HIRED_SWORD)}
```

Serializers and prefetches are looked up per kind in `units/serializers.py` (`SERIALIZERS[kind.key]`, `prefetches.py` keyed the same way) to avoid an import cycle between models, kinds and serializers.

### 4.4 Shared services

| Service | Replaces | Notes |
| --- | --- | --- |
| `loadout.replace_loadout(kind, unit, lists)` + `sync_trait_specials(kind, unit, ...)` | the replace and trait blocks in 3 create + 3 update serializers | iterates `kind.links()`; validates catalogue ids are global or this campaign's (SEC-07, PR A) |
| `xp.level_ups_between(kind, prev, new, settings)` / `apply_xp_gain(kind, unit, delta, settings)` | 3 PATCH blocks + 3 postbattle blocks | one counter, `fallback=kind.default_thresholds`; half-rate and the correction rule per decisions 5–6 |
| `level_up.apply_advance(kind, unit_id, advance)` | 3 level-up views | validates against `stat_advances` and `placeholder_advances`; `filter(level_up__gt=0).update(level_up=F(...)-1)` (BUG-62) |
| `create.create_unit(kind, warband, data, settings)` | 3 POST bodies | atomic; cap via `kind.cap`; ledger via `kind.recruit` or `kind.hooks.recruit_ledger` |
| `update.update_unit(kind, unit, data, settings)` | 3 PATCH bodies + update serializers' `update()` | see sketch |
| `dismiss.dismiss_unit(kind, unit)` | 3 DELETE bodies | decisions 3–4 (stash items, soft status) are edits to this one function |
| `promote.promote_henchman(group, henchman_id, advance)` | the 4-request LGT chain | BUG-28 endpoint, henchmen-only |

A shared PATCH, end to end:

```python
# units/views.py
class UnitDetailView(WarbandScopedView):        # 0.29: loads warband + access once, enforces rules
    kind: UnitKindSpec                          # set via as_view(kind=...)

    def patch(self, request, warband_id: int, **kwargs) -> Response:
        unit = self.get_unit(kwargs[self.kind.url_kwarg], prefetch=detail_prefetch(self.kind))
        writer = SERIALIZERS[self.kind.key].write(unit, data=request.data, partial=True,
                                                  context={"warband": self.warband})
        writer.is_valid(raise_exception=True)
        unit = update_unit(self.kind, unit, writer.validated_data, settings=self.warband.campaign.settings)
        return Response(SERIALIZERS[self.kind.key].detail(unit).data)

# units/services/update.py
def update_unit(kind: UnitKindSpec, unit: RosterUnit, data: dict, *, settings) -> RosterUnit:
    change = UnitChange.split(kind, data)            # scalars | loadout lists | members | flags
    before = loadout_ids(kind, unit)                 # read from the prefetch: 0 queries
    with transaction.atomic():
        if "xp" in change.scalars and "level_up" not in change.scalars:
            change.scalars["level_up"] = unit.level_up + level_ups_between(
                kind, unit, unit.xp, change.scalars["xp"], settings)
        for name, value in change.scalars.items():
            setattr(unit, name, value)
        unit.save(update_fields=[*change.scalars, "updated_at"])
        replace_loadout(kind, unit, change.loadout)
        sync_trait_specials(kind, unit, change)
        if kind.hooks.after_write:
            kind.hooks.after_write(kind, unit, change)   # hero: leader if is_leader/dead changed; henchmen: members
        log_loadout_additions(kind, unit, before, change.loadout)  # only links with log_entry
    return reload_unit(kind, unit.pk)                # one prefetched fetch, replaces refresh_from_db (PERF-23)
```

### 4.5 Serializers, views, URLs

- `UnitSummarySerializer` / `UnitDetailSerializer` implement `items/skills/specials/spells` once by reading `kind.<link>.relation`; each kind subclasses with only `Meta.fields` (common + own fields). Payload keys stay exactly as today, including the inconsistencies in §2 (`dead` missing from the hero summary); unifying them is a PR C decision, not part of the refactor.
- `UnitWriteSerializer` declares `items`, `skill_ids`, `special_ids`, `spell_ids` (dropped when `kind.spells is None`); henchmen add `henchmen`. The hero-only `item_reason/item_action/item_price` fields are accepted and discarded today (`serializers/heroes.py:404-406`, `453-455`); keep them accepted until the frontend stops sending them, then remove.
- `UnitLevelUpView`, `UnitKillHistoryView` and `UnitDetailListView` follow the same pattern.

```python
# units/urls.py
def unit_urlpatterns(kind: UnitKindSpec) -> list[URLPattern]:
    seg, kw = kind.url_segment, kind.url_kwarg
    base = f"warbands/<int:warband_id>/{seg}/"
    return [
        path(base, UnitListCreateView.as_view(kind=kind), name=f"warbands-{seg}"),
        path(f"{base}detail/", UnitDetailListView.as_view(kind=kind), name=f"warbands-{seg}-detail-list"),
        path(f"{base}<int:{kw}>/", UnitDetailView.as_view(kind=kind), name=f"warbands-{seg}-detail"),
        path(f"{base}<int:{kw}>/kill-history/", UnitKillHistoryView.as_view(kind=kind),
             name=f"warbands-{seg}-kill-history"),
        path(f"{base}<int:{kw}>/level-up/", UnitLevelUpView.as_view(kind=kind), name=f"warbands-{seg}-level-up"),
    ]
```

These reproduce today's 15 paths and names in `warbands/urls.py` exactly. The `hero-specials/` and `hero-spells/` catalogue detail views (`views/heroes.py:383-412`) move to their catalogue apps in pass 5; they are not unit views.

## 5. Frontend target

### 5.1 Layout (`frontend/src/features/warbands/`)

```
units/unit-kinds.ts            # UnitKindConfig per kind (data + mappers)
units/unit-api.ts              # unitApi(kind): list/detail/create/update/updateXp/levelUp/remove/killHistory
types/units.ts                 # UnitKindKey, UnitSummary<K>, UnitDetail<K>, UnitForm<K>, UnitPayload<K> (IMP-37)
api/warband-queries.ts         # warbandKeys + useWarbandSheet (0.19 conventions), shared with economy
hooks/units/useUnitMutations.ts   # useUnitPatch, useUnitXp, useUnitCreate, useUnitRemove
hooks/units/useUnitLevelUp.ts     # mutation + useLevelUpDialogState (roll, chosen stat)
hooks/units/useUnitSectionEditor.ts  # forms, create, dismiss, save, cancel, pending purchases
components/units/              # UnitSection, UnitSummaryCard, UnitExpandedCard, UnitListBlocks,
                               # UnitLevelUpControl, UnitLevelUpDialog, UnitFormCard, RacePicker
components/units/kinds/hero/          # HeroTradeBadge, LeaderCrown, LeaderField, HeroAvailableSkills
components/units/kinds/henchmen/      # HenchmenMemberList, AddHenchmanDialog, LadsGotTalentPanel
components/units/kinds/hired-sword/   # UpkeepBlock, BloodPactBadge, HiredSwordPresetPicker, UpkeepFields
```

The existing shared pieces (`UnitListBlocks` shell, `WarbandSectionShell`, `UnitBasicInfo`, `UnitLoadout`, `UnitStatsGrid`, `ExperienceBar`) are kept and become the generic components' building blocks.

### 5.2 The config

```ts
// units/unit-kinds.ts
export type UnitKindKey = "hero" | "henchmen_group" | "hired_sword";

export type UnitKindConfig<K extends UnitKindKey> = {
  key: K;
  urlSegment: "heroes" | "henchmen-groups" | "hired-swords";
  labels: { singular: string; plural: string; add: string; edit: string };
  flags: {
    hasSpells: boolean;
    hasMembers: boolean;
    hasTradeAction: boolean;
    canLead: boolean;
    supportsNoLevelUps: boolean;
    hasUpkeep: boolean;
  };
  thresholdsKey: "hero_level_thresholds" | "henchmen_level_thresholds" | "hired_sword_level_thresholds";
  advanceOptions: readonly AdvanceId[];          // display only; the server validates
  mapToForm(unit: UnitDetail<K>): UnitForm<K>;
  validate(form: UnitForm<K>): UnitValidationError | null;
  buildPayload(form: UnitForm<K>, ctx: { isSessionCreated: boolean }): UnitPayload<K>;
  slots: UnitSlots<K>;
};

export type UnitSlots<K extends UnitKindKey> = {
  CardHeaderExtra?: ComponentType<{ unit: UnitDetail<K>; capabilities: WarbandCapabilities }>;
  ExpandedExtra?: ComponentType<{ unit: UnitDetail<K> }>;
  FormExtra?: ComponentType<UnitFormSlotProps<K>>;
  AddPresets?: ComponentType<UnitAddPresetProps<K>>;
  LevelUpExtra?: ComponentType<LevelUpSlotProps<K>>;
};

export const heroKind: UnitKindConfig<"hero"> = {
  key: "hero",
  urlSegment: "heroes",
  labels: { singular: "Hero", plural: "Heroes", add: "Add hero", edit: "Edit Heroes" },
  flags: { hasSpells: true, hasMembers: false, hasTradeAction: true, canLead: true,
           supportsNoLevelUps: false, hasUpkeep: false },
  thresholdsKey: "hero_level_thresholds",
  advanceOptions: [...STAT_ADVANCES, "Skill", "Spell", "Special"],
  mapToForm: mapHeroToForm,
  validate: validateHeroForm,
  buildPayload: buildHeroPayload,
  slots: { CardHeaderExtra: HeroTradeBadge, FormExtra: LeaderField },
};
// henchmenKind: slots { ExpandedExtra: HenchmenMemberList, FormExtra: HenchmenMemberList, LevelUpExtra: LadsGotTalentPanel }
// hiredSwordKind: slots { ExpandedExtra: UpkeepBlock, FormExtra: UpkeepFields, AddPresets: HiredSwordPresetPicker }
```

Level information stays a display helper fed by the server's thresholds (`getLevelInfo(xp, campaign[kind.thresholdsKey])`). The browser never decides level-ups.

### 5.3 Hooks on TanStack Query

```ts
// hooks/units/useUnitMutations.ts
export function useUnitXp<K extends UnitKindKey>(kind: UnitKindConfig<K>, warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, xp }: { unitId: number; xp: number }) =>
      unitApi(kind).updateXp(warbandId, unitId, xp),           // sends only {xp} (PERF-23, BUG-63)
    onSuccess: (unit) =>
      queryClient.setQueryData<WarbandSheet>(warbandKeys.sheet(warbandId), (sheet) =>
        sheet ? replaceUnit(sheet, kind.key, unit) : sheet),     // gold can't change: no summary refetch
  });
}

// hooks/units/useUnitLevelUp.ts
export function useUnitLevelUp<K extends UnitKindKey>(kind: UnitKindConfig<K>, warbandId: number) {
  const queryClient = useQueryClient();
  const dialog = useLevelUpDialogState(kind);                  // roll, chosen stat; pure, unit-tested
  const mutation = useMutation({
    mutationFn: (unitId: number) => unitApi(kind).levelUp(warbandId, unitId, dialog.payload()),
    onSuccess: (unit) => queryClient.setQueryData<WarbandSheet>(warbandKeys.sheet(warbandId),
      (sheet) => (sheet ? replaceUnit(sheet, kind.key, unit) : sheet)),
  });
  return { ...dialog, confirm: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error };
}
```

`useUnitSectionEditor(kind, warbandId)` replaces the nine per-kind form, creation and save hooks. Decision 1 is a mode of this one hook (`recruit: "on-save" | "immediate"`), so either answer is a single change. Mutations invalidate `warbandKeys.summary` only for create, dismiss and purchases, which removes the `warband:updated` event bus and the store mirror.

`<UnitSection kind={heroKind} warbandId={id} capabilities={caps} />` composes `WarbandSectionShell`, the cards and the editor. Controls render from `capabilities` (0.29), never from a locally computed `canEdit`.

## 6. Migration plan

Preconditions: 0.19 (QueryClient, key conventions) and pass 1 PR A (fixes that make the three kinds behave alike: atomic writes, BUG-04, -29, -62, -65, PERF-23, the `xp.py` service). PR B is then behaviour-neutral by construction, because there is no divergence left to preserve. Each step is one commit, green on its own.

| # | Step | Behaviour-neutral because | Size |
| --- | --- | --- | --- |
| 0 | **Characterisation tests** (below), parametrised over the three kinds | tests only | M, ~700 test lines |
| B1 | `RosterUnit` abstract base | `makemigrations --check` empty; full suite | S, −60 |
| B2 | `units/kinds.py`; `views/warbands.py` transfer/sale read `KINDS` | transfer/sale tests + key-set tests | S, −20 |
| B3 | `services/loadout.py` used by the 6 create/update serializers | loadout replace and trait tests per kind | M, −250 |
| B4 | `services/level_up.py` + `UnitLevelUpView` | level-up body tests per kind | S–M, −200 |
| B5 | Serializer bases; per-kind serializers keep `Meta.fields` | payload key-set snapshots per kind | M, −450 |
| B6 | `services/create.py`, `update.py`, `dismiss.py` + generic views + `unit_urlpatterns` on `WarbandScopedView` | URL-name `reverse` test, permission matrix, budgets | M, −500 |
| B7 | Generic kill history; delete `views/helpers.py` and the per-kind view modules | kill-history tests | S, −90 |
| F1 | `types/units.ts`, `unit-kinds.ts`, `unit-api.ts`; old per-kind api functions become thin re-exports | type-check + api tests | S, −150 |
| F2 | `UnitLevelUpDialog` + `UnitLevelUpControl` (98% identical) | dialog render tests per kind | S, −300 |
| F3 | `useUnitLevelUp` (LGT through the slot, one promote call after BUG-28) | request-sequence tests per kind | M, −350 |
| F4 | `UnitSummaryCard`, `UnitListBlocks` wrapper, `UnitExpandedCard` with slots | visible-text card tests per kind | M–L, −1,100 |
| F5 | `UnitFormCard` (henchmen = shared form + member list), `RacePicker` (5 copies → 1), add forms | form payload tests | L, −1,000 |
| F6 | `useUnitSectionEditor` + `UnitSection`; hero editing leaves `Warband.tsx` | save-hook payload tests re-pointed | L, −1,000 |
| F7 | Sheet query + mutations; delete `useWarbandLoader`, `useWarbandUpdateListener`, `warbands-events.ts`, store mirror | loader tests re-pointed; request-count test | M |

Expected net: about −5,000 lines (backend ~−1,550, frontend ~−3,900), in line with ROST-CQ-01.

**Existing tests and what they cover.**

| Behaviour | Covered by | Gap |
| --- | --- | --- |
| Item cost defaults, all kinds | `warbands/tests/test_warbands_api.py:105-167` | — |
| Seeded XP gives no level-ups | `:169` (hired), `:284` (henchmen) | hero |
| XP gain → level-ups, explicit `level_up` suppresses, `no_level_ups` | `:217-263`, `:302-348` | hero; custom thresholds for all |
| Hired-sword cap, blood pact | `:186`, `:202` | hero cap, dead units |
| Detail-list budgets constant in units | `core/tests/test_query_budgets.py:84-98` | list, single GET, PATCH, level-up budgets |
| Kill history ×3 + membership | `battles/tests/test_battles_api.py:1654-1884` | — |
| Leader after postbattle death; postbattle `no_level_ups` | `:2138`, `:3453` | leader from roster paths |
| Rating, unit lists, gold | `warbands/tests/test_summary_service.py` | — |
| Frontend: henchmen and hired-sword save seeding, `no_level_ups` cards, 3 list-block tests, XP bar, section shell, loader | 25 test files under `features/warbands` | hero save hook, level-up hooks, LGT, card text, trade badge gating |

**New tests (step 0).** API, parametrised `@kinds(HERO, HENCHMEN_GROUP, HIRED_SWORD)`: create writes the expected trade(s) and log; PATCH replaces each loadout list and logs only where today's code does; DELETE logs and refunds nothing; level-up per advance type; XP with default and custom thresholds; the response **key set** per endpoint and kind (locks the wire format through B5); `reverse()` for all 15 URL names; budgets for list, single GET, `PATCH {xp}` and level-up. Frontend: per-kind render tests that assert visible text (so generic components can swap in), save payload per kind, level-up request sequence per kind, and `mapToForm → buildPayload` round trips.

**Risks.**
- *Hidden divergence.* A difference not in §2 gets flattened. Mitigation: the key-set and per-kind tests, and PR A landing first so the kinds already agree.
- *Henchmen semantics.* Per-member trades, member sync and dead members are the least uniform part. They stay in `hooks.py`/`promote.py` and get their own tests.
- *Battles coupling.* Postbattle (`battles/views/shared.py`, 1,968 lines) reads unit fields directly. Only the XP call is shared in pass 1; the rest moves in pass 3.
- *Big frontend PRs.* F4–F6 touch the most-used screen. Keep commit order, and run the manual QA script (roster file §Manual QA) at 375 px after F6.
- *Import cycles* between models, kinds and serializers: kinds hold no serializer references (lookup tables instead).

## 7. Open questions for William

1. **Dismissed units (brief decision 4).** If dismiss becomes a soft status, `RosterUnit` gains `dismissed_at` (one migration per table plus `Henchman`) and `kind.visible()` filters it. Confirm before B1 so the base model and every "visible" query are shaped once.
2. **Summary vs detail payloads.** Once the sheet endpoint exists (PERF-24), serve the detail shape everywhere and delete the summary serializers and the frontend "has detail" sniffing? It costs payload size (item properties and availabilities) and saves one serializer and one type per kind. Default: yes, keeping the old list endpoints for old clients.
3. **One edit mode for the whole roster** (brief "ideas"). If you want it, the editor becomes `useRosterEditor` holding per-kind state, and `UnitSection` loses its own Edit/Save. Either way the per-kind pieces are the same; deciding before F6 avoids building the per-section shell twice.
4. **Payload inconsistencies** (`dead` missing from the hero summary; `kills`/`deeds`/`race` missing from summaries). Unify in PR C (additive keys only)? Default: yes, with decision 2.
