"""Who a who-can list is for, in the server's words (`access_lines.who_text`): the store's item details show it when
the row is for anyone less than everyone (William, 22 Nov 2026)."""

from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.warbands.access_lines import who_text


def line(name: str, *, excluded: bool = False, group: bool = False, code: str = "") -> SimpleNamespace:
    named = SimpleNamespace(name=name, source_code=code)
    if group:
        return SimpleNamespace(warband_type_id=None, warband_type=None, warband_group=named, excluded=excluded)
    return SimpleNamespace(warband_type_id=1, warband_type=named, warband_group=None, excluded=excluded)


class WhoTextTests(SimpleTestCase):
    def test_a_row_for_everyone_says_nothing(self) -> None:
        self.assertEqual(who_text(True, []), "")

    def test_a_row_for_everyone_but_some_names_them(self) -> None:
        self.assertEqual(who_text(True, [line("Dark Elves", excluded=True)]), "Not available for Dark Elves.")

    def test_a_row_naming_warbands_lists_them(self) -> None:
        lines = [line("Skaven", group=True), line("Lizardmen"), line("Orcs & Goblins")]
        self.assertEqual(who_text(False, lines), "For Skaven, Lizardmen and Orcs & Goblins.")

    def test_a_row_naming_a_group_less_a_type_says_both(self) -> None:
        lines = [line("Humans", group=True), line("Witch Hunters", excluded=True)]
        self.assertEqual(who_text(False, lines), "For Humans, except Witch Hunters.")

    def test_two_types_of_one_name_are_told_apart_by_their_source(self) -> None:
        lines = [line("Norse Explorers", code="BTB"), line("Norse Explorers", code="TC13")]
        self.assertEqual(who_text(False, lines), "For Norse Explorers (BTB) and Norse Explorers (TC13).")

    def test_a_row_for_nobody_says_so(self) -> None:
        self.assertEqual(who_text(False, []), "Not available for any warband.")
