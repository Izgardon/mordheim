from typing import ClassVar

from django.test import SimpleTestCase

from catalogue_import.pipeline import build, same_name_clusters
from catalogue_import.sources import OUT


class BuildTests(SimpleTestCase):
    first: ClassVar[dict[str, str]]

    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.first = build()

    def test_two_runs_write_the_same_bytes(self) -> None:
        self.assertEqual(build(), self.first)

    def test_the_committed_files_are_up_to_date(self) -> None:
        for name, content in self.first.items():
            with self.subTest(name=name):
                written = (OUT / name).read_text(encoding="utf-8").replace("\r\n", "\n")
                self.assertEqual(written, content, f"out/{name} is stale: run build.py")

    def test_same_names_match_across_case_punctuation_and_slashes(self) -> None:
        items = [{"name": "Wolfcloak"}, {"name": "Wolf Cloak/Norse Furs"}, {"name": "Sword"}]
        self.assertEqual(same_name_clusters(items), [[0, 1]])
