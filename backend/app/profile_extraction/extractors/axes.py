import re


def axis_count(tail: str, rule: dict):
    match = re.fullmatch(
        r"[\s:=.·…]*(\d{1,2})(?:\s+(?:controlled\s+)?axes)?[\s.;]*", tail, re.IGNORECASE
    )
    return (int(match[1]), None) if match and int(match[1]) > 0 else None


def linear_axes(tail: str, rule: dict):
    value = re.sub(r"^[\s:=.·…]+", "", tail).strip().rstrip(".")
    if not re.fullmatch(
        r"[XYZ](?:\s*(?:[,/;&+]\s*|and\s+|\s+)[XYZ])*", value, re.IGNORECASE
    ):
        return None
    return list(dict.fromkeys(re.findall("[XYZ]", value.upper()))), None
