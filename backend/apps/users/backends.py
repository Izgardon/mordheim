from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.http import HttpRequest


class AccountBackend(ModelBackend):
    """Django's ModelBackend, loading the user's account (the session key) in the same query, so a sign-in costs the
    user query and last_login's UPDATE (SEC-05)."""

    def authenticate(
        self, request: HttpRequest | None, username: str | None = None, password: str | None = None, **kwargs: Any
    ) -> Any:
        if username is None or password is None:
            return None
        user_model = get_user_model()
        user = user_model._default_manager.select_related("account").filter(username=username).first()
        if user is None:
            user_model().set_password(password)  # as long as a wrong password takes, as ModelBackend does
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
