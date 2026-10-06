import shutil
import subprocess
import pytesseract
from PIL import Image
from .config import ProcessingSettings

OCR_UNAVAILABLE = 'OCR is required for one or more pages but is not available in this development environment.'


class OcrFailure(Exception):
    pass


class LocalOcr:
    def __init__(self, settings: ProcessingSettings):
        self.settings = settings
        self._availability: tuple[bool, str] | None = None

    def availability(self) -> tuple[bool, str]:
        if self._availability is None:
            self._availability = self._detect()
        return self._availability

    def _detect(self) -> tuple[bool, str]:
        if not shutil.which('tesseract'):
            return False, OCR_UNAVAILABLE
        try:
            result = subprocess.run(['tesseract', '--list-langs'], capture_output=True, text=True, timeout=5, check=True)
            languages = set(result.stdout.splitlines())
            if not set(self.settings.ocr_language.split('+')) <= languages:
                return False, 'OCR is required, but the configured Tesseract language data is unavailable.'
            return True, ''
        except (OSError, subprocess.SubprocessError):
            return False, OCR_UNAVAILABLE

    def extract(self, image: Image.Image) -> str:
        try:
            return pytesseract.image_to_string(image, lang=self.settings.ocr_language,
                config=f'--dpi {self.settings.ocr_dpi}', timeout=self.settings.ocr_timeout_seconds)
        except pytesseract.TesseractNotFoundError as error:
            raise OcrFailure(OCR_UNAVAILABLE) from error
        except (pytesseract.TesseractError, OSError) as error:
            raise OcrFailure('OCR could not read this page. Check the original page and try again.') from error
        except RuntimeError as error:
            raise OcrFailure('OCR could not finish this page within the configured time limit.') from error
