"""Roles and permission codes on the request path: read, never created (BUG-15, CAMP-CQ-03).

Migration 0014 seeds the rows, so writes point at them by slug or code inside their own INSERT or UPDATE
(`role_ref`, `permission_ref`): no read first, no per-process cache to go stale. `seed_roles_and_codes` upserts
them from the constants, for the seed command and for tests that start from an emptied database.
"""

from collections.abc import Iterable
from typing import Any

from django.db.models import Subquery

from ..constants import PERMISSION_CODES, PERMISSIONS, ROLES
from ..models import CampaignMembershipPermission, CampaignPermission, CampaignRole

_LABELS = {entry.code: entry.label for entry in PERMISSIONS}


def role_ref(slug: str) -> Subquery:
    """The role's id as a subquery, for `role_id=` in an INSERT or UPDATE."""
    return Subquery(CampaignRole.objects.filter(slug=slug).values("id")[:1])


def permission_ref(code: str) -> Subquery:
    """The permission code's id as a subquery, for `permission_id=` in an INSERT."""
    return Subquery(CampaignPermission.objects.filter(code=code).values("id")[:1])


def grant_on_join(membership: Any, codes: Iterable[str]) -> None:
    """Give a new member these codes, one INSERT each, without reading them first."""
    for code in codes:
        CampaignMembershipPermission.objects.create(membership=membership, permission_id=permission_ref(code))


def describe(codes: Iterable[str] = PERMISSION_CODES) -> list[dict[str, str]]:
    """Each code (every code by default) as the API shows it, in the order given."""
    return [{"code": code, "name": _LABELS[code]} for code in codes if code in _LABELS]


def in_catalogue_order(codes: Iterable[str]) -> list[str]:
    """These codes in the catalogue's order (codes it doesn't list are dropped)."""
    held = set(codes)
    return [code for code in PERMISSION_CODES if code in held]


def seed_roles_and_codes() -> None:
    """Upsert every role and code from the constants (the seed command; tests on an emptied database)."""
    for slug, name in ROLES:
        CampaignRole.objects.update_or_create(slug=slug, defaults={"name": name})
    for entry in PERMISSIONS:
        CampaignPermission.objects.update_or_create(code=entry.code, defaults={"name": entry.label})
