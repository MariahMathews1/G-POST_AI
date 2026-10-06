"""Regenerate safe fixtures: uv run --with reportlab python tests/fixtures/generate_processing_fixtures.py"""
from io import BytesIO
from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium

root = Path(__file__).parent
native = root / 'native_reference.pdf'
c = canvas.Canvas(str(native), pagesize=(612, 792))
for number in (1, 2):
    c.setFont('Helvetica', 20)
    c.drawString(60, 720, f'REFERENCE TEST PAGE {number}')
    c.setFont('Helvetica', 13)
    c.drawString(60, 680, 'Generic machine reference fixture for local processing tests.')
    c.drawString(60, 650, 'Command names G17 and M03; numeric reference 12.500 mm.')
    c.drawString(60, 620, 'No production or sensitive engineering data is included.')
    c.showPage()
c.save()
with pdfium.PdfDocument(native) as pdf:
    bitmap = pdf[1].render(scale=200 / 72)
    image = bitmap.to_pil().copy()
    bitmap.close()
image_pdf = BytesIO()
image.save(image_pdf, format='PDF', resolution=200)
image.close()
image_pdf.seek(0)
scanned = PdfWriter()
scanned.append(PdfReader(image_pdf))
scanned.write(root / 'scanned_reference.pdf')
mixed = PdfWriter()
mixed.append(PdfReader(native), pages=[0])
mixed.append(PdfReader(root / 'scanned_reference.pdf'))
mixed.write(root / 'mixed_reference.pdf')
(root / 'reference.txt').write_bytes(b'REFERENCE TEST\r\nCommand names G17 and M03; numeric reference -12.500 mm.\r\n')
(root / 'reference.md').write_text('# REFERENCE TEST\n\nMachine-level fixture; 12.500 mm stays unchanged.\n')
