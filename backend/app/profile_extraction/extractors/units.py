import re


def programming_units(tail: str, rule: dict):
    tail = re.sub(r"^[\s:=.·…]+", "", tail).strip()
    if len(tail) > 100:
        return None
    # Accept only explicit choice words/separators, not incidental unit mentions in prose.
    aliases = {
        alias.casefold(): choice
        for choice, items in rule["choices"].items()
        for alias in items
    }
    words = re.findall(r"[A-Za-z]+", tail)
    if any(
        word.casefold() not in aliases and word.casefold() not in ("and", "or", "both")
        for word in words
    ):
        return None
    found = {aliases[word.casefold()] for word in words if word.casefold() in aliases}
    if not found:
        return None
    return ("Both" if len(found) == 2 else next(iter(found))), None
