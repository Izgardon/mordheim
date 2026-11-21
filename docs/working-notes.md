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
3. **Make Render deploy, and confirm it did.** A wipe needs a boot to undo it: Render migrates on boot and
   gunicorn's `when_ready` runs `seed_catalogue_if_empty`. Pushing main is not enough on its own -- on 20 Nov 2026
   a push did not deploy and prod sat schemaless for 40 minutes -- so watch for it, and if nothing happens within
   a few minutes ask William for a Manual Deploy (Render dashboard) or for the service's **deploy hook URL**, a
   plain HTTPS POST that works through the session proxy. He holds that URL; it is a secret and is never written
   down here or committed.
   Nothing in the app shows the damage: `/api/health/` answers a static ok and runs no query
   (`apps/core/views.py`), so Render's probe keeps passing against a wiped database and the instance never
   restarts itself, while every real endpoint 500s. To tell migrated from not, POST `auth/login/` with a junk
   **`email`** and password: 500 means no tables, 400 means they are back (`username` 400s on validation without
   touching the database, and `auth/password-reset/` 503s before any lookup because prod has no Resend key --
   neither tells you anything). Ask Neon for `COUNT(*) FROM information_schema.tables` instead where you can; it
   is authoritative. Repeated login probes trip the throttle to 429, so poll the database, not the endpoint.
4. **A cloud session cannot seed prod itself.** Its container cannot resolve or reach Neon's Postgres host at all
   (no DNS, and the only egress is an HTTPS proxy psycopg cannot use), so `DATABASE_URL=... manage.py migrate`
   fails whatever credentials it is given. The Neon connector tunnels through Anthropic and is fine for queries,
   but a full catalogue seed is far too many rows to replay through it. Seeding happens on Render, or on
   William's PC.
5. Reseed the local database the same way (drop, `migrate`, `seed_all`, `seed_demo_campaign`), and check prod's
   counts against it: migrations, tables, skills, items, specials, templates, hired swords, presets and preset
   charts should match exactly.
6. Tell William the live demo needs re-running: `seed_demo_campaign --remote` against prod, with `DEMO_PASSWORD` set.
   It needs the prod connection string on a command line, which the classifier has refused, so William runs it.

## Deploying and checking a deploy

A push to `main` deploys both halves. Then check:
- `https://mordheim-1.onrender.com/api/health/` answers ok (Render takes a few minutes, longer with a reseed);
- the commit's Vercel status is success: `gh api repos/Izgardon/mordheim/commits/<sha>/status`;
- after a wipe, prod's counts match a fresh local seed (templates, races, skills, items, specials, bestiary), read
  with the Neon connector.

## Social sign-in (Google and Discord)

Players can sign in without a password (`apps/users/sso/`, `services/sso.py`): OAuth 2.0 Authorization Code with
PKCE, the code exchanged **server-side**, so no client secret ever reaches a browser. A provider whose credentials
are unset is left out of `GET auth/sso/providers/`, so the sign-in page shows only what is set up.

**Render environment variables** (the backend; Vercel needs none):
- `FRONTEND_URL` = `https://mordheim-eight.vercel.app` — **set it before the provider credentials.** Both the
  reset links and the OAuth redirect URI are built from it, so with `DJANGO_DEBUG` off the backend refuses to start
  without an `https://` value once `RESEND_API_KEY` or a provider's pair is set. While all of them are unset
  nothing reads it, so deploying social sign-in with no credentials yet cannot stop gunicorn.
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `DISCORD_OAUTH_CLIENT_ID`, `DISCORD_OAUTH_CLIENT_SECRET`

**The redirect URIs to register** (the provider sends the player back to the *frontend*, which posts the code to the
backend, so no token ever rides in a URL):
- `https://mordheim-eight.vercel.app/auth/callback/google` and `.../auth/callback/discord`
- `http://localhost:5173/auth/callback/google` and `.../auth/callback/discord` (local)

**Google Cloud Console**: APIs & Services → OAuth consent screen (External, the app's name, support email, scopes
`openid`, `email`, `profile`), then Credentials → Create credentials → OAuth client ID → Web application, with the
four redirect URIs above under "Authorised redirect URIs" and `https://mordheim-eight.vercel.app` plus
`http://localhost:5173` under "Authorised JavaScript origins". While the consent screen is in Testing, only the
accounts listed under Test users can sign in.

**Discord developer portal**: New Application → OAuth2. Add the same redirects under Redirects, and reset the client
secret to read it once. Scopes `identify` and `email` are requested by the app; nothing to tick.

**Accounts.** A provider's **verified** email matching an active account links to it, so a player who signed up with
a password keeps one account. An email a provider does not call verified never matches: that sign-in gets a new
account, and the untrusted address is kept on the identity row only. A deleted account (inactive, no email) is never
matched or resurrected, and deleting an account unlinks its providers.

**One account per address, combining in one direction only** (William, 19 Nov 2026: "lets combine if someone's
account is the same email as their Google or discord"). A verified email proves the person controls it, so SSO onto
an existing password account links. The reverse proves nothing, so registering with an address an SSO account holds
is refused and names the provider — "You already have an account. Sign in with Google." — rather than setting a
password on it, which would hand the account to anyone who knew the address. `users/0003` adds a partial unique
index on `LOWER(email)` where `is_active AND email <> ''`, so the rule holds under a race too.

**Forgot password is for password accounts only** (William, 19 Nov 2026: "forgot password route is only for people
that create an account without sso"). A reset finds users by `username=email`, and an SSO account's username is
opaque, so a request for its address sends nothing and answers exactly as it does for an unknown address. A player
who registered with a password and later linked Google keeps their password and their reset. There is no flow for
adding a password to an SSO account.

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

## Open items (20-21 Nov 2026, the campaign rules)

Seven settings' rules were imported overnight on 20 Nov (Albion, Karak Azgal, Athel Loren, Lustria, Empire in Flames,
the Nemesis Crown, the Sealed City), and Relics of the Crusades gained its one document's two rules on 21 Nov.
William's answers of 21 Nov are applied: the simple book defects are fixed (Albion's giant, Empire in Flames'
Propulsion damage, Beastmen scenarios and wagon horses, the 12s in Lustria's and Empire in Flames' scenario
tables, Athel Loren's 55 and 64, the Sealed City's Amnesia, Lock Picks' door modifier); the Nemesis Crown explores
by the Empire in Flames chart; the Sealed City's ambitions are plots with campaign points on; existing items keep
their own prices in every setting; the Stygian Mutations table is a chart of its campaign, with no mapping; a
chart's result takes 40 characters.

**Waiting on William**

- **Athel Loren's nine shops: pencilled for the locations work** (William, 21 Nov 2026: "would sit well in our
  locations structure ... dont need them done just yet"). Not charts. Each shop is a place a warband travels to
  after a battle, with its hazard rolls, its own price list and the henchmen it recruits. The seven items its
  shops sold that we lacked (Yew Staff, Sword of Orion, Yew Bow, Fighting Falcons, Yew Armour, War Hawk, Wild Cat)
  are not imported, since none has rules (William, 21 Nov 2026: "if not rules then dont import, i dont want dead
  items lying around"); the store keeps its normal prices.
- **Relics of the Crusades Part 1** (items, skills and spells imported, 21 Nov 2026). Open: Light and Silence join
  "all spell and prayer lists", so they are one lore of their own, All Lores, rather than copies in every lore; the
  Holy group is open to everyone with the paths as its note, and like every group but Grade 3's carries no setting, so
  it lists outside Relics with its skills out of play; Scholarly Works (Path of Knowledge, 50+2D6, Rare 9) is not
  an item, having no rules; other towns' prices are notes on each item's one price row. Flaming Arrows are left out
  (William). Its own exploration chart is imported, and its preset explores by it.
- **Darksteel's naming.** The material is called Dark Elf Blade, and a copy reads "Dark Elf Sword", because
  "Dark Elf Blade Sword" does not read. Darksteel's own copies read "Darksteel Sword".
- **Silver's book text** still carries the book's sentence about silvering a weapon the warband already owns, though
  that mechanism is gone: items are never transformed. Kept as reference text the player settles at the table.
- **One flavour clause dropped.** The Sealed City's Protect and Serve Bounty rung has a lawful warband put a price
  on a head "through their evil schemes", copied from Reign from Shadows. The four words are not in ours.
- **Pirates of the Great Ocean** (a Sealed City plot's who-can text) may or may not be our Mordheim 1b Pirates.
- **Left as printed:** Athel Loren's Dwarf Outpost asks for a Mountain Hazard no chart holds, and Lustria's
  opening hazard D6 is never used. Fixing either means inventing a rule.
- **Mordheim** has no rules file: its rules are the rulebook and its preset dictates nothing. **Relics of the
  Crusades** is whole: Part 1 (broheim's `downloads/fo/96RelicsoftheCrusadesPt1.pdf`, beside Part 2's 97) holds its
  campaign rules, items, skills, spells and exploration chart, all imported 21 Nov 2026.

**Prices the books print differently from ours** (kept ours, per William): Horseman's Hammer (the item entry says
12 gc, the Empire in Flames chart 30), Barding (book 30 gc Rare 11, ours 80 gc Rare 8), Nightmare and Giant Spider,
Clockwork Prosthesis (the Sealed City chart 30/60 gc Rare 11, ours 10 gc Rare 7), and the whole Sealed City price
chart.

**Lustria's Tomb Raider skill** (replaces Wyrdstone Hunter there) is not imported; William: not important.

**Still to rotate before release:** the Neon `neondb_owner` password and the Render deploy hook key, both of which
were pasted into a session transcript.

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
