# The workshop: custom warbands and warband lists outside a campaign

# Version 2: one workshop per player (William, 26 Nov 2026)

William: custom races, items, skills, spells and skill groups are needed in the workshop, which one hidden campaign
per warband or list can't share between a player's builds; "should every player get their own custom campaign".
Yes. He approved the plan below on 26 Nov 2026 ("make adjustments you think will improve speed and longevity";
players adding custom content "will be very few"). It replaces version 1's shape (one workshop per warband or
list), which is deleted outright (start afresh; prod's data is disposable).

## The shape

- **One workshop per player** (`Campaign.kind` `workshop`, `holds` gone), made on first use and never before, so a
  player who never builds costs nothing. It holds all their custom warbands, their lists and their custom content
  (items, races, skills, skill groups, spells, specials, hired swords, beasts), written through the catalogue's
  usual pages and write path, so it is in play for every warband and list in it.
- **In play is everything, computed, never stored**: a workshop ticks no settings rows; `in_play.py` treats a
  workshop as every setting ticked, so a setting added later is in play in every workshop without a backfill.
- **Several warbands per player in a workshop**: the one-warband-per-player-per-campaign constraint keeps holding in
  real campaigns and stops in a workshop (a field on `Warband` the constraint's condition can read).
- **Codes on the warband and on the list** (`share_code`, unique, null for anything not shared): deleting one soft
  deletes it (its code stops working); every copy stays.
- **Imports carry custom content**: copying a warband or list into a campaign, or into another player's workshop,
  copies each custom entry it uses (its own items with their prices and rules, races, skills with their groups,
  spells, specials, hired swords, beasts) as the target's own entry, linking one the target already holds when the
  name and the effect match (the "Skills and items match ours by name and effect" rule). For an importer with
  `edit_catalogue` they arrive usable by everyone (warned); for anyone else they arrive archived, so the warband
  keeps them and nobody else's pickers offer them (warned), as a list arrives serving no type.
- **Into my workshop** also from my own campaign warband (Copy to my workshop) and from a campaign's own list (Copy
  to my lists), besides a code.
- **A running cost, no budget** (William, 27 Nov 2026: "it shouldn't matter here, we just need a running cost"): the
  store and the recruit tally in a workshop show the roster's cost now and with the basket, never gold or a warning.

## Speed and longevity

- **Shared catalogue cache**: a list body depends on the book, the settings in play and the campaign's own and house
  entries. Almost no campaign has entries of its own, so a campaign with none of a kind reads the body cached for its
  set of settings, shared by every such campaign and every workshop (all of which read "everything"), and only a
  campaign holding its own entries keys its own. The worker's cache then holds a few dozen bodies whatever the
  number of campaigns and players. Correctness first: anything a list shows per campaign (usage, in-play, archive)
  keeps the campaign's own key.
- A workshop writes no settings rows, no scenarios, no preset rules, charts, locations or encampments.

## Phases

1. Backend: the workshop per player, warbands and lists in it with their own codes, delete, in-play computed, the
   warband constraint, the shared cache; version 1's shape removed.
2. Backend: imports carrying custom content (copy or link, archived for non-editors); copying a campaign warband or
   list into my workshop.
3. Frontend: Home's sections on the new routes, My content in the workshop (the catalogue pages), Copy to my
   workshop, the running cost.
4. QA on a phone and the web, CLAUDE.md, deploy.

## Version 2 API (phases 1 and 2, backend)

Everything takes a signed-in user (anonymous: 401). Refusals use the standard body `{detail, code, fields}` in the
server's words; `detail` is fit to show. A workshop is its player's alone: anyone else gets 404 on every route that
names it (its warbands, its campaign, its lists). Version 1's routes `DELETE workshop/<id>/` and the one-workshop-per-
warband-or-list shape are gone.

### The shape

- `Campaign.kind` is `campaign` (default) or `workshop`; a workshop names its player (`workshop_owner`, one live
  workshop each: `one_workshop_per_player`) and is soft deleted (`deleted_at`) only with its player's account.
  Migrations `campaigns/0027` (version 1's workshops retired: deleted) and `0028` (the rules).
- A workshop's `id` **is its campaign's id**: the warband, catalogue, template and campaign routes take it as
  `campaign_id` as for any campaign. It is made on the player's first use, and never before.
- `Warband`: `in_workshop` (set when made; the one-warband-per-player rule holds in campaigns only), `share_code`,
  `template` (the list it reads in its workshop, since several lists there may serve its type: raised from it,
  copied with it, else its type's template there when it was made; a new type in Settings names the list serving the
  new type, the one it named first if it serves it too), `deleted_at`. Migration `warbands/0027`.
- `WarbandTemplate.share_code`. Migration `warband_templates/0009`.
- Codes: 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L), unique across warbands and lists,
  never given out again (a deleted warband keeps its code, unreadable). Read case-blind, spaces and dashes ignored.
  Every warband and list in a workshop has one (made, copied in, or made in the editor's Make a template there);
  nothing in a campaign has one.
- **In play is computed**: a workshop ticks no settings (the campaign payload's `setting_ids` is `[]`) and every
  setting is in play there: catalogue rows, the warband type picker, who-can, materials, raising and the import
  warnings all read it so. No scenarios, preset, rules, charts, locations, encampments or plots are written for it.

### Workshop routes

| Route | Body | Answer |
| --- | --- | --- |
| `GET workshop/` | | `{id, warbands: [WarbandRow], lists: [ListRow]}`, newest first; `id` null before first use (7 queries, 1 with no workshop) |
| `POST workshop/` | | 200, the same, the workshop made if he has none (for My content before any warband or list) |
| `POST workshop/warbands/` | `{name, warband_type_id?, template_variant?, list_id?, list_code?}` or `{name, warband_type_id, no_list: true, max_units?}` | 201 `WarbandRow` + `kind: "warband"`, `warnings` |
| `POST workshop/lists/` | `{name, copy_of_template_id?, warband_type_ids?}` | 201 `ListRow` + `kind: "list"`, `warnings` |
| `POST workshop/import/` | `{code}` | 201 the copy in my workshop: `WarbandRow` or `ListRow`, with `kind` and `warnings` |
| `GET workshop/shared/<code>/` | | `Preview` (anyone signed in) |
| `POST warbands/<id>/to-workshop/` | | 201 `WarbandRow` + `kind`, `warnings`: my campaign warband (archived campaign too) copied into my workshop |
| `POST warband-templates/<id>/to-workshop/` | | 201 `ListRow` + `kind`, `warnings`: a campaign's own list (or house version), for any member of that campaign |

- `WarbandRow`: `{id (the warband's), campaign_id (the workshop's), name, warband_type: {id, name} | null,
  template_id (the list it reads), no_list, share_code, updated_at}`.
- `ListRow`: `{id (the template's), campaign_id, name, warband_types: [{id, name, variant}], variants, share_code,
  updated_at}`.
- `Preview`: `{kind: "warband" | "list", share_code, maker, name}` and, for a warband, `warband_type, cost,
  heroes, henchmen (models), hired_swords`; for a list, `warband_types, variants`. Unknown, deleted, archived or a
  deleted account's code: 404 `code_not_found`.
- `POST workshop/warbands/` raises through the campaign path (`raising.raise_warband`: the list's rules, variant, most
  warriors; a workshop's warband gets no Starting Gold row). The list it reads: `list_id`, one of my lists (400 `invalid` on `list_id` otherwise,
  "That isn't one of your lists."); else `list_code`, a shared list copied into my lists first (with its custom
  content), or used as it is when the code is one of mine (404 `code_not_found`, 400 `not_a_list` for a warband's
  code); else the book's list for the type, never one of mine (William, 26 Nov 2026: "One of my lists" is how I use
  those; `resolve.templates_for_type` reads only the book's in a workshop, for the raise outline too).
  With a list, `warband_type_id` must be one it serves (400 `type_not_served`; left out: its first), and a list
  serving none is 400 `list_serves_no_type`. Without one, `warband_type_id` is required (400 `invalid`, "Pick a
  warband type."). A type that presets no variant needs `template_variant` (400 on `template_variant`, as raising
  answers). All or nothing.
- **No list** (William, 26 Nov 2026: "You should be able to make a warband without using a list in workshop"):
  `no_list: true` raises it from no list at all. Its type is still required (400 `invalid`, "Pick a warband type.":
  a warband always has a type, which who-can reads for what the general store calls usually available, and the
  pages show), `max_units` (1 to 999, default 15) is its own, its variant is blank and it gets no rules. It stores
  `Warband.no_list` (migration `warbands/0029`, which dropped 0028's `budget`; one with no list names no list:
  `warband_no_list_names_none`) and reads **no template at all**, whatever its type: `resolve.templates_for_warband`
  and `template_for_new_type` answer none, so `GET warbands/<id>/template/` is `{template: null, no_list: true, ...}` (no Make a template; Recruit as offers
  only units made by hand; a `fighter_key` is refused), the store sells from the general catalogue (no list lines),
  and it has a running cost like any workshop warband. With `list_id` or `list_code` too: 400 on `no_list`.
- `POST workshop/lists/`: `copy_of_template_id` a book template or one of my lists (anyone else's reads as an unknown
  id, 400); `warband_type_ids` book types, left out: the copy's source's, each with the variant its source presets,
  none for a blank list. A name my lists or the book use: 400 `name_taken` (with `matches`), as the editor's Make a
  template answers. The list is then edited with the template editor's routes (`warband-templates/<id>/...`).
- Into my workshop (`import/`, `to-workshop/`): a warband's copy writes one Buy row of its cost (hidden), names its
  list (the copy of its own list, which keeps serving its types, else the book's template it read; one with no list
  stays so, and into a campaign reads its type's template) and gets its
  own code; a list's copy gets its own code. Custom content comes live (below).

### Inside a workshop: the usual routes

- **Warbands**: every warband route as in a campaign. `DELETE warbands/<id>/` soft deletes a workshop's warband
  (204; its code stops working, copies stay; the warband then reads as 404). The sheet's `workshop: {cost,
  share_code}` (null in a campaign); `capabilities.workshop` true, `trade` false, `delete` and `edit_catalogue` true.
  For one with no list, a new type in the warband PATCH keeps it without a list (no rules swapped in, no template named), and a variant is refused as it has none.
  Refused there (403 `workshop_campaign`): ledger writes, resource writes and sales, location visits, `POST
  warbands/` naming a workshop. Its gold is never shown and never warns (no `gold_negative` there): it starts on
  none, and the purchases, hires and sales its pages make still write their ledger rows as in a campaign.
- **His own catalogue** (My content; William, 26 Nov 2026: "New + edit own"): the kinds a warband and its units use
  (`CatalogueKindSpec.in_workshop`: items, item rules, skills, skill groups, spells, specials, races, beasts, hired
  swords, dramatis personae and warband lists) take creates with `campaign_id` = his workshop, and his own entries
  are edited and deleted as in a campaign. Scenarios, plots and exploration charts are never written there (403
  `workshop_campaign`). **The book's entries are read only**: an edit, a removal or a Revert of a book entry (or of a
  version), a book list's editor save, and a skill joining or leaving a book skill group (on `group_ids`) answer 403
  `workshop_book_entry`. **No archive**: `?archived=1` and Restore answer 403 `workshop_no_archive`; deleting his
  entry while something holds it archives it all the same (it leaves his lists, shops and pickers; every unit, list,
  beast or hired sword holding it keeps it), answered `200 {outcome: "hidden", usage}`, and nothing lists or
  restores it. A `name_taken` match carries `editable` and `restorable`, both false for a book entry there (and its
  detail says "Pick another name." when no match is either). The workshop's `capabilities` are all false but
  `edit_catalogue` and `delete_catalogue`; `edit_book_catalogue` and `archived_catalogue` (true in a campaign) are
  false, so the pages show no Edit or Revert on a book row and no Show archived.
- **His lists**: `POST warband-templates/ {name, campaign_id: <workshop>, ...}` makes one (with a code); the editor's
  section saves write his own lists only (a book template's: 403 `workshop_book_entry`; copy it into his lists
  instead), and the editor's warnings name no other list serving its type there (a workshop warband names the list it
  reads); `DELETE warband-templates/<id>/?campaign_id=<workshop>` deletes one nothing names (204) or hides one a
  warband names (200 `{outcome: "hidden", usage}`); either way its code stops working and the warband keeps reading it.
  `GET campaigns/<workshop>/warband-types/<type>/template/?list_id=<list>` is the raise outline from one of his lists.
- Every other campaign route refuses a workshop's writes (403 `workshop_campaign`): settings, members, join codes,
  archiving, custom warband types, campaign rules, charts, locations, encampments, scenarios, bounties, battles,
  reported results, trades and the campaign imports below. Joining by a workshop's join code: 404. Never listed:
  `GET campaigns/` and `GET warbands/` leave workshops out (`GET warbands/?campaign_id=<workshop>` lists its live
  warbands); account deletion's preview lists none, and deleting the account deletes the workshop.

### Imports into a campaign

| Route | Rule | Body | Answer |
| --- | --- | --- | --- |
| `POST campaigns/<id>/warbands/import/` | a member | `{code}` or `{warband_id}` | 201 `{warband_id, template_id, gold, warnings}` |
| `POST campaigns/<id>/warband-templates/import/` | `edit_catalogue` | `{code}` or `{list_id}` | 201 `{template_id, name, warnings}` |

- **His own by id** (William, 27 Nov 2026: "a user didn't have to import any of their own warbands or lists as they
  were there already"): `warband_id` / `list_id` names one of the caller's live workshop warbands or lists and copies
  it exactly as its code would (the same query count, a list's one fewer: a code looks among warbands first). Anyone
  else's, a deleted one, a campaign's, the book's or an unknown id: 400 `not_yours` ("That isn't one of your
  warbands." / "That isn't one of your lists.", on the field). Both a code and an id, or neither: 400 on the field.
  The raise screen's Import a warband and the Warbands page's Import a list offer his own (from `GET workshop/`) in a
  menu before By code.

- Warband: a non-member 404; an archived campaign 403 `campaign_archived`; a workshop 403 `workshop_campaign`; the
  importer already has a warband there 409 `has_warband`; a list's code 400 `not_a_warband`; unknown 404
  `code_not_found`. In one transaction: the copy with the Starting Gold raising gives, then **one** `Buy` row of
  `-cost`, "Imported <name>". `template_id`: the list that came with it, else null. `gold`: the balance after.
- List: a warband's code 400 `not_a_list`. The copy is the campaign's own template, "Name (2)" when the name is
  taken; its own rules (specials typed "Warband - <name>") come with it.

### What a copy takes, and the custom content it brings

The roster as version 1 copied it (54 queries then; now 62 whatever the roster's size, 113 with custom content of
every kind). **Custom content** is every entry of the source's own (its own entries and its versions of book entries)
that the copied rows use: items (with their prices, who may buy them and their rules; a source's own shared item rule
becomes the target's one of the same name and text, else a copy), races, skills (with the source's own groups holding
them or named by a unit's or fighter's skill access, and those groups' skills), spells, specials and beasts (with their
own item and their profile's skills, specials, spells and kit). Each is **linked** to the target's entry when the
target holds one (its own, archived ones too, or a book entry it hasn't replaced) of the same name and effect (every
field but the catalogue's bookkeeping, every child row, a link compared by its entry's name); else **copied** as the
target's own, a taken name numbered ("Lucky Charm (2)", a version of the book's Axe "Axe (2)"); a skill group copied
under a new name is the one the copied units and fighters name (a fighter's variant changes too). Hired swords and dramatis personae never travel as
entries: a hireling copied his profile when hired, so nothing links one. A line naming another campaign's own warband
type is dropped, and so is a copied list's type of that kind and a warband's (`left_out`).

The copies are **live** for an importer holding `edit_catalogue` in the target (always, in his own workshop): offered
to everyone there. For anyone else they arrive **archived**: the warband keeps them, nobody else's pickers offer them,
and the catalogue's Restore brings one back.

### Warnings (each `{code, message, ...}`)

- `not_in_play` (`names`): entries, or the warband type, whose setting the campaign doesn't tick (linked all the same).
- `left_out` (`names`): what the copy could not use there (another campaign's own warband type, an entry of a third
  campaign).
- `custom_content_added` (`names`): the copies made, live. `custom_content_archived` (`names`): the copies made,
  archived. Nothing is said of an entry linked.
- `gold_negative` (`gold`) in a campaign; none in a workshop.
- `list_serves_type` (`names`): its list came and serves its type for every warband there (an editor);
  `list_serves_none` (`names`): it came serving no type (anyone else).

### The shared catalogue cache

A campaign holding nothing of its own for a list (no own entry, version, archived entry or removed book entry of the
kind, nor a skill version for the skill groups' list) reads the body shared by every such campaign ticking the same
settings and the book's version, every workshop under one key (`all`): `apps/core/catalogue/sharing.py`. It is
computed from the book and the settings alone, and whether a campaign is plain, its settings and the book's version
are read in the membership's one query, so a hit costs one query as before. Nothing changes for the frontend.

### What the frontend on this branch still reads (version 1)

Home's workshop sections and the workshop pages are broken until they are rewired: `GET workshop/` rows now have the
warband's or list's own `id` (no `warband_id`, `template_id` is the list a warband reads, and the answer carries the
workshop `id`); `DELETE workshop/<id>/` is gone (`DELETE warbands/<id>/`, the catalogue's Delete of a list); the
campaign payload has no `holds` or `share_code` (`WorkshopPage` branches on `campaign.holds`; one workshop holds both,
so it is the player's workshop page with warbands, lists and My content); `/workshop/:id` is the workshop, a warband
there opens by its own id; import into my workshop no longer makes a workshop per copy.

### William's answers (26 Nov 2026)

- In a workshop, catalogue entries are "New + edit own": the book's are read only, and there is no archive (no
  Archive, Show archived or Revert); a deleted entry a warband still holds is hidden, the unit intact.
- A workshop shows only what affects a warband and its units (the catalogue pages above and the lists): no
  locations, encampments, scenarios, campaign, house or battle rules, charts, bounties or battles, no nav or route
  (a workshop path to one goes to its index), their writes refused.
- The editor's "X serves it too" is dropped in a workshop; campaigns keep it.
- A new warband by type uses the book's list for the type; "One of my lists" uses his own.
- No list of archived imported content for campaign owners (the catalogue's `?archived=1` view stays); no Races page.

### Open questions for William

- A name one of his deleted-but-held entries had stays taken in his workshop (the row is kept for what holds it, and
  names are unique per campaign), so a new entry needs another name: the form says "deleted, still in use" and offers
  nothing. Should a workshop bring that entry back instead (Restore under another word)?

---

# Version 1 (25 Nov 2026, replaced by version 2)


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
