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
