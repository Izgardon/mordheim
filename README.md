# mordheim

Local dev stack with React, Django, and Postgres running in Docker.

## Quick start
1. `docker compose up --build`
2. Open `http://localhost:5173`

Backend health: `http://localhost:8000/api/health/`

## Auth flow
- Register: `POST http://localhost:8000/api/auth/register/` (returns `access`, `refresh`, `user`)
- Login: `POST http://localhost:8000/api/auth/login/` (returns `access`, `refresh`)
- Refresh: `POST http://localhost:8000/api/auth/refresh/`
- Me: `GET http://localhost:8000/api/auth/me/` (Bearer token)

After login, the UI routes to `/campaigns`.

## Useful commands
- `docker compose down`
