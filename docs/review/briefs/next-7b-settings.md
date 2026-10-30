# Next, step 7b: campaign settings, the encampment and the rest

Branch `next`. This is the last build step. Read first:

- `scratchpad/next-1-report.md` to `next-4-report.md`, `next-6-report.md` and `next-7a-report.md`;
- the earlier briefs in this folder.

Same rules:

- Delete old code freely.
- Light testing: the gate is typecheck, lint, format, build, the remaining vitest suites and the backend gate when the backend changes.
- Small commits in the repo's style, no attribution lines. No push or merge, and never bare `git stash`.
- Don't stop for sign-off. Choose what keeps the design's intent and note it.

Scripts are in the scratchpad: `wt-fenext.sh`, `nextfe-gate.sh`, `wt-nextbe.sh`, `nextbe-gate.sh`.

**Functional reference:** main's old pages (`git show main:frontend/src/features/campaigns/...`, or the main checkout at the repo root). The settings page is `routes/CampaignSettings*` with `components/settings/` and `hooks/settings/`; the encampment is `routes/Encampments.tsx` and its components. Reuse the kept API and query hooks, and delete whatever ends up unused.

**Design:** there's no design E board for settings or the encampment.

- Build them from the step 1 primitives, in the style of the other E pages.
- `A-Web-Settings.dc.html` in the design folder is an older direction with the same square corners and fonts; use it for layout ideas only.
- Design folder: `C:\Users\wsess\AppData\Local\Temp\claude\C--src-code-projects-onebillionbeers\ee93fc75-5df2-4c84-aaa1-0df2f3050f1c\scratchpad\artifact-files\9ca91174-6a67-4b62-801a-bef2e7f39b98\project\`
- Light and dark, web and phone.

## Part A: campaign settings

Everything today's settings page does, on one page: tabs or sections on the web, and a section list that opens each section on a phone. It needs at least:

- **Campaign:**
  - name;
  - the settings and grade toggles;
  - item settings;
  - starting gold;
  - level-up thresholds and settings;
  - dice settings;
  - the warband rules fields;
  - the join code.
- **Players:**
  - members and their roles;
  - permission grants;
  - remove, with today's removal preview;
  - hand over.
- **Battles:**
  - active and stuck battles, with today's manager actions (review, close post-battle, end the fight, cancel);
  - the overview's stuck-battle Review and its ⋯ Campaign settings land here.
- **Locations:**
  - add, edit and remove the campaign's locations, including the `area` field from step 3;
  - the same flags as the warband page's Locations drawer.
- **Your warband:**
  - its details;
  - the warband sheet link;
  - delete warband;
  - leave campaign.
- **Lifecycle:** archive the campaign, restore it, and delete it for good, each behind today's confirms.
- **Feedback:** the feedback report card, as today.
- Who sees what follows today's capabilities.

## Part B: the encampment

Rebuild the encampment page (shown when the campaign has encampments switched on), on today's API: list, add, edit and remove, plus whatever today's page shows. The rail's and phone's Encampment links go to it.

## Part C: the rest

1. **Archived entries on the reference pages** (7a's gap): a "Show archived" toggle on the shared reference layout lists archived entries greyed, each with Restore, where today's API supports it.
2. **One basket:** the Wargear page's basket and the warband page's store share one basket per warband, kept for the session.
3. **No placeholders left:**
   - every rail, phone nav and Me sheet link leads to a real page;
   - remove `RebuildingPage`, `CAMPAIGN_PAGES` and any "step N" text.
4. **Campaigns list, Account and Landing:** check they look right in light and dark on web and phone. Fix anything that still uses old styles.
5. **Dead code sweep:**
   - find unused files, exports, hooks, CSS classes, test helpers and dependencies across the frontend, and delete them;
   - check `package.json` for dependencies nothing imports any more.
6. **Docs:** update the frontend README or structure notes if they describe deleted components.
7. **Final gate:** run the full frontend gate and the full backend gate on the final tree, and fix anything that fails.

## Report

Write `scratchpad/next-7b-report.md`:

- commits;
- what works;
- anything still missing;
- backend changes;
- calls you made;
- a short "before the switch" list: what you'd check before `next` replaces main, for example migrations added on `next` since main and any risky areas.
