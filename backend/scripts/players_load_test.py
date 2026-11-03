"""Several players using the site at once (standard library only; William, 3 Nov 2026: "multiple users using the site
at the same time, editing their warband, entering a battle etc and measure if there are any drastic losses in speed").

The four demo players (`seed_demo_campaign`) sign in once each. At each level that many simulated players (one per demo
player, then several tabs each) loop through what a player does, with a pause between pages: the overview, the warband
page, edits (a resource +1 and -1, a warband rule added and deleted, the backstory saved), and the reference. From four
players up, the four of them also fight battles alongside: created, joined, picked, readied, started, out-of-action
toggles and a round, then cancelled by the creator. Every edit is undone and every battle cancelled, so the campaign
is left as it was.

It prints each level's latency by kind of request (p50, p95, max, and p50 against the one-player level) and writes the
numbers to --out. Only point it at production deliberately: it is real load on a small instance.

    DEMO_PASSWORD=... python scripts/players_load_test.py --base https://mordheim-1.onrender.com --campaign 1
"""

import argparse
import json
import os
import random
import statistics
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

EMAILS = ("captain@mordheim.test", "player2@mordheim.test", "player3@mordheim.test", "player4@mordheim.test")
GROUPS = ("overview", "warband", "edit", "reference", "battle")
RULE_TITLE = "Load test"


class Recorder:
    """Every request's time, by level, group and request, and its status (0: no answer)."""

    def __init__(self) -> None:
        self.rows: list[tuple[int, str, str, float, int]] = []
        self.lock = threading.Lock()

    def add(self, level: int, group: str, label: str, ms: float, status: int) -> None:
        with self.lock:
            self.rows.append((level, group, label, ms, status))


@dataclass
class Player:
    email: str
    token: str = ""
    user_id: int = 0
    warband_id: int = 0
    rating: int = 0
    resource_id: int = 0
    backstory: str | None = None
    unit_keys: list[str] = field(default_factory=list)


class Site:
    def __init__(self, base: str, recorder: Recorder) -> None:
        self.base, self.recorder = base.rstrip("/"), recorder
        self.level = 0

    def call(
        self, player: Player | None, method: str, path: str, body: Any = None, *, group: str = "", label: str = ""
    ) -> tuple[int, Any]:
        """The answer's status and JSON (None for none); recorded under `group` when given."""
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if player and player.token:
            request.add_header("Authorization", f"Bearer {player.token}")
        started = time.perf_counter()
        status, payload = 0, None
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status, raw = response.status, response.read()
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read()
        except (urllib.error.URLError, TimeoutError, OSError):
            raw = b""
        elapsed = (time.perf_counter() - started) * 1000
        if group:
            self.recorder.add(self.level, group, label or f"{method} {path}", elapsed, status)
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = None
        return status, payload

    def page(self, player: Player, group: str, paths: list[str]) -> None:
        """A page's requests at once, as the browser sends them, and the page's whole time."""
        started = time.perf_counter()
        with ThreadPoolExecutor(max_workers=len(paths)) as pool:
            list(pool.map(lambda path: self.call(player, "GET", path, group=group, label=_label(path)), paths))
        self.recorder.add(self.level, group, "whole page", (time.perf_counter() - started) * 1000, 200)


def _label(path: str) -> str:
    """The request with its ids as placeholders, so the same request groups across players."""
    parts = path.split("?")[0].strip("/").split("/")
    return "GET /" + "/".join("<id>" if part.isdigit() else part for part in parts) + "/"


def sign_in(site: Site, player: Player, password: str, campaign: int) -> None:
    status, body = site.call(None, "POST", "/api/auth/login/", {"email": player.email, "password": password})
    if status != 200 or not body:
        raise SystemExit(f"{player.email} could not sign in ({status}).")
    player.token, player.user_id = body["access"], body["user"]["id"]
    _, warbands = site.call(player, "GET", f"/api/warbands/?campaign_id={campaign}")
    if not warbands:
        raise SystemExit(f"{player.email} has no warband in campaign {campaign}.")
    player.warband_id, player.backstory = warbands[0]["id"], warbands[0].get("backstory")
    _, sheet = site.call(player, "GET", f"/api/warbands/{player.warband_id}/sheet/")
    summary = sheet["summary"]
    player.rating = int(summary.get("rating") or 0)
    resources = summary.get("resources") or []
    default = next((row for row in resources if row.get("is_default")), resources[0] if resources else None)
    player.resource_id = default["id"] if default else 0
    keys = [f"hero:{hero['id']}" for hero in sheet["heroes"]]
    keys += [f"hireling:{sword['id']}" for sword in sheet["hirelings"]]
    for group in sheet["henchmen_groups"]:
        keys += [f"henchman:{member['id']}" for member in group.get("henchmen", []) if not member.get("dead")]
    player.unit_keys = keys


def browse(site: Site, player: Player, campaign: int, stop: threading.Event, think: tuple[float, float]) -> None:
    """One simulated player: pages and edits until the level ends."""
    warband = f"/api/warbands/{player.warband_id}/"
    overview = [
        f"/api/campaigns/{campaign}/",
        f"/api/campaigns/{campaign}/players/",
        f"/api/campaigns/{campaign}/battles/?open=1",
        f"/api/campaigns/{campaign}/battle-history/",
        "/api/notifications/",
    ]
    reference = [f"/api/items/?campaign_id={campaign}", f"/api/skills/?campaign_id={campaign}"]

    def pause() -> None:
        stop.wait(random.uniform(*think))

    while not stop.is_set():
        site.page(player, "overview", overview)
        pause()
        site.page(player, "warband", [f"{warband}sheet/", f"{warband}items/"])
        pause()
        edit(site, player, warband)
        pause()
        site.page(player, "reference", reference)
        pause()


def edit(site: Site, player: Player, warband: str) -> None:
    if player.resource_id:
        resource = f"{warband}resources/{player.resource_id}/"
        site.call(player, "PATCH", resource, {"delta": 1}, group="edit", label="PATCH resource +1")
        site.call(player, "PATCH", resource, {"delta": -1}, group="edit", label="PATCH resource -1")
    status, rule = site.call(
        player, "POST", f"{warband}rules/", {"title": RULE_TITLE}, group="edit", label="POST warband rule"
    )
    if status == 201 and rule:
        site.call(player, "DELETE", f"{warband}rules/{rule['id']}/", group="edit", label="DELETE warband rule")
    body = {"backstory": player.backstory or ""}
    site.call(player, "PATCH", warband, body, group="edit", label="PATCH warband backstory")


class Battles:
    """The four players' battles, one at a time, each cancelled at its end (or when the level ends)."""

    def __init__(self, site: Site, players: list[Player], campaign: int) -> None:
        self.site, self.players, self.campaign = site, players, campaign
        self.open_id: int | None = None

    def post(self, player: Player, action: str, body: Any = None, label: str = "") -> int:
        path = f"/api/campaigns/{self.campaign}/battles/{self.open_id}/{action}/"
        status, _ = self.site.call(player, "POST", path, body or {}, group="battle", label=label or f"POST {action}")
        return status

    def state(self, player: Player) -> None:
        path = f"/api/campaigns/{self.campaign}/battles/{self.open_id}/state/"
        self.site.call(player, "GET", path, group="battle", label="GET state")

    def cycle(self, stop: threading.Event) -> None:
        creator, *others = self.players
        body = {
            "participant_user_ids": [player.user_id for player in others],
            "scenario": "Skirmish",
            "participant_ratings": {str(player.user_id): player.rating for player in self.players},
        }
        status, created = self.site.call(
            creator, "POST", f"/api/campaigns/{self.campaign}/battles/", body, group="battle", label="POST battle"
        )
        if status not in (200, 201) or not created:
            stop.wait(5)
            return
        self.open_id = int(created["battle"]["id"])
        try:
            for player in others:
                self.post(player, "join")
            for player in self.players:
                config = {
                    "selected_unit_keys_json": player.unit_keys,
                    "unit_information_json": {},
                    "custom_units_json": [],
                }
                self.post(player, "config", config)
            for player in self.players:
                self.post(player, "ready", {"ready": True})
            self.post(creator, "start")
            for turn in (True, False):
                for player in self.players:
                    self.state(player)
                    if player.unit_keys:
                        self.post(
                            player,
                            "unit-ooa",
                            {"unit_key": player.unit_keys[0], "out_of_action": turn},
                            "POST unit-ooa",
                        )
                if turn:
                    self.post(creator, "round", {"action": "force"})
                stop.wait(1)
        finally:
            self.cancel()
        stop.wait(2)

    def cancel(self) -> None:
        if self.open_id is not None:
            self.post(self.players[0], "cancel-battle", label="POST cancel-battle")
            self.open_id = None

    def run(self, stop: threading.Event) -> None:
        while not stop.is_set():
            self.cycle(stop)


def summarise(rows: list[tuple[int, str, str, float, int]], level: int) -> dict[str, dict[str, Any]]:
    found: dict[str, dict[str, Any]] = {}
    for group in GROUPS:
        mine = [row for row in rows if row[0] == level and row[1] == group]
        requests = [row for row in mine if row[2] != "whole page"]
        ok = sorted(row[3] for row in requests if 200 <= row[4] < 300)
        pages = sorted(row[3] for row in mine if row[2] == "whole page")
        found[group] = {
            "requests": len(requests),
            "errors": sum(1 for row in requests if not 200 <= row[4] < 300 and row[4] != 429),
            "throttled": sum(1 for row in requests if row[4] == 429),
            "p50": statistics.median(ok) if ok else 0.0,
            "p95": percentile(ok),
            "max": ok[-1] if ok else 0.0,
            "page_p95": percentile(pages) if pages else None,  # a whole page, its requests at once
        }
    return found


def percentile(times: list[float], share: float = 0.95) -> float:
    return times[max(0, int(len(times) * share) - 1)] if times else 0.0


def slowest(rows: list[tuple[int, str, str, float, int]], level: int, count: int = 5) -> list[tuple[str, float]]:
    """The requests with the highest p95 at this level, by request."""
    by_label: dict[str, list[float]] = {}
    for row in rows:
        if row[0] == level and row[2] != "whole page" and 200 <= row[4] < 300:
            by_label.setdefault(f"{row[1]}: {row[2]}", []).append(row[3])
    worst = [(label, percentile(sorted(times))) for label, times in by_label.items()]
    return sorted(worst, key=lambda entry: entry[1], reverse=True)[:count]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--campaign", type=int, required=True)
    parser.add_argument("--levels", default="1,4,8,16", help="simulated players at each level")
    parser.add_argument("--seconds", type=float, default=40)
    parser.add_argument("--think", default="0.5,1.5", help="the pause between a player's pages, in seconds")
    parser.add_argument("--out", default="players_load_test.json")
    args = parser.parse_args()
    password = os.environ.get("DEMO_PASSWORD", "")
    if not password:
        raise SystemExit("Set DEMO_PASSWORD to the demo players' password.")
    low, high = (float(value) for value in args.think.split(","))
    levels = [int(value) for value in args.levels.split(",")]

    recorder = Recorder()
    site = Site(args.base, recorder)
    players = [Player(email) for email in EMAILS]
    print(f"Signing in {len(players)} players at {args.base} (the first answer can take a while if it was asleep).")
    for player in players:
        sign_in(site, player, password, args.campaign)
    site.page(players[0], "overview", [f"/api/campaigns/{args.campaign}/"])  # warm up
    recorder.rows.clear()

    battles = Battles(site, players, args.campaign)
    results: dict[str, Any] = {"base": args.base, "seconds": args.seconds, "levels": {}}
    try:
        for level in levels:
            site.level = level
            stop = threading.Event()
            threads = [
                threading.Thread(
                    target=browse, args=(site, players[n % len(players)], args.campaign, stop, (low, high))
                )
                for n in range(level)
            ]
            if level >= len(players):
                threads.append(threading.Thread(target=battles.run, args=(stop,)))
            print(f"\n{level} player{'s' if level > 1 else ''} for {args.seconds:.0f}s...")
            for thread in threads:
                thread.start()
            time.sleep(args.seconds)
            stop.set()
            for thread in threads:
                thread.join()
            results["levels"][level] = {
                "groups": summarise(recorder.rows, level),
                "slowest": slowest(recorder.rows, level),
            }
            report(results, level, levels[0])
    finally:
        battles.cancel()
        for player in players:  # the backstories as they were
            site.call(player, "PATCH", f"/api/warbands/{player.warband_id}/", {"backstory": player.backstory or ""})
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(results, handle, indent=2)
        print(f"\nWritten to {args.out}.")


def report(results: dict[str, Any], level: int, first: int) -> None:
    groups = results["levels"][level]["groups"]
    base = results["levels"][first]["groups"]
    header = f"{'':<10}{'requests':>9}{'errors':>8}{'429':>6}{'p50 ms':>9}{'p95 ms':>9}{'max ms':>9}"
    print(f"{header}{'p50 vs first':>14}{'page p95':>10}")
    for group, row in groups.items():
        if not row["requests"]:
            continue
        ratio = f"x{row['p50'] / base[group]['p50']:.1f}" if base[group]["p50"] else "-"
        page = f"{row['page_p95']:.0f}" if row["page_p95"] is not None else ""
        print(
            f"{group:<10}{row['requests']:>9}{row['errors']:>8}{row['throttled']:>6}"
            f"{row['p50']:>9.0f}{row['p95']:>9.0f}{row['max']:>9.0f}{ratio:>14}{page:>10}"
        )
    for label, p95 in results["levels"][level]["slowest"]:
        print(f"  slowest p95: {p95:.0f} ms  {label}")


if __name__ == "__main__":
    main()
