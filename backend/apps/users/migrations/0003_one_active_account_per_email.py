"""One active account per email address, guaranteed by the database (William, 19 Nov 2026).

Registration checks the address first (`RegisterSerializer.validate_email`), but a check can lose a race, so the
rule lives in an index too, as BUG-84's `EmailTaken` catch already assumes. Raw SQL because the model is
`django.contrib.auth.User`, which we don't own and can't give a `Meta.constraints` to.

Partial, and on `LOWER(email)`:
- `is_active` only, so a deleted account (inactive) never collides with anything, nor blocks the address from being
  used again;
- `email <> ''`, so the accounts that keep no address are all allowed — a deleted one, and an account made through a
  provider that didn't verify an email (`services.sso_accounts`), which stores it on the identity row instead;
- `LOWER(...)`, so two accounts can't differ by letter case alone. `account_for_email` queries `Lower("email")` for
  the same reason, and reads this index.
"""

from django.conf import settings
from django.db import migrations

INDEX = "auth_user_one_active_account_per_email"

CREATE = f"""
CREATE UNIQUE INDEX IF NOT EXISTS {INDEX}
ON auth_user (LOWER(email))
WHERE is_active AND email <> '';
"""

DROP = f"DROP INDEX IF EXISTS {INDEX};"


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_sso_identities_and_attempts"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [migrations.RunSQL(sql=CREATE, reverse_sql=DROP)]
