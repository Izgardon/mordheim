from django.apps import AppConfig


class HirelingsConfig(AppConfig):
    """The hireling catalogue: the hired swords and dramatis personae a warband hires as hirelings (its units live in
    apps/warbands)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.hirelings"
