"""Campaign roles and permission codes: the one list every reader uses (BUG-15, IMP-64, design 0.29 Q1 and Q4).

The rows are seeded by migration `0003_seed_roles_and_permissions` (from a frozen copy of these lists), so a fresh
database has every role and code before its first request and nothing creates them on the request path. Adding a
code means adding it here and in a new data migration (`test_campaign_characterisation_permissions.py` fails until
both exist). Owners and admins hold every code (`permissions.IMPLICIT_PERMISSION_ROLES`); a player holds what joining
grants (`JOIN_GRANTS`) and what an owner or admin grants him.
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
    # one code for the whole catalogue (decision 4), and deleting apart from it (decision 5); they replaced
    # add_custom, manage_items, manage_skills, manage_spells, manage_specials and manage_bestiary (pass 5)
    PermissionCode(
        "edit_catalogue",
        "Edit catalogue",
        "Add items, skills, spells, specials, races, bestiary entries, hired swords, dramatis personae and item"
        " properties to the"
        " campaign's catalogue, edit any entry (a book entry through the campaign's own version of it), revert versions"
        " and restore what was archived.",
    ),
    PermissionCode(
        "delete_catalogue",
        "Delete catalogue",
        "Delete the campaign's custom entries (an entry in use is archived instead) and hide book entries from the"
        " campaign.",
    ),
    PermissionCode("manage_rules", "Manage rules", "Add, edit and delete the campaign's house rules."),
    PermissionCode("manage_warbands", "Manage warbands", "Edit every warband in the campaign, not just their own."),
    PermissionCode(
        "manage_encampments", "Manage encampments", "Edit, reassign and remove every encampment, not just their own."
    ),
    PermissionCode("manage_locations", "Manage locations", "Add and edit the campaign's locations."),
    PermissionCode(
        "manage_battles",
        "Manage battles",
        "See Settings > Active Battles, end, close or cancel stuck battles and edit past battle records.",
    ),
)

PERMISSION_CODES: tuple[str, ...] = tuple(entry.code for entry in PERMISSIONS)

JOIN_GRANTS: tuple[str, ...] = ("edit_catalogue",)  # what a player holds on joining (and again on rejoining)
