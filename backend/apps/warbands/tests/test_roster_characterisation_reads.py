"""Characterisation: which units the roster read endpoints return, per kind (pass 1)."""

from django.urls import reverse

from apps.warbands.models import Henchman

from .roster_support import HENCHMEN, KINDS, RosterTestCase, make_unit, unit_url


class RosterListCharacterisationTests(RosterTestCase):
    def test_summary_and_detail_lists_return_living_units_ordered_by_id(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                second = make_unit(kind, self.warband, name="Second")
                make_unit(kind, self.warband, name="Fallen", dead=True)
                first = make_unit(kind, self.warband, name="First")
                make_unit(kind, self.rival, name="Not ours")
                # ids, not names: the lists are ordered by id, so "Second" (created first) leads
                expected = [second.id, first.id]
                for suffix in ("", "detail/"):
                    response = self.client.get(unit_url(kind, self.warband.id, suffix=suffix))
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual([row["id"] for row in response.json()], expected)

    def test_empty_roster_lists_are_empty(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                for suffix in ("", "detail/"):
                    response = self.client.get(unit_url(kind, self.warband.id, suffix=suffix))
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json(), [])

    def test_single_unit_get_returns_living_unit_only(self):
        for kind in KINDS:
            with self.subTest(kind=kind.key):
                living = make_unit(kind, self.warband)
                dead = make_unit(kind, self.warband, dead=True)
                foreign = make_unit(kind, self.rival)

                response = self.client.get(unit_url(kind, self.warband.id, living.id))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["id"], living.id)

                for unit_id in (dead.id, foreign.id, 999999):
                    response = self.client.get(unit_url(kind, self.warband.id, unit_id))
                    self.assertEqual(response.status_code, 404)
                    self.assertEqual(response.json(), {"detail": "Not found"})

    def test_unknown_warband_is_404_on_every_read(self):
        for kind in KINDS:
            unit = make_unit(kind, self.warband)
            for url in (
                unit_url(kind, 999999),
                unit_url(kind, 999999, suffix="detail/"),
                unit_url(kind, 999999, unit.id),
                unit_url(kind, 999999, unit.id, "kill-history/"),
            ):
                with self.subTest(kind=kind.key, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 404)
                    self.assertEqual(response.json(), {"detail": "Not found"})

    def test_henchmen_reads_list_only_living_members_by_id(self):
        group = make_unit(HENCHMEN, self.warband, members=("Alpha",))
        Henchman.objects.create(group=group, name="Fallen", dead=True, kills=3)
        Henchman.objects.create(group=group, name="Gamma")
        for url in (
            unit_url(HENCHMEN, self.warband.id),
            unit_url(HENCHMEN, self.warband.id, suffix="detail/"),
            unit_url(HENCHMEN, self.warband.id, group.id),
        ):
            with self.subTest(url=url):
                body = self.client.get(url).json()
                row = body[0] if isinstance(body, list) else body
                self.assertEqual([member["name"] for member in row["henchmen"]], ["Alpha", "Gamma"])
                self.assertTrue(all(member["dead"] is False for member in row["henchmen"]))

    def test_group_whose_members_are_all_dead_is_still_listed_while_not_flagged_dead(self):
        group = make_unit(HENCHMEN, self.warband, members=())
        Henchman.objects.create(group=group, name="Fallen", dead=True)

        body = self.client.get(unit_url(HENCHMEN, self.warband.id)).json()

        self.assertEqual([row["id"] for row in body], [group.id])
        self.assertEqual(body[0]["henchmen"], [])
        self.assertFalse(body[0]["dead"])

    def test_dead_units_are_left_out_of_the_warband_summary_lists(self):
        living = {kind.key: make_unit(kind, self.warband, name=f"Living {kind.key}") for kind in KINDS}
        for kind in KINDS:
            make_unit(kind, self.warband, name=f"Dead {kind.key}", dead=True)

        body = self.client.get(f"/api/warbands/{self.warband.id}/summary/").json()

        for kind, key in zip(KINDS, ("heroes", "henchmen_groups", "hirelings"), strict=True):
            with self.subTest(kind=kind.key):
                self.assertEqual([row["id"] for row in body[key]], [living[kind.key].id])


class RosterUrlCharacterisationTests(RosterTestCase):
    def test_unit_url_names_reverse_to_todays_paths(self):
        warband = self.warband.id
        expected: dict[tuple[str, tuple[str, ...]], str] = {}
        for segment, kwarg in (
            ("heroes", "hero_id"),
            ("henchmen-groups", "group_id"),
            ("hirelings", "hireling_id"),
        ):
            base = f"/api/warbands/{warband}/{segment}/"
            expected[(f"warbands-{segment}", ())] = base
            expected[(f"warbands-{segment}-detail-list", ())] = f"{base}detail/"
            expected[(f"warbands-{segment}-detail", (kwarg,))] = f"{base}7/"
            expected[(f"warbands-{segment}-kill-history", (kwarg,))] = f"{base}7/kill-history/"
            expected[(f"warbands-{segment}-level-up", (kwarg,))] = f"{base}7/level-up/"

        self.assertEqual(len(expected), 15)
        for (name, unit_kwargs), path in expected.items():
            with self.subTest(name=name):
                kwargs = {"warband_id": warband, **dict.fromkeys(unit_kwargs, 7)}
                self.assertEqual(reverse(name, kwargs=kwargs), path)
