# mordheim

Local dev stack with React (Vite), Django (DRF), and Postgres in Docker.

ONLY WEB SUPPORTED ATM

## Quickstart
1. `docker compose up --build --watch`
2. Open `http://localhost:5173`

Backend health: `http://localhost:8000/api/health/`

## Migrate
- `docker compose exec backend python manage.py migrate`

## Seed data
Run all seeds at once:

```docker compose exec backend python manage.py seed_all```

This runs the following seeders in order:
1. `seed_races` - `backend/apps/races/management/commands/seed_races.py`
2. `seed_items` - `backend/apps/items/management/commands/seed_items.py`
3. `seed_skills` - `backend/apps/skills/management/commands/seed_skills.py`
4. `seed_spells_and_special` - `backend/apps/spells/management/commands/seed_spells_and_special.py`

Should be able to see the join code for the created campaign if you wanted to test joining ^^

## Stop
- `docker compose down`

## What you can do
- Register, sign in, and sign out.
- Create campaigns, join by join code, and view your campaign list.
- Browse the campaign overview roster and open player warbands.
- Create your own warband and manage its roster.
- View other warbands and edit if you are the owner, campaign owner, or an admin with `manage_warbands`.
- Manage heroes: stats, XP, level-ups with dice rolling, skills, spells, specials, items, armour save, deeds, and casualties.
- Manage henchmen groups: group stats, max size, roster members, recruit/disband, group items/skills/specials, and level-ups with dice rolling.
- Manage warband economy: recruit costs, buy/sell/move items, and stash resources.
- Track warband activity with logs for personnel changes, advances, items, and trades.
- Manage house rules (owner or admin with `manage_rules`).
- View skills, spells, specials, and wargear; create new entries if you have `manage_skills` / `manage_items`.
- Manage campaign settings and admin permissions (owner only).

## Permissions (Campaigns)
- Owners have full access.
- Admins can be granted:
  - `manage_skills`
  - `manage_items`
  - `manage_rules`
  - `manage_warbands`


