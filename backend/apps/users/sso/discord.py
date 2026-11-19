"""Discord sign-in.

Discord is plain OAuth 2.0 with no ID token at all: the flow reads `/users/@me` with the access token. Its `verified`
field is whether Discord has verified the account's email, which is what decides whether we may match it against an
existing account.

The display name is the user's chosen `global_name`, falling back to the `username` handle; neither is derived from
the email.
"""

from collections.abc import Mapping
from typing import Any

from .base import Provider, SsoProfile, clean_email

NAME_FIELDS = ("global_name", "username")


def read_profile(data: Mapping[str, Any]) -> SsoProfile:
    email = clean_email(data.get("email"))
    name = next((str(data.get(field) or "").strip() for field in NAME_FIELDS if data.get(field)), "")
    return SsoProfile(
        subject=str(data.get("id") or "").strip(),
        email=email,
        email_verified=bool(email) and data.get("verified") is True,
        name=name,
    )


PROVIDER = Provider(
    slug="discord",
    label="Discord",
    authorize_url="https://discord.com/oauth2/authorize",
    token_url="https://discord.com/api/oauth2/token",
    profile_url="https://discord.com/api/users/@me",
    scope="identify email",
    client_id_setting="DISCORD_OAUTH_CLIENT_ID",
    client_secret_setting="DISCORD_OAUTH_CLIENT_SECRET",
    read_profile=read_profile,
)
