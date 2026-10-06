"""Regenerate synthetic extraction reference with optional development-only ReportLab.

uv run --with reportlab python tests/fixtures/generate_extraction_fixture.py
"""

from pathlib import Path
from reportlab.pdfgen.canvas import Canvas

pdf = Path(__file__).with_name("targeted_reference.pdf")
canvas = Canvas(str(pdf))
canvas.drawString(60, 750, "Synthetic Machine Manual - acceptance reference only")
canvas.drawString(60, 720, "General reference. Not an engineering specification.")
canvas.showPage()
canvas.drawString(60, 750, "Synthetic spindle specifications")
canvas.drawString(60, 720, "Maximum spindle speed .... 4,000 min^-1")
canvas.drawString(60, 690, "X travel: 20 inches")
canvas.save()
