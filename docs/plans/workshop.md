# The workshop: custom warbands and warband lists outside a campaign

William, 25 Nov 2026 (the night brief): the Campaigns page is retitled and gains a Warbands section (custom
warbands) and a Warband lists section (custom lists), both made outside any campaign and shared by a code.

## What William asked

- A user builds a warband outside a campaign with a **running total cost**, from every book item, skill, hired
  sword and so on: nothing custom (no campaign owns it).
- A user writes a **warband list** (a template) outside a campaign.
- Both carry a **code**. A list's code imports it into a campaign (its Warbands page), or into a custom warband
  being made. A warband's code imports it into a campaign **only for a player with no warband there**.
- An imported warband arrives **in its exact state**, owned by the importer, and pays what it cost **in one
  transaction**, as if just raised.
- Anyone with the code may import; the creator may delete his warband or list, which never touches a copy.
- A custom warband has **no resources, no log, no treasury**: the roster and the backstory.

## The shape (my call)

**A workshop is a hidden campaign of its own** (`Campaign.kind`: `campaign`, the default, or `workshop`), one per
custom warband and one per custom list, owned by its maker, never listed as a campaign. Everything that already
works on a campaign's warband (the store, Recruit as, skills, spells, upgrades, kit, the who-can answers, the
template editor) works in a workshop unchanged, because it *is* a campaign's warband. The alternatives (a warband
with no campaign, or a second roster model) would mean re-plumbing every warband service or writing a second
builder.

- A workshop ticks **every setting** (everything in the book is available) and refuses **every catalogue write**
  except a list workshop's template editor (a list's own rules are part of the list). It is never joined, has no
  battles, trades, bounties, encampments, locations or scenarios on any page, and is left out of every list,
  search, count and notification.
- **Cost** is the roster's value, read live: each hero's, hired sword's and henchman's `cost` and each owned
  item's paid cost (stash included). The page shows it against the list's starting gold ("Cost 455 / 500 gc"),
  warning above it, never blocking. The workshop's gold and ledger exist underneath but are never shown.
- **Codes** are 8 characters (no lookalikes), unique, on the workshop campaign (`share_code`); the kind says
  whether it is a warband or a list. Deleting a workshop soft deletes it (its code stops working); copies stay.
- **Importing a warband** (`POST campaigns/<id>/warbands/import/ {code}`): the importer must be a member with no
  live warband there. The roster is copied whole (units, kit, stash, skills, spells, specials, rules, variant,
  backstory) with every catalogue link remapped to the campaign's current entry (its version of a book entry).
  The warband starts with the campaign's starting gold as raising gives it (the template's difference from 500),
  then **one ledger row** pays the roster's cost. Answers warnings: content not in play here, over the gold.
  If the warband was raised from a custom list, the list comes too, as the campaign's own template.
- **Importing a list** (`POST campaigns/<id>/warband-templates/import/ {code}`, `edit_catalogue`): a copy as the
  campaign's own template, its own rules with it. A list can also be imported into my own lists (a copy I can
  edit) and picked when making a custom warband.
- A custom warband can also be **copied into my own workshop** by its code (to tweak someone's build).

## Phases (each its own branch, gated, merged)

1. **Backend: workshops.** `Campaign.kind`, `share_code`, soft delete; making a workshop warband (name, type,
   variant, or from a list code) and a workshop list (blank or a copy of a book list); the guards (no listing, no
   joining, no catalogue writes but the list's template, no battles and friends); the roster cost service and the
   sheet's `workshop` facts and capabilities; `GET workshop/` (mine) and `GET workshop/shared/<code>/` (a preview).
2. **Backend: imports.** The warband deep copy with remapping and the one-row payment; the list copy across
   campaigns (with its own specials); copying either into my own workshop.
3. **Frontend.** The page retitled with Campaigns, Warbands and Warband lists; the workshop warband page (the
   warband page with no treasury, log, resources, campaign points, battles or trading, and the cost); the list
   editor in a workshop; Import by code in a campaign's raise screen and its Warbands page.
4. **QA on a phone and the web**, CLAUDE.md, deploy.

## API (phases 1 and 2, backend)

Everything takes a signed-in user (anonymous: 401). Refusals use the standard body `{detail, code, fields}` and the
server's words; `detail` is fit to show. A workshop is its owner's alone: anyone else gets 404 on every route that
names it (its warband, its campaign, its templates), and a deleted one is 404 for its owner too.

### The shape

- `Campaign.kind` is `campaign` (default) or `workshop`; a workshop's `holds` is `warband` or `list`, and its
  `share_code` is 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L), unique, never reused.
  `deleted_at` soft deletes one. A check constraint keeps a campaign's three fields blank. Migration
  `campaigns/0026_workshops`.
- A workshop is made as a campaign is (its settings row on the defaults, 500 gc; its maker the owner and only member)
  with **every setting ticked**, no preset, no scenarios and no plots. A workshop's `id` **is its campaign's id**: the
  warband, catalogue, template and campaign routes take it as `campaign_id` as for any campaign.
- The campaign payload (`GET campaigns/<id>/`) carries `kind`, `holds` and `share_code` (null/blank for a campaign).
  A workshop's `capabilities` are all false, but a list workshop's `edit_catalogue` (its template editor).

### Workshop routes

| Route | Body | Answer |
| --- | --- | --- |
| `GET workshop/` | | `{warbands: [WarbandRow], lists: [ListRow]}`, newest first (8 queries, whatever their number) |
| `POST workshop/warbands/` | `{name, warband_type_id?, template_variant?, list_code?}` | 201 `WarbandRow` + `kind: "warband"`, `warnings` |
| `POST workshop/lists/` | `{name, copy_of_template_id?, warband_type_ids?}` | 201 `ListRow` + `kind: "list"`, `warnings` |
| `POST workshop/import/` | `{code}` | 201 a new workshop of mine holding a copy: `WarbandRow` or `ListRow`, with `kind` and `warnings` |
| `GET workshop/shared/<code>/` | | `Preview` (anyone signed in) |
| `DELETE workshop/<id>/` | | 204 (the owner; anyone else 404). Its code stops working; copies stay |

- `WarbandRow`: `{id, campaign_id (= id), warband_id, name, warband_type: {id, name} | null, cost, budget,
  share_code, updated_at}`.
- `ListRow`: `{id, campaign_id (= id), template_id, name, warband_types: [{id, name}], share_code, updated_at}`.
- `Preview`: `{kind: "warband" | "list", share_code, maker, name}` and, for a warband, `warband_type, cost, budget,
  heroes, henchmen (models), hired_swords`; for a list, `warband_types`. Unknown or deleted code: 404
  `code_not_found`. A code is read case-blind, spaces and dashes ignored.
- `POST workshop/warbands/` raises the warband through the campaign path (`raising.raise_warband`: the template's
  rules, variant, most warriors; its Starting Gold). `warband_type_id` is required without `list_code`; a type that
  presets no variant needs `template_variant` (400 as raising answers). With `list_code` the list is copied into the
  workshop as its own template first and the warband raised from it: `warband_type_id` must be one it serves (400
  `type_not_served`; left out: its first), a list serving none is 400 `list_serves_no_type`, a warband's code 400
  `not_a_list`. All or nothing.
- `POST workshop/lists/`: `copy_of_template_id` is a book template (400 otherwise); `warband_type_ids` book types,
  left out: the copy's source's types, each with the variant its source presets, none for a blank list.
  The list is then edited with the template editor's routes (`warband-templates/<template_id>/...`).

### Imports into a campaign

| Route | Rule | Body | Answer |
| --- | --- | --- | --- |
| `POST campaigns/<id>/warbands/import/` | a member | `{code}` | 201 `{warband_id, template_id, gold, warnings}` |
| `POST campaigns/<id>/warband-templates/import/` | `edit_catalogue` | `{code}` | 201 `{template_id, name, warnings}` |

- Warband: a non-member 404; an archived campaign 403 `campaign_archived`; a workshop 403 `workshop_campaign`; the
  importer already has a warband there 409 `has_warband`; a list's code 400 `not_a_warband`; unknown 404
  `code_not_found`. In one transaction the copy (below) is made for the importer with the Starting Gold raising gives
  (`raising.open_treasury`: the campaign's gold plus its template's difference from 500, its default resource and its
  preset's fixed counters), then **one** `Buy` ledger row of `-cost`, "Imported <name>". `template_id`: the list
  that came with it (when it was raised from its workshop's own list), else null. `gold` is the balance after.
- List: a warband's code 400 `not_a_list`. The copy is the campaign's own template, named as the list, "Name (2)"
  when the name is taken; its own rules (specials) come with it.
- `warnings` (each `{code, message, ...}`): `not_in_play` (`names`: entries, or the warband type, whose setting the
  campaign doesn't tick; linked all the same), `left_out` (`names`: a link to another campaign's own entry the copy
  could not use, never expected from a workshop), `gold_negative` (`gold`) for a campaign, `over_budget` (`cost`,
  `budget`) for a workshop; a warband raised from a custom list brings it, `list_serves_type` when the importer may
  edit the catalogue (it then serves its type for every warband there, the campaign's own before the book's), else
  `list_serves_none` (it arrives serving no type, so nobody else's recruiting changes; the warband keeps its list's
  rules, and an editor may make it serve its type).

### What a copy takes

The warband's name, type and `counts_as`, variant, dice colour, backstory, link, most warriors and mobile loadout
switch; its rules (not a plot's); its stash; every unit still on the roster (dead and dismissed ones, and dead or
dismissed members, stay behind) with its kit (a mount switched on stays on), a group's loadout rows and members'
gaps, skills, spells (`dc_change`), specials, pending picks, XP, level-ups and history, fighter keys, notes and
deeds. Not the ledger, log, resources, plot or campaign points, battles, wins and losses. Every catalogue link is the
campaign's current entry (its version of a book entry). A list copy takes every child row (types served, rules,
fighters and their keys, lists and lines, upgrades) and copies the source's own specials, typed by the copy's name
("Warband - <name>"); the fighters, upgrades and copied units point at those. The copy is 54 queries whatever the
roster's size.

### The workshop's warband

- The sheet (`GET warbands/<id>/sheet/`) has `workshop: {cost, budget, share_code}` (null for a campaign's warband).
  `cost` is live: heroes' and hired swords' `price`, each group's `price` × members still in it, and what every copy
  was paid (units' kit, a group's rows once per member who carries them, the stash by quantity); `budget` is the
  gold it is raised with (500 plus the template's difference from 500 in its variant, so Marienburg's 600).
- `capabilities.workshop` is true; `delete`, `trade` and `edit_catalogue` are false; `edit`, `level_up`,
  `manage_items` and `edit_backstory` as usual. The UI shows no treasury, ledger, log, resources, campaign points or
  plot, battles, trades, encampments, location visits or bounties for it.
- The server refuses (403 `workshop_campaign`): ledger writes (`warbands/<id>/trades/`), resource writes and sales,
  location visits, the warband's DELETE (delete the workshop), a hand-typed hire (`hirelings/hire/` with
  `source: custom`), `POST warbands/` naming a workshop.
- Its gold and ledger exist underneath and are never shown: the Starting Gold row, and Buy rows from purchases and
  recruits as anywhere. Gold drifts from `budget - cost` (a dismissal or an edited price moves the cost, not the
  gold), so nothing reads it: in a workshop the purchase and roster-save warnings replace `gold_negative` by
  `over_budget` (`{code, message, cost, budget}`) when the cost after the write is above the budget.

### Guards (deny by default)

- Every campaign route on `CampaignScopedView` refuses any write in a workshop (403 `workshop_campaign`) unless the
  view names what the workshop holds in `workshop_writes`: only the template editor's section saves
  (`basics/`, `fighters/`, `lists/`, `rules/`, `upgrades/`) take a **list** workshop's writes, and only for its own
  template (a book template's save there, which would make a house version, is refused too). So the catalogue's
  writes (items, skills, ... and `POST warband-templates/`, Revert, Delete), settings, members, join codes,
  archiving, campaign rules, charts, locations, encampments, scenarios and bounties are refused. Reads answer, owner
  only.
- Joining with a workshop's join code: 404 "Campaign not found". Battles and reported results (`get_writable_membership`)
  and trade requests: 403 `workshop_campaign`.
- Never listed: `GET campaigns/` and `GET warbands/` (without `campaign_id`) leave workshops out; account deletion's
  preview lists none, and deleting the account deletes them (soft).

### Open questions for William

- A warband imported from a custom list brings the list as the campaign's own template. Decided overnight: it
  serves its type only when the importer holds `edit_catalogue` (warned: for every warband there), else it arrives
  serving none (warned). Is that right? Two imports of one list make two templates ("Watch", "Watch (2)").
- New warband from a list code picks a variant when the list's type presets none (the preview carries the list's
  `variants` and each type's preset `variant`); a workshop list's editor leaves out "the book's serves it too".
- Should a recruit, and not only a purchase or a roster save, warn `over_budget` in a workshop? Today the hire
  dialog's (`hirelings/hire/`) answer doesn't; the page shows the cost against the budget throughout.
