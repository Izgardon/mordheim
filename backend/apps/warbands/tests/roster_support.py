"""Shared fixtures for the roster characterisation tests (pass 1).

The `test_roster_characterisation_*` modules lock in how the hero, henchmen-group and
hired-sword endpoints behave today, so the shared-unit refactor
(docs/review/designs/unit-abstraction.md) can prove it changed nothing. Behaviour the
three kinds share is asserted once per kind by looping over `KINDS`; divergences are
spelled out per kind, and known bugs are pinned with their BUGS.md ID and the comment
"Characterises current behaviour (BUG-NN); update when fixed".
"""

from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from apps.battles.models import Battle, BattleEvent, BattleKill
from apps.campaigns.models import (
    Campaign,
    CampaignMembership,
    CampaignMembershipPermission,
    CampaignPermission,
    CampaignRole,
    CampaignSettings,
)
from apps.items.models import Item, ItemAvailability, ItemAvailabilityWarband, ItemRule, ItemRuleLink
from apps.races.models import Race
from apps.skills.models import Skill, SkillGroup, SkillGroupSkill
from apps.special.models import Special
from apps.spells.models import Spell
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling, Warband, WarbandLog, WarbandTrade, WarbandType
from apps.warbands.utils.henchmen_level import HENCHMEN_LEVEL_THRESHOLDS
from apps.warbands.utils.hero_level import HERO_LEVEL_THRESHOLDS

RosterUnit = Hero | HenchmenGroup | Hireling

ALL_STAT_ADVANCES = ("M", "WS", "BS", "S", "T", "W", "I", "A", "Ld")
STAT_FIELD_BY_ADVANCE = {
    "M": "movement",
    "WS": "weapon_skill",
    "BS": "ballistic_skill",
    "S": "strength",
    "T": "toughness",
    "W": "wounds",
    "I": "initiative",
    "A": "attacks",
    "Ld": "leadership",
}


@dataclass(frozen=True)
class Kind:
    """What the tests need to know about one unit kind (mirrors the planned UnitKindSpec)."""

    key: str
    segment: str
    model: type[RosterUnit]
    items: str
    skills: str
    specials: str
    spells: str | None
    thresholds_setting: str
    default_thresholds: tuple[int, ...]
    trade_action: str
    log_new: str
    log_remove: str
    log_advance: str
    loadout_log_prefix: str | None
    has_no_level_ups: bool
    stat_advances: tuple[str, ...]

    def __str__(self) -> str:
        return self.key


HERO = Kind(
    key="hero",
    segment="heroes",
    model=Hero,
    items="hero_items",
    skills="hero_skills",
    specials="hero_specials",
    spells="hero_spells",
    thresholds_setting="hero_level_thresholds",
    default_thresholds=HERO_LEVEL_THRESHOLDS,
    trade_action="Recruit",
    log_new="new_hero",
    log_remove="remove_hero",
    log_advance="hero",
    loadout_log_prefix="hero",
    has_no_level_ups=False,
    stat_advances=ALL_STAT_ADVANCES,
)
HENCHMEN = Kind(
    key="henchmen_group",
    segment="henchmen-groups",
    model=HenchmenGroup,
    items="henchmen_group_items",
    skills="henchmen_group_skills",
    specials="henchmen_group_specials",
    spells=None,
    thresholds_setting="henchmen_level_thresholds",
    default_thresholds=HENCHMEN_LEVEL_THRESHOLDS,
    trade_action="Recruit",
    log_new="new_henchmen_group",
    log_remove="remove_henchmen_group",
    log_advance="henchmen",
    loadout_log_prefix=None,
    has_no_level_ups=True,
    stat_advances=("WS", "BS", "S", "I", "A", "Ld"),
)
HIRELING = Kind(
    key="hireling",
    segment="hirelings",
    model=Hireling,
    items="hireling_items",
    skills="hireling_skills",
    specials="hireling_specials",
    spells="hireling_spells",
    thresholds_setting="hired_sword_level_thresholds",  # their own table, the hero table at first (William, 7 Nov 2026)
    default_thresholds=HERO_LEVEL_THRESHOLDS,
    trade_action="Hire",
    log_new="new_hireling",
    log_remove="remove_hireling",
    log_advance="hireling",
    loadout_log_prefix="hireling",
    has_no_level_ups=True,
    stat_advances=ALL_STAT_ADVANCES,
)
KINDS = (HERO, HENCHMEN, HIRELING)


def unit_url(kind: Kind, warband_id: int, unit_id: int | None = None, suffix: str = "") -> str:
    """`/api/warbands/<w>/<segment>/[<unit>/][suffix]`; suffix is e.g. "detail/" or "level-up/"."""
    url = f"/api/warbands/{warband_id}/{kind.segment}/"
    if unit_id is not None:
        url += f"{unit_id}/"
    return url + suffix


def make_unit(kind: Kind, warband: Warband, *, members: tuple[str, ...] = ("Alpha", "Beta"), **fields: Any) -> Any:
    """Create a unit directly in the DB; henchmen groups get living `members`."""
    values = {"name": f"Test {kind.key}", "unit_type": "Trooper", **fields}
    unit: Any = kind.model.objects.create(warband=warband, **values)
    if kind is HENCHMEN:
        Henchman.objects.bulk_create([Henchman(group=unit, name=name) for name in members])
    return unit


def create_payload(kind: Kind, **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"name": "Recruit", "unit_type": "Trooper", "price": 25}
    if kind is HENCHMEN:
        payload["henchmen"] = [{"name": "Alpha"}]
    payload.update(overrides)
    return payload


def related_ids(unit: Any, relation: str | None, target: str) -> list[int]:
    """Catalogue ids linked to `unit` through a join relation, in row order."""
    if relation is None:
        return []
    return list(getattr(unit, relation).order_by("id").values_list(f"{target}_id", flat=True))


def trade_rows(warband: Warband) -> list[tuple[str, str, int, str | None]]:
    """(action, description, price, parent description) for every ledger row, oldest first."""
    rows = WarbandTrade.objects.filter(warband=warband).select_related("parent").order_by("id")
    return [(row.action, row.description, row.price, row.parent.description if row.parent else None) for row in rows]


def clear_ledger(warband: Warband) -> None:
    """Start the warband's ledger again: no rows and no gold (the stored balance follows the rows)."""
    WarbandTrade.objects.filter(warband=warband).delete()
    Warband.objects.filter(id=warband.id).update(gold=0)


def log_rows(warband: Warband) -> list[tuple[str, str, dict[str, Any], str | None]]:
    """(feature, entry type, payload, parent entry type) for every log row, oldest first."""
    rows = WarbandLog.objects.filter(warband=warband).select_related("parent").order_by("id")
    return [(row.feature, row.entry_type, row.payload, row.parent.entry_type if row.parent else None) for row in rows]


def record_kill(
    battle: Battle,
    killer: Hero | Hireling | Henchman,
    victim: str = "Rat",
    warband: Warband | None = None,
    **columns: Any,
) -> BattleKill:
    """A live kill (battle_kill, next step 9) by a hero, hired sword or henchman, with its event: a victim of
    `warband` (a hero), or someone named by hand without one."""
    event = BattleEvent.objects.create(battle=battle, type=BattleEvent.TYPE_UNIT_KILL_RECORDED, payload_json={})
    if isinstance(killer, Henchman):
        kind, keys, own = "henchman", {"killer_henchman": killer, "killer_group": killer.group}, killer.group.warband
    else:
        kind = "hero" if isinstance(killer, Hero) else "hireling"
        keys, own = {f"killer_{kind}": killer}, killer.warband
    fields = {"phase": "fight", "round": 1, "killer_name": killer.name, **columns}
    return BattleKill.objects.create(
        battle=battle,
        campaign_id=battle.campaign_id,
        event=event,
        killer_warband=own,
        killer_kind=kind,
        victim_kind="hero" if warband else "someone_else",
        victim_warband=warband,
        victim_name=victim,
        **keys,
        **fields,
    )


def _user(email: str) -> Any:
    return get_user_model().objects.create_user(username=email, email=email, password=None, first_name=email[:5])


def _catalogue_item(name: str, costs: list[int], only: WarbandType, rule: ItemRule) -> Item:
    item = Item.objects.create(name=name, type="Melee", strength="As user", range="Close", save_value="-")
    for cost in costs:
        availability = ItemAvailability.objects.create(item=item, cost=cost)
        ItemAvailabilityWarband.objects.create(availability=availability, warband_type=only)
    ItemRuleLink.objects.create(item=item, rule=rule)
    return item


class RosterTestCase(APITestCase):
    """A campaign with one user per permission level, two warbands and a small catalogue.

    `player` owns `warband` and is a plain player; `campaign_owner`, `admin` and `manager`
    (a player with manage_warbands) may edit it; `viewer` (owner of `rival`) may only read it;
    `outsider` is not in the campaign.
    """

    client: APIClient
    campaign: Campaign
    campaign_settings: CampaignSettings
    player: Any
    campaign_owner: Any
    admin: Any
    manager: Any
    viewer: Any
    outsider: Any
    warband: Warband
    rival: Warband
    race: Race
    other_race: Race
    foreign_race: Race
    sword: Item
    axe: Item
    skills: list[Skill]
    combat: SkillGroup  # holds the skills: the group his log names a learned one by
    specials: list[Special]
    spells: list[Spell]
    large: Special
    wizard: Special
    priest: Special

    @classmethod
    def setUpTestData(cls) -> None:
        roles = {
            slug: CampaignRole.objects.get_or_create(slug=slug, defaults={"name": slug.title()})[0]
            for slug in ("owner", "admin", "player")
        }
        manage, _ = CampaignPermission.objects.get_or_create(
            code="manage_warbands", defaults={"name": "Manage warbands"}
        )
        cls.campaign = Campaign.objects.create(name="Shards", join_code="SHARD1")
        cls.campaign_settings = CampaignSettings.objects.create(campaign=cls.campaign)
        other_campaign = Campaign.objects.create(name="Elsewhere", join_code="ELSE01")

        cls.player = _user("player@example.com")
        cls.campaign_owner = _user("owner@example.com")
        cls.admin = _user("admin@example.com")
        cls.manager = _user("manager@example.com")
        cls.viewer = _user("viewer@example.com")
        cls.outsider = _user("outsider@example.com")
        for user, role in (
            (cls.player, "player"),
            (cls.campaign_owner, "owner"),
            (cls.admin, "admin"),
            (cls.manager, "player"),
            (cls.viewer, "player"),
        ):
            membership = CampaignMembership.objects.create(campaign=cls.campaign, user=user, role=roles[role])
            if user is cls.manager:
                CampaignMembershipPermission.objects.create(membership=membership, permission=manage)
        CampaignMembership.objects.create(campaign=other_campaign, user=cls.outsider, role=roles["owner"])

        cls.warband = Warband.objects.create(campaign=cls.campaign, user=cls.player, name="Monks")
        cls.rival = Warband.objects.create(campaign=cls.campaign, user=cls.viewer, name="Rats")

        maxima = {"movement": 4, "weapon_skill": 6, "ballistic_skill": 6, "strength": 4, "toughness": 4}
        maxima |= {"wounds": 3, "initiative": 6, "attacks": 4, "leadership": 9}
        cls.race = Race.objects.create(name="Human", **maxima)
        cls.other_race = Race.objects.create(name="Dwarf", **maxima)
        cls.foreign_race = Race.objects.create(name="Lizard", campaign=other_campaign, **maxima)

        sisters = WarbandType.objects.create(name="Sisters of Sigmar", slug="sisters-of-sigmar")
        parry = ItemRule.objects.create(name="Parry", slug="parry")
        cls.sword = _catalogue_item("Sword", [10], sisters, parry)  # one price row: cost defaults to 10
        cls.axe = _catalogue_item("Axe", [5, 15], sisters, parry)  # two price rows: no default cost

        cls.skills = [Skill.objects.create(name=f"Skill {n}") for n in range(2)]
        cls.combat = SkillGroup.objects.create(name="Combat")  # the group his log names a learned skill by
        SkillGroupSkill.objects.bulk_create([SkillGroupSkill(group=cls.combat, skill=skill) for skill in cls.skills])
        cls.specials = [Special.objects.create(name=f"Special {n}", type="Ability") for n in range(2)]
        cls.spells = [Spell.objects.create(name=f"Spell {n}", type="Lesser Magic", dc="7") for n in range(2)]
        cls.large = Special.objects.create(name="Large", type="Trait")
        cls.wizard = Special.objects.create(name="Wizard", type="Trait")
        cls.priest = Special.objects.create(name="Priest", type="Trait")

    def setUp(self) -> None:
        self.client.force_authenticate(user=self.player)

    def set_thresholds(self, **values: Any) -> None:
        for name, thresholds in values.items():
            setattr(self.campaign_settings, name, thresholds)
        self.campaign_settings.save()

    def make_battle(self, scenario: str = "Bridge") -> Battle:
        return Battle.objects.create(
            campaign=self.campaign, created_by_user=self.player, scenario=scenario, status=Battle.STATUS_ENDED
        )

    def play_battle(
        self, xp_by_unit_key: dict[str, int], extra: dict[str, dict[str, Any]] | None = None
    ) -> dict[str, Any]:
        """Play and finalise a battle of `warband` against `rival` through the API; our finalise's answer.

        `xp_by_unit_key` maps our unit keys ("hero:<id>", "hireling:<id>", "henchman:<id>") to the
        XP each earns; every member of a henchmen group must earn the same. `extra` adds fields to our
        units' results (by unit key).
        """
        rival_key = f"hero:{make_unit(HERO, self.rival).id}"
        sides = ((self.player, {**xp_by_unit_key}), (self.viewer, {rival_key: 0}))
        base = f"/api/campaigns/{self.campaign.id}/battles/"
        self.client.force_authenticate(user=self.player)
        created = self.client.post(
            base, {"participant_user_ids": [self.player.id, self.viewer.id], "scenario": "Bridge"}, format="json"
        )
        self.assertEqual(created.status_code, 201, created.data)
        battle = f"{base}{created.data['battle']['id']}/"
        for user, _ in sides:
            self._battle_post(user, f"{battle}join/", {})
        for user, _ in sides:
            self._battle_post(user, f"{battle}ready/", {"ready": True})
        self._battle_post(self.player, f"{battle}start/", {})
        for user, xp in sides:
            info = {key: {"stats_override": {}, "out_of_action": False, "kill_count": 0} for key in xp}
            config = {"selected_unit_keys_json": list(xp), "unit_information_json": info, "custom_units_json": []}
            self._battle_post(user, f"{battle}config/", config)
        self._battle_post(self.player, f"{battle}finish-mine/", {"result": "won"})  # each finishes (decision 4)
        self._battle_post(self.viewer, f"{battle}finish-mine/", {"result": "lost"})
        self._battle_post(self.viewer, f"{battle}results/", {"winners": [self.warband.id]})
        answers = []
        for user, xp in sides:
            results = {
                key: {**_postbattle_result(key, earned), **(extra or {}).get(key, {})} for key, earned in xp.items()
            }
            postbattle = {"exploration": {"dice_values": [], "resource_id": None}, "unit_results": results}
            answers.append(self._battle_post(user, f"{battle}finalize-postbattle/", {"postbattle_json": postbattle}))
        self.client.force_authenticate(user=self.player)
        return answers[0]

    def _battle_post(self, user: Any, url: str, body: dict[str, Any]) -> dict[str, Any]:
        self.client.force_authenticate(user=user)
        response = self.client.post(url, body, format="json")
        self.assertIn(response.status_code, (200, 201), (url, response.data))
        answer: dict[str, Any] = response.data
        return answer


def _postbattle_result(unit_key: str, xp: int) -> dict[str, Any]:
    return {
        "unit_name": unit_key,
        "unit_kind": unit_key.split(":")[0],
        "unit_type": "Trooper",
        "group_name": "",
        "out_of_action": False,
        "kill_count": 0,
        "xp_earned": xp,
        "dead": False,
        "special_ids": [],
        "serious_injury_rolls": [],
    }


def cap_error(detail: str, code: str = "hero_cap_reached") -> dict[str, Any]:
    """The 400 body for adding a unit over the hero or hired-sword cap (decision 12)."""
    return {"detail": detail, "code": code, "fields": {}}


class ItemMoveHelpers:
    """Moving items between units and the stash (POST item-transfers/), for RosterTestCase subclasses."""

    client: Any
    warband: Warband
    sword: Item
    axe: Item

    def _transfer(self, **body: Any) -> Any:
        return self.client.post(f"/api/warbands/{self.warband.id}/item-transfers/", body, format="json")

    def _armed(self, kind: Kind, warband: Any = None, **fields: Any) -> Any:
        """A unit carrying two swords (costs 10, then 12) and an axe (cost 7)."""
        unit = make_unit(kind, warband or self.warband, **fields)
        links = getattr(unit, kind.items)
        for item, cost in ((self.sword, 10), (self.sword, 12), (self.axe, 7)):
            links.create(item=item, cost=cost)
        return unit

    def _carried(self, kind: Kind, unit: Any) -> list[tuple[int, int | None]]:
        return list(getattr(unit, kind.items).order_by("id").values_list("item_id", "cost"))
