"""How a location's hero range reads, worded once on the server for the pages and the visit's warnings."""


def _heroes(count: int) -> str:
    return f"{count} hero" if count == 1 else f"{count} heroes"


def heroes_text(low: int | None, high: int | None) -> str:
    """ "1 hero", "2 heroes", "1 to 3 heroes", "1 to all heroes" or "All heroes" (None is every hero)."""
    if low is None:
        return "All heroes"
    if high is None:
        return f"{low} to all heroes"
    return _heroes(low) if low == high else f"{low} to {high} heroes"


def names_text(names: list[str]) -> str:
    """ "Aldric", "Aldric and Bruno", "Aldric, Bruno and Carl"."""
    if len(names) <= 1:
        return "".join(names)
    return f"{', '.join(names[:-1])} and {names[-1]}"
