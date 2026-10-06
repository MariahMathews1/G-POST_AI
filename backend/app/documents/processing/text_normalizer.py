import unicodedata


def normalize_text(text: str) -> str:
    """Keep words, codes, punctuation, numbers, spacing and units intact."""
    text = text.replace('\r\n', '\n').replace('\r', '\n').removeprefix('\ufeff')
    text = ''.join(char for char in text if char in ('\n', '\t') or unicodedata.category(char) != 'Cc')
    return '\n'.join(line.rstrip() for line in text.split('\n')).strip('\n')


def usable_text(text: str) -> bool:
    return any(char.isalnum() for char in text)


def native_text_is_usable(text: str, minimum: int) -> bool:
    return usable_text(text) and sum(not char.isspace() for char in text) >= minimum
