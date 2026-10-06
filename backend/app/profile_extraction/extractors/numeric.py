import re

NUMBER = r"[+\-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
LEADER = r"^[\s:=.·…]*"


def number_with_unit(tail: str, rule: dict) -> tuple[object, str | None] | None:
    tail = tail.replace("−", "-")
    aliases = rule["unit_aliases"]
    units = "|".join(re.escape(unit) for unit in sorted(aliases, key=len, reverse=True))
    # A unit printed in the same row before the number is explicit evidence too.
    pattern = rf"{LEADER}(?:\((?P<prefix>{units})\)\s*[:=.]?\s*)?(?P<first>{NUMBER})(?:\s*(?:to|–|—|-)\s*(?P<last>{NUMBER}))?\s*(?P<unit>{units})?(?![\w/])"
    match = re.match(pattern, tail, re.IGNORECASE)
    if not match or not (match["unit"] or match["prefix"]):
        return None
    if match["last"] and rule.get("range_policy") != "upper":
        return None
    # An unparsed alternative, condition, or second value remains evidence only.
    if tail[match.end() :].strip(" .;"):
        return None
    # Incomplete numbers, absent units, and a contradictory unit prefix are not normalized.
    if match["prefix"] and not match["unit"] and tail[match.end() :].strip():
        return None
    unit = (match["unit"] or match["prefix"]).casefold()
    canonical = aliases[unit]
    if match["prefix"] and aliases[match["prefix"].casefold()] != canonical:
        return None
    if match["last"]:
        first = float(match["first"].replace(",", ""))
        last = float(match["last"].replace(",", ""))
        if first > last:
            return None
    value = float((match["last"] or match["first"]).replace(",", ""))
    return (int(value) if value.is_integer() else value), canonical
