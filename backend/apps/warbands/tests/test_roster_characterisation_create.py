"""Characterisation: creating heroes, henchmen groups and hired swords (pass 1)."""

from typing import Any

from apps.campaigns.models import CampaignSettings
from apps.warbands.models import Henchman, HenchmenGroup, Hero, Hireling

from .roster_support import (
    HENCHMEN,
    HERO,
    HIRELING,
    KINDS,
    Kind,
    RosterTestCase,
    cap_error,
    create_payload,
    log_rows,
    make_unit,
    related_ids,
    trade_rows,
    unit_url,
)


class RosterCreateCharacterisationTests(RosterTestCase):
    def test_create_writes_the_unit_its_recruit_trade_and_logs(self):
        recruit = {"name": "Recruit", "type": "Trooper"}
        expected_trades = {
            HERO.key: [("Recruit", "Recruit the Trooper", -25, None)],
            HENCHMEN.key: [("Recruit", "Alpha into Recruit", -25, None)],
            HIRELING.key: [("Hire", "Recruit the Trooper", -25, None)],
        }
        expected_logs = {
            HERO.key: [("personnel", "new_hero", recruit, None)],
            HENCHMEN.key: [
                ("personnel", "new_henchmen_group", recruit, None),
                ("personnel", "new_henchman", {"name": "Alpha", "group": "Recruit"}, None),
            ],
            HIRELING.key: [("personnel", "new_hireling", recruit, None)],
        }
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.trades.all().delete()
                self.warband.logs.all().delete()

                response = self.client.post(unit_url(kind, self.warband.id), create_payload(kind), format="json")

                self.assertEqual(response.status_code, 201)
                unit = kind.model.objects.get(id=response.json()["id"])
                self.assertEqual((unit.warband_id, unit.name, unit.price), (self.warband.id, "Recruit", 25))
                self.assertEqual(trade_rows(self.warband), expected_trades[kind.key])
                self.assertEqual(log_rows(self.warband), expected_logs[kind.key])

    def test_recruit_trade_charges_the_unit_price_but_not_its_items(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.trades.all().delete()
                items = [{"id": self.sword.id}, {"id": self.axe.id, "cost": 7}, {"id": self.axe.id}, {"id": 999999}]
                response = self.client.post(
                    unit_url(kind, self.warband.id), create_payload(kind, items=items), format="json"
                )

                self.assertEqual(response.status_code, 201)
                self.assertEqual([price for _, _, price, _ in trade_rows(self.warband)], [-25])
                unit = kind.model.objects.get(id=response.json()["id"])
                rows = getattr(unit, kind.items).order_by("id")
                # a single availability fills the cost in; two availabilities leave it empty; unknown ids vanish
                self.assertEqual(
                    [(row.item_id, row.cost) for row in rows],
                    [(self.sword.id, 10), (self.axe.id, 7), (self.axe.id, None)],
                )
                self.assertCountEqual([item["cost"] for item in response.json()["items"]], [10, 7, None])

    def test_a_free_unit_writes_no_trade_but_is_still_logged(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                self.warband.trades.all().delete()
                self.warband.logs.all().delete()
                response = self.client.post(
                    unit_url(kind, self.warband.id), create_payload(kind, price=0), format="json"
                )

                self.assertEqual(response.status_code, 201)
                self.assertEqual(trade_rows(self.warband), [])
                self.assertEqual(log_rows(self.warband)[0][1], kind.log_new)

    def test_minimal_payloads(self):
        minimal: list[tuple[Kind, dict[str, Any]]] = [(HERO, {}), (HIRELING, {}), (HENCHMEN, {"henchmen": [{}]})]
        for kind, payload in minimal:
            with self.subTest(kind=kind.key):
                self.warband.logs.all().delete()
                response = self.client.post(unit_url(kind, self.warband.id), payload, format="json")

                self.assertEqual(response.status_code, 201)
                body = response.json()
                self.assertEqual((body["name"], body["unit_type"], body["price"], body["xp"]), ("", "", 0, 0.0))
                self.assertEqual(log_rows(self.warband)[0][2], {"name": "Unknown", "type": "Unknown"})
        self.assertEqual(list(Henchman.objects.values_list("name", flat=True)), [""])

    def test_invalid_payloads_are_rejected_with_field_errors_and_write_nothing(self):
        common: list[tuple[dict[str, Any], str]] = [
            ({"weapon_skill": 11}, "weapon_skill"),
            ({"leadership": -1}, "leadership"),
            ({"race": 999999}, "race"),
            ({"xp": "1.25"}, "xp"),
            ({"armour_save": "4++"}, "armour_save"),
            ({"name": ""}, "name"),  # omitted is fine (stored as ""), blank is not
            ({"unit_type": ""}, "unit_type"),
        ]
        cases = {
            HERO.key: [*common, ({"caster": "Necromancer"}, "caster")],
            HENCHMEN.key: common,
            HIRELING.key: [*common, ({"caster": "Necromancer"}, "caster")],
        }
        for kind in KINDS:
            for overrides, field in cases[kind.key]:
                with self.subTest(kind=kind.key, field=field):
                    response = self.client.post(
                        unit_url(kind, self.warband.id), create_payload(kind, **overrides), format="json"
                    )
                    self.assertEqual(response.status_code, 400)
                    self.assertEqual(list(response.json()), [field])
        self.assertFalse(any(kind.model.objects.exists() for kind in KINDS))
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))

    def test_henchmen_group_needs_at_least_one_member(self):
        payload = create_payload(HENCHMEN)
        del payload["henchmen"]
        missing = self.client.post(unit_url(HENCHMEN, self.warband.id), payload, format="json")
        empty = self.client.post(unit_url(HENCHMEN, self.warband.id), {**payload, "henchmen": []}, format="json")

        self.assertEqual((missing.status_code, missing.json()), (400, {"henchmen": ["This field is required."]}))
        self.assertEqual((empty.status_code, empty.json()), (400, {"henchmen": ["At least one henchman is required."]}))

    def test_seeded_xp_never_mints_level_ups_and_only_heroes_keep_a_seeded_level_up(self):
        # Lad's Got Talent creates the promoted hero with level_up=2; the other kinds force 0.
        expected = {HERO.key: 2, HENCHMEN.key: 0, HIRELING.key: 0}
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                plain = self.client.post(unit_url(kind, self.warband.id), create_payload(kind, xp=9), format="json")
                seeded = self.client.post(
                    unit_url(kind, self.warband.id), create_payload(kind, xp=9, level_up=2), format="json"
                )
                self.assertEqual((plain.json()["xp"], plain.json()["level_up"]), (9.0, 0))
                self.assertEqual(seeded.json()["level_up"], expected[kind.key])

    def test_a_race_from_another_campaign_is_rejected_like_an_unknown_one(self):
        # SEC-07: another campaign's race used to be accepted and read back
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                response = self.client.post(
                    unit_url(kind, self.warband.id), create_payload(kind, race=self.foreign_race.id), format="json"
                )
                message = f'Invalid pk "{self.foreign_race.id}" - object does not exist.'
                self.assertEqual((response.status_code, response.json()), (400, {"race": [message]}))
                self.assertFalse(kind.model.objects.filter(warband=self.warband).exists())

    def test_loadout_ids_keep_known_entries_only(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(
                    kind,
                    skill_ids=[self.skills[1].id, 999999],
                    special_ids=[self.specials[1].id, 999999],
                    spell_ids=[self.spells[1].id, 999999],
                )
                unit = kind.model.objects.get(
                    id=self.client.post(unit_url(kind, self.warband.id), payload, format="json").json()["id"]
                )
                self.assertEqual(related_ids(unit, kind.skills, "skill"), [self.skills[1].id])
                self.assertEqual(related_ids(unit, kind.specials, "special"), [self.specials[1].id])
                # henchmen groups have no spells: spell_ids is silently ignored
                expected_spells = [self.spells[1].id] if kind.spells else []
                self.assertEqual(related_ids(unit, kind.spells, "spell"), expected_spells)

    def test_trait_flags_add_their_specials(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(kind, large=True, caster="Wizard")
                unit = kind.model.objects.get(
                    id=self.client.post(unit_url(kind, self.warband.id), payload, format="json").json()["id"]
                )
                # henchmen have no caster field, so only Large is synced for them
                expected = [self.large.id] if kind is HENCHMEN else [self.large.id, self.wizard.id]
                self.assertEqual(related_ids(unit, kind.specials, "special"), expected)
                self.assertTrue(unit.large)

    def test_large_special_alone_sets_the_large_flag(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                payload = create_payload(kind, special_ids=[self.large.id])
                body = self.client.post(unit_url(kind, self.warband.id), payload, format="json").json()
                self.assertTrue(body["large"])

    def test_a_json_array_body_is_a_400_for_every_kind(self):
        # BUG-91: heroes used to answer 500 (the view popped a key off the list before validating)
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                response = self.client.post(unit_url(kind, self.warband.id), [{"name": "x"}], format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.json()), ["non_field_errors"])
                self.assertFalse(kind.model.objects.filter(warband=self.warband).exists())


class HeroCreateCharacterisationTests(RosterTestCase):
    def _post(self, **overrides: Any) -> Any:
        return self.client.post(unit_url(HERO, self.warband.id), create_payload(HERO, **overrides), format="json")

    def test_first_hero_becomes_leader_without_asking(self):
        response = self._post(is_leader=False)
        self.assertTrue(response.json()["is_leader"])
        self.assertTrue(Hero.objects.get(id=response.json()["id"]).is_leader)

    def test_new_leader_demotes_the_existing_leader_at_once(self):
        old = make_unit(HERO, self.warband, is_leader=True)
        response = self._post(is_leader=True)
        old.refresh_from_db()
        self.assertFalse(old.is_leader)
        self.assertEqual(
            list(Hero.objects.filter(is_leader=True).values_list("id", flat=True)), [response.json()["id"]]
        )

    def test_non_leader_hero_leaves_the_leader_alone(self):
        old = make_unit(HERO, self.warband, is_leader=True)
        response = self._post()
        self.assertFalse(response.json()["is_leader"])
        self.assertEqual(list(Hero.objects.filter(is_leader=True).values_list("id", flat=True)), [old.id])

    def test_hero_cap_counts_living_heroes_only(self):
        # BUG-29 (decision 12): dead heroes used to count towards the cap
        self.campaign_settings.max_heroes = 2
        self.campaign_settings.save()
        make_unit(HERO, self.warband, dead=True)
        make_unit(HERO, self.warband)

        self.assertEqual(self._post().status_code, 201)
        response = self._post()

        self.assertEqual((response.status_code, response.json()), (400, cap_error("Warband already has 2 heroes")))

    def test_no_client_can_skip_the_hero_cap(self):
        # BUG-29: any client could send ignore_max_heroes; it is now ignored like any unknown key
        self.campaign_settings.max_heroes = 1
        self.campaign_settings.save()
        make_unit(HERO, self.warband)
        for flag in (True, "true", "1", "yes"):
            with self.subTest(flag=flag):
                self.assertEqual(self._post(ignore_max_heroes=flag).status_code, 400)
        self.assertEqual(Hero.objects.filter(warband=self.warband).count(), 1)

    def test_hero_cap_defaults_to_six_without_campaign_settings(self):
        CampaignSettings.objects.filter(campaign=self.campaign).delete()
        for _ in range(6):
            make_unit(HERO, self.warband)
        response = self._post()
        self.assertEqual((response.status_code, response.json()), (400, cap_error("Warband already has 6 heroes")))


class HirelingCreateCharacterisationTests(RosterTestCase):
    def test_cap_counts_living_non_blood_pacted_hirelings_only(self):
        self.campaign_settings.max_hired_swords = 1
        self.campaign_settings.save()
        make_unit(HIRELING, self.warband, dead=True)
        make_unit(HIRELING, self.warband, blood_pacted=True)
        url = unit_url(HIRELING, self.warband.id)

        self.assertEqual(self.client.post(url, create_payload(HIRELING), format="json").status_code, 201)
        second = self.client.post(url, create_payload(HIRELING), format="json")
        expected = cap_error("Warband already has 1 hired swords", "hired_sword_cap_reached")
        self.assertEqual((second.status_code, second.json()), (400, expected))

    def test_hire_and_upkeep_fields_are_stored_as_sent(self):
        fields = {"hire_cost_expression": "30+2d6", "upkeep_price": 15, "upkeep_cost_expression": "15", "rating": 22}
        response = self.client.post(
            unit_url(HIRELING, self.warband.id), create_payload(HIRELING, **fields), format="json"
        )
        body = response.json()
        self.assertEqual({key: body[key] for key in fields}, fields)
        sword = Hireling.objects.get(id=body["id"])
        self.assertEqual((sword.upkeep_price, sword.rating), (15, 22))


class HenchmenCreateCharacterisationTests(RosterTestCase):
    def test_each_member_is_charged_the_group_price_under_a_group_header(self):
        payload = create_payload(
            HENCHMEN,
            unit_type="Zealots",
            price=25,
            xp=4,
            items=[{"id": self.sword.id}],
            henchmen=[{"name": "Ana"}, {"name": ""}, {"name": "Cy"}],
            item_notes="with clubs",
        )
        del payload["name"]  # an omitted name is stored as "" (a blank one is a 400)
        response = self.client.post(unit_url(HENCHMEN, self.warband.id), payload, format="json")

        self.assertEqual(response.status_code, 201)
        # members are charged in the order the DB returns them, so the children are compared sorted
        header = "Recruited 3 Zealots"
        trades = trade_rows(self.warband)
        self.assertEqual(trades[0], ("Group", header, 0, None))
        self.assertEqual(
            sorted(trades[1:]),
            [
                ("Recruit", "Ana into Zealots", -25, header),
                ("Recruit", "Cy into Zealots", -25, header),
                ("Recruit", "Unnamed Henchman into Zealots", -25, header),
            ],
        )
        self.assertEqual(
            sorted(set(self.warband.trades.exclude(action="Group").values_list("notes", flat=True))), ["with clubs"]
        )
        batch = "new_henchmen_group_batch"
        logs = log_rows(self.warband)
        self.assertEqual(
            logs[:2],
            [
                ("personnel", "new_henchmen_group", {"name": "Unknown", "type": "Zealots"}, None),
                ("personnel", batch, {"name": "Zealots", "count": 3}, None),
            ],
        )
        self.assertEqual(
            sorted(logs[2:], key=lambda row: row[2]["name"]),
            [
                ("personnel", "new_henchman", {"name": "Ana", "group": "Zealots"}, batch),
                ("personnel", "new_henchman", {"name": "Cy", "group": "Zealots"}, batch),
                ("personnel", "new_henchman", {"name": "Unnamed Henchman", "group": "Zealots"}, batch),
            ],
        )
        group = HenchmenGroup.objects.get(id=response.json()["id"])
        self.assertEqual(list(group.henchmen.order_by("id").values_list("name", flat=True)), ["Ana", "", "Cy"])

    def test_invalid_member_entries_are_rejected_before_anything_is_written(self):
        # BUG-90: these used to reach the database and return 500 after the group row was created.
        # An omitted name is still fine (stored as "", shown as "Unnamed Henchman").
        for entry in ({"name": None}, {"name": "x" * 121}):
            with self.subTest(entry=entry):
                payload = create_payload(HENCHMEN, henchmen=[entry])
                response = self.client.post(unit_url(HENCHMEN, self.warband.id), payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(list(response.json()), ["henchmen"])
        self.assertFalse(HenchmenGroup.objects.filter(warband=self.warband).exists())
        self.assertEqual((trade_rows(self.warband), log_rows(self.warband)), ([], []))
