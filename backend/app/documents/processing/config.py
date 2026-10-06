import os
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ProcessingSettings:
    min_native_text_characters: int = 40
    ocr_dpi: int = 200
    ocr_timeout_seconds: int = 60
    ocr_language: str = 'eng'
    max_ocr_pixels: int = 30_000_000

    def __post_init__(self):
        if min(self.min_native_text_characters, self.ocr_dpi, self.ocr_timeout_seconds, self.max_ocr_pixels) <= 0:
            raise ValueError('Document processing thresholds must be positive.')
        if not re.fullmatch(r'[A-Za-z0-9_]+(?:\+[A-Za-z0-9_]+)*', self.ocr_language):
            raise ValueError('Use Tesseract language names joined by +.')

    @classmethod
    def from_environment(cls):
        return cls(
            min_native_text_characters=int(os.environ.get('COMPANION_MIN_NATIVE_TEXT_CHARACTERS', '40')),
            ocr_dpi=int(os.environ.get('COMPANION_OCR_DPI', '200')),
            ocr_timeout_seconds=int(os.environ.get('COMPANION_OCR_TIMEOUT_SECONDS', '60')),
            ocr_language=os.environ.get('COMPANION_OCR_LANGUAGE', 'eng'),
            max_ocr_pixels=int(os.environ.get('COMPANION_MAX_OCR_PIXELS', '30000000')),
        )
