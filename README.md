# mordheim

Local dev stack with React (Vite), Django (DRF), and Postgres in Docker.

## Quickstart
1. `docker compose up --build`
2. Open `http://localhost:5173`

Backend health: `http://localhost:8000/api/health/`

## Migrate
- `docker compose exec backend python manage.py migrate`

## Seed data
- `docker compose exec backend python manage.py seed_items`
- `docker compose exec backend python manage.py seed_skills`
- `docker compose exec backend python manage.py seed_races`
- `docker compose exec backend python manage.py seed_campaign_users`
  Should be able to see the join code for the created campaign if you wanted to test joining ^^

## Stop
- `docker compose down`

## What you can do
- Register, sign in, and sign out.
- Create campaigns, join by join code, and view your campaign list.
- Browse the campaign overview roster and open player warbands.
- Create your own warband and manage its heroes.
- View other warbands and edit if you are the owner, campaign owner, or an admin with `manage_warbands`.
- Manage house rules (owner or admin with `manage_rules`).
- View skills and wargear; create new entries if you have `manage_skills` / `manage_items`.
- Manage campaign settings and admin permissions (owner only).

## Permissions (Campaigns)
- Owners have full access.
- Admins can be granted:
  - `manage_skills`
  - `manage_items`
  - `manage_rules`
  - `manage_warbands`


