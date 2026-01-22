# mordheim

Local dev stack with React, Django, and Postgres in Docker.

## Start
1. `docker compose up --build`
2. Open `http://localhost:5173`

Backend health: `http://localhost:8000/api/health/`

## Seed data
- `docker compose exec backend python manage.py seed_items`
- `docker compose exec backend python manage.py seed_skills`
- `docker compose exec backend python manage.py seed_campaign_users`

## Migrate
- `docker compose exec backend python manage.py migrate`

## Stop
- `docker compose down`
