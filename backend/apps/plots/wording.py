"""The server's words for a plot's own lines (apps/plots): the pages show them and word nothing themselves."""


def scored(points: int | None, dice: str) -> str:
    """A scoring line's number as the plot prints it: "+1", "-1", "D6", "-D3", or nothing where it says none."""
    if dice:
        return dice
    if points is None:
        return ""
    return f"+{points}" if points > 0 else str(points)
