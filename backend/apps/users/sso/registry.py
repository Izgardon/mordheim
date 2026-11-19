"""The providers this deploy has, and the credentials each one needs.

A provider with no client id or secret is **not configured**: it is left out of `GET auth/sso/providers/`, so a
half-set-up deploy shows no dead button, and its start and callback endpoints answer 503 `sso_not_configured`.
"""

from __future__ import annotations

from django.conf import settings

from . import discord, google
from .base import NOT_CONFIGURED, UNKNOWN_PROVIDER, Provider, SsoError

PROVIDERS: dict[str, Provider] = {provider.slug: provider for provider in (google.PROVIDER, discord.PROVIDER)}


def credentials(provider: Provider) -> tuple[str, str]:
    """The provider's `(client_id, client_secret)` from the environment; either may be blank."""
    client_id = str(getattr(settings, provider.client_id_setting, "") or "").strip()
    client_secret = str(getattr(settings, provider.client_secret_setting, "") or "").strip()
    return client_id, client_secret


def is_configured(provider: Provider) -> bool:
    return all(credentials(provider))


def configured_providers() -> list[Provider]:
    """The providers the sign-in page may offer, in the registry's order."""
    return [provider for provider in PROVIDERS.values() if is_configured(provider)]


def provider_for(slug: str) -> Provider:
    """The provider `slug` names, configured on this deploy; else SsoError (400 unknown, 503 not configured)."""
    provider = PROVIDERS.get(slug)
    if provider is None:
        raise SsoError(UNKNOWN_PROVIDER, 400, "That sign-in provider isn't available.")
    if not is_configured(provider):
        raise SsoError(NOT_CONFIGURED, 503, f"{provider.label} sign-in isn't set up on this server.")
    return provider
