"""Campaign roles and permission codes: the one list every reader uses (BUG-15, IMP-64, design 0.29 Q1 and Q4).

The rows are seeded by migrations (0014, from a frozen copy of these lists), so a fresh database has every role and
code before its first request and nothing creates them on the request path. Adding a code means adding it here and
in a new data migration (`test_campaign_characterisation_permissions.py` fails until both exist). Owners and admins
hold every code (`permissions.IMPLICIT_PERMISSION_ROLES`); a player holds what joining grants (`JOIN_GRANTS`) and
what an owner or admin grants him.
"""

from dataclasses import dataclass

OWNER = "owner"
ADMIN = "admin"
PLAYER = "player"

ROLES: tuple[tuple[str, str], ...] = ((OWNER, "Owner"), (ADMIN, "Admin"), (PLAYER, "Player"))


@dataclass(frozen=True)
class PermissionCode:
    code: str
    label: str
    description: str


PERMISSIONS: tuple[PermissionCode, ...] = (
    PermissionCode("add_custom", "Add custom", "Add custom items, skills, spells and specials to the campaign."),
    PermissionCode("manage_items", "Manage items", "Edit and delete the campaign's custom items."),
    PermissionCode("manage_skills", "Manage skills", "Edit and delete the campaign's custom skills."),
    PermissionCode("manage_spells", "Manage spells", "Edit and delete the campaign's custom spells."),
    PermissionCode("manage_specials", "Manage specials", "Edit and delete the campaign's custom specials."),
    PermissionCode("manage_rules", "Manage rules", "Add, edit and delete the campaign's house rules."),
    PermissionCode("manage_warbands", "Manage warbands", "Edit every warband in the campaign, not just their own."),
    PermissionCode(
        "manage_encampments", "Manage encampments", "Edit, reassign and remove every encampment, not just their own."
    ),
    PermissionCode("manage_locations", "Manage locations", "Add and edit the campaign's locations."),
    PermissionCode("manage_bestiary", "Manage bestiary", "Add, edit and delete the campaign's bestiary entries."),
    PermissionCode(
        "manage_battles",
        "Manage battles",
        "See Settings > Active Battles, end, close or cancel stuck battles and edit past battle records.",
    ),
)

PERMISSION_CODES: tuple[str, ...] = tuple(entry.code for entry in PERMISSIONS)

JOIN_GRANTS: tuple[str, ...] = ("add_custom",)  # what a player holds on joining (and again on rejoining)
