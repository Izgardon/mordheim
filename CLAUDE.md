# Mordheim Project

## Backend (Django REST API)

Working directory: `backend/`

### Dependencies

Managed with **uv** via `pyproject.toml`. No requirements.txt.

```bash
cd backend
uv sync --all-extras  # install all deps including dev tools
```

### Linting & Formatting

Uses **ruff** (config in `pyproject.toml`). Line length: 120.

```bash
uv run ruff check .        # lint
uv run ruff check --fix .  # lint with auto-fix
uv run ruff format .       # format
```

### Type Checking

Uses **mypy** with django-stubs (config in `pyproject.toml`). Requires `DJANGO_SETTINGS_MODULE` env var.

```bash
DJANGO_SETTINGS_MODULE=config.settings uv run mypy . --config-file pyproject.toml
```

### Pre-commit Requirements

Before committing backend changes, you MUST:

1. Run `uv run ruff check .` and ensure zero errors
2. Run `uv run ruff format --check .` and ensure all files are formatted
3. Run `DJANGO_SETTINGS_MODULE=config.settings uv run mypy . --config-file pyproject.toml` and ensure zero errors

Do not commit code that fails any of these checks.
