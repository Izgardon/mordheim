import uuid

from django.conf import settings
from django.db import models


class UserAccount(models.Model):
    """What the app keeps about a user beside django.contrib.auth's User: the session key (SEC-05, BUG-140).

    Every token carries the key as its `sk` claim, and a token whose key isn't the user's current one is refused
    (`apps.users.services.tokens`). A new key ends every session at once. Created at sign-up, or at the first sign-in
    of a user made another way (createsuperuser, the seeders).
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="account"
    )
    session_key = models.UUIDField(default=uuid.uuid4)

    class Meta:
        db_table = "user_account"

    def __str__(self) -> str:
        return f"account of user {self.user_id}"
