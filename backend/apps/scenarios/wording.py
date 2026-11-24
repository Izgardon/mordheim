"""The server's words for the scenarios' answers (apps/scenarios): the pages show them and word nothing themselves."""

PLAYERS_WORDS = {"1v1": "two warbands", "multiplayer": "three or more warbands"}


def none_fits(players: str) -> str:
    return f"No scenario on the campaign's list is for {PLAYERS_WORDS[players]} with a weight above 0."
