"""The three social sign-in endpoints. Thin: parse, call `services.sso`, answer.

- `GET  auth/sso/providers/` — the providers this deploy has set up, so the sign-in page shows no dead button.
- `GET  auth/sso/<provider>/start/` — the authorize URL, the state, and the browser secret to send back with it.
- `POST auth/sso/<provider>/callback/` — the code and state; answers tokens and the user, as sign-in does.

Every refusal is a 400, 403 or 503 with a code (`apps.users.sso.base`). Never a 401: the frontend signs out on a 401
after a refresh, so a cancelled or stale attempt must not end the session the person may already have.
"""

from typing import Any

from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.throttling import SSO_CALLBACK_THROTTLE_CLASSES, SSO_START_THROTTLE_CLASSES

from .services.sso import complete, drop_stale_attempts, start
from .services.sso_accounts import password_ended_notice
from .sso.base import SsoError
from .sso.registry import configured_providers
from .views import signed_in


class SsoCallbackSerializer(serializers.Serializer):
    """What the frontend's callback route posts: the provider's code and state, and the secret the browser kept."""

    code = serializers.CharField(max_length=2048, trim_whitespace=True)
    state = serializers.CharField(max_length=128, trim_whitespace=True)
    browser_token = serializers.CharField(max_length=128, trim_whitespace=True)


def _refused(error: SsoError) -> Response:
    return Response(error.body(), status=error.status)


class SsoProvidersView(APIView):
    """The configured providers, newest-sign-in-page-first. Public, and it names no credentials."""

    authentication_classes = ()
    permission_classes = [permissions.AllowAny]

    def get(self, request: Any) -> Response:
        providers = [{"slug": provider.slug, "label": provider.label} for provider in configured_providers()]
        return Response({"providers": providers})


class SsoStartView(APIView):
    """Begins an attempt. GET, because it only hands out one attempt's parameters; the row it writes expires in ten
    minutes and stale ones are dropped here."""

    authentication_classes = ()  # a stale bearer header never stops a sign-in
    permission_classes = [permissions.AllowAny]
    throttle_classes = SSO_START_THROTTLE_CLASSES

    def get(self, request: Any, provider: str) -> Response:
        try:
            attempt = start(provider)
        except SsoError as error:
            return _refused(error)
        drop_stale_attempts()
        return Response(attempt)


class SsoCallbackView(APIView):
    """Finishes an attempt: the code is exchanged here, so the client secret never reaches a browser. Answers the
    token pair and the user, exactly as sign-in and sign-up do (201 for an account made now)."""

    authentication_classes = ()
    permission_classes = [permissions.AllowAny]
    throttle_classes = SSO_CALLBACK_THROTTLE_CLASSES

    def post(self, request: Any, provider: str) -> Response:
        serializer = SsoCallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            user, tokens, outcome = complete(provider, data["code"], data["state"], data["browser_token"])
        except SsoError as error:
            return _refused(error)
        response = signed_in(user, tokens, http_status=201 if outcome.created else 200)
        if outcome.password_ended:  # a lossy change says so plainly, once, where it happened
            response.data["notice"] = password_ended_notice(provider)
        return response
