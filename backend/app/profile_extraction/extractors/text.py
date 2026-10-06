import re


def labeled_text(tail: str, rule: dict):
    # Short explicit labeled values are quoted, never interpreted into a new structure.
    value = re.sub(r"^[\s:=.·…]+", "", tail).strip()
    if not 2 <= len(value) <= rule["max_value_characters"] or not any(
        c.isalnum() for c in value
    ):
        return None
    if not re.fullmatch(rule["value_pattern"], value, re.IGNORECASE):
        return None
    return value, None
