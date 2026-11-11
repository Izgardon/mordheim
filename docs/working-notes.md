# Working notes

William's standing decisions that the code and git history don't show, kept here so every session, local or cloud,
has them. `CLAUDE.md` holds the product principles and engineering rules; this file holds the rest. Dates are when
William said it.

## Production database

**William, 31 Oct 2026:** "you dont need my okay, there are no active players, nothing is sacred, database is under
your control til i say otherwise", and the same day: "Free to merge whatever you need and keep going."
- Prod data is disposable: wipe and reseed it, and merge to main (which deploys), without asking. Tell him
  afterwards what was done. This lasts until he says otherwise; if he revokes it, ask first again.
- Before a destructive Neon call, check the project ID. One Billion Beers is a separate Neon project and is never
  touched.
- Before a wipe, take a cheap undo branch (`create_branch`, no compute) if anything is worth keeping.
- Never record or repeat a password or connection string, and don't fetch the prod connection string unless a step
  truly needs it.

**Where prod lives** (none of these IDs is a secret):
- Neon project `damp-silence-20519897` ("mordheim-frankfurt", AWS eu-central-1, Postgres 17), branch `production`
  (`br-late-breeze-b9e8ksw2`), database `neondb`, role `neondb_owner`.
- Backend on Render (Starter, Frankfurt): `https://mordheim-1.onrender.com`. Frontend on Vercel:
  `https://mordheim-eight.vercel.app`. Both deploy from `main`.

**Wiping prod** (the boot seed skips a complete catalogue, so new rows only reach prod through a wipe). **Not on
every merge** (William, 11 Nov 2026: "do whatever you think is best regarding seeding, i dont need to use the app
and its not being used anywhere right now"): prod's catalogue is allowed to fall behind main while nobody uses the
app, and is refreshed in one go when it next matters — before a demo, before anyone plays, or at the end of a run
of batches. The steps:
1. Check prod's users and campaigns in Neon. Take an undo branch if any are worth keeping.
2. Run `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO neondb_owner;
   GRANT ALL ON SCHEMA public TO public;` on that branch and database.
3. Push main. Render migrates on boot, and gunicorn's `when_ready` runs `seed_catalogue_if_empty`, which reseeds in
   the background: about 10 minutes.
4. Reseed the local database the same way (drop, `migrate`, `seed_all`, `seed_demo_campaign`).
5. Tell William the live demo needs re-running: `seed_demo_campaign --remote` against prod, with `DEMO_PASSWORD` set.
   It needs the prod connection string on a command line, which the classifier has refused, so William runs it.

## Deploying and checking a deploy

A push to `main` deploys both halves. Then check:
- `https://mordheim-1.onrender.com/api/health/` answers ok (Render takes a few minutes, longer with a reseed);
- the commit's Vercel status is success: `gh api repos/Izgardon/mordheim/commits/<sha>/status`;
- after a wipe, prod's counts match a fresh local seed (templates, races, skills, items, specials, bestiary), read
  with the Neon connector.

## The content plan

- **Sources, in order:** mordheimer.net first (a Docusaurus site whose JS chunks embed its JSON: warbands, items,
  skills, hired swords, dramatis personae and spell lists, each row with a grade and setting; its "New Warband
  Format" pages are the snapshot in `catalogue_import/sources/testwarbands-2026-10-31/`), then the big setting
  PDFs' store sections, then each warband's own PDF from broheim.net. William has a spreadsheet of every known item;
  it's a lookup for unmatched items, not the master list.
- **broheim.net** lists 162 warbands, 126 hired swords and 65 dramatis personae, graded 1a, 1b, 1c, 2a, 2b and 3.
  Grades 2b and 3 exist only as PDFs. `catalogue_import/sources/warbands-merged.json` has every type's `broheim_pdf`
  link. Neither site has a reuse licence, and Mordheim is Games Workshop's, so rule text goes in our own words with
  every number kept (William may paste printed text himself).
- **The PDF warbands:** the process, tools and remaining list are in `tools/pdf-warbands/`; the data rulings are in
  `backend/catalogue_import/sources/pdf-warbands/README.md`.
- **PDF rule of thumb (29 Oct):** an item listed and described in a warband's own section is generally locked to
  that warband (check each time, it isn't gospel). A big setting PDF usually opens with a store section listing its
  items, some with restrictions; start there.
- **The plans,** as claude.ai artifacts (readable in a session signed in as William): grades, settings and
  warbands `https://claude.ai/artifact/2sum2R6MqnyVU1zMWKzctz`; items and restrictions
  `https://claude.ai/artifact/8cFxDFEHuECrFjtXDzfZCE`; warband templates
  `https://claude.ai/artifact/9QFPQ31dpnpgYYFJqQWtaw`; the PDF import plan
  `https://claude.ai/artifact/WvDapUgBZgqpU5f59KcXuD`; the design canvas (design E)
  `https://claude.ai/artifact/LM1uYExwkVe7QUKgGnCmbD`. They're built; read them for the reasons behind a decision.

## Open items (8 Nov 2026)

- **PDF warbands:** 73 left, next Sartosa (`tools/pdf-warbands/remaining.md`). Broheim's extra hired swords (54)
  and dramatis personae (35) come after, also from PDFs; hired swords can be their own branch, and a setting PDF's
  go with that setting.
- **The mobile sweep:** William does it. New UI should already work on web and phone.
- **Email:** Resend is wired but unconfigured in prod, and needs a verified domain to mail other people. Either a
  domain (a cheap one at Cloudflare; then Resend needs no code change, only Render env vars) or Gmail SMTP with an
  app password (`emails.py` moved to `django.core.mail`). The domain shortlist was damned.city or mordheim.gg.
  William hasn't chosen.
- **Unit pictures:** players uploading pictures of their units, proposed as Cloudflare R2 with presigned uploads.
  Not planned; it waits on the domain.
- **Mutiny in Marienburg "strategies":** remind William; he'll explain what he wants. Don't design it before then.
- **The live demo on prod** needs re-running after each wipe (above).
- **Later:** short how-to videos once the flow settles; more of the rules in, mordheimer's post-game rules among
  them.
- **Left as rules for William to decide** (the starting-skills import): Veteran Tracker, the Mule Skinner's choice,
  namesakes worded their own way (Blackguard Strongman, Shinobi Infiltration, the Thieves' Pick Locks and Cutpurse,
  Knights Vanguard Lightning Reflexes, Warrior Wizard, Cathayan Haggle), conditional combinations (Highwayman,
  Roadwarden, Johann), Skilled Rider and the Pit Fighters' rule. Ride [Animal] doesn't say which animal.

## The 7 Nov change list

William's long UI list of 7 Nov (groups A to H: form pieces, items and store, hired swords and dramatis personae,
the warband page, campaign, battles, reference and content) is done, with its follow-ups (the wyrdstone sell
table, starting skills, unit notes, the closed card's icons, the overview's campaign-rules pills, Campaign points
with no menu, no hand-typed hire and the hire drawer's Add new going straight on to hiring). On 10 Nov one piece was
still on its branch, due to merge: Search everything's gaps with the tabs scrolling their bar
(`feat/search-everything`). Check `git log main` before redoing it. Left: the mobile sweep, William's.

## On William's Windows PC

- Never run python or python3 on the host, in any form, not even `--version`.
- Run things in containers: the dev stack is `docker compose`, and gates and one-off commands use `docker run`
  (with `MSYS_NO_PATHCONV=1` for volume paths in Git Bash).
- Docker Desktop restarts stop every container, so `docker start` the databases and the dev stack before a gate
  run.
