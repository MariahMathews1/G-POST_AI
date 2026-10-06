import sqlite3
from pathlib import Path
from threading import Event, Thread
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader, PdfWriter
from app.main import create_app
from app.core.database import connect
from app.documents.processing import pdf_text, processor, ocr
from app.documents.processing.config import ProcessingSettings
from app.documents.processing.text_normalizer import normalize_text, native_text_is_usable

FIXTURES = Path(__file__).parent / 'fixtures'
MACHINE = dict(name='Processing test', manufacturer='Test', model='Model', machine_type='Lathe', controller='Controller', notes='')


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path/'processing.sqlite3')) as client:
        yield client


def upload(client, name='native_reference.pdf', content=None):
    mid=client.post('/api/machines',json=MACHINE).json()['id']
    content=content if content is not None else (FIXTURES/name).read_bytes()
    mime='application/pdf' if name.endswith('.pdf') else 'text/plain'
    response=client.post('/api/documents', data=dict(machine_id=mid,title='Safe processing reference',document_type='MACHINE_MANUAL'),files={'file':(name,content,mime)})
    assert response.status_code==201
    return response.json()


def process(client, doc):
    response=client.post(f"/api/documents/{doc['id']}/process")
    assert response.status_code==200
    return response.json()


def pages(client, doc):
    return client.get(f"/api/documents/{doc['id']}/pages").json()


def page(client, doc, n):
    return client.get(f"/api/documents/{doc['id']}/pages/{n}").json()


def test_native_pdf_provenance_and_no_ocr(client,monkeypatch):
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:pytest.fail('Native text must not probe OCR'))
    monkeypatch.setattr(pdf_text,'render_page',lambda *a:pytest.fail('Native text must not render pages'))
    doc=upload(client)
    initial=client.get(f"/api/documents/{doc['id']}/processing").json()
    assert initial['state']=='NOT_PROCESSED' and initial['total_pages']==0
    p=process(client,doc)
    assert p['state']=='READY' and p['pages_processed']==p['native_text_pages']==p['total_pages']==2
    assert p['ocr_pages']==0 and p['pages_with_no_usable_text']==0
    assert p['processed_at']>=p['started_at']
    rows=pages(client,doc)
    assert [r['page_number'] for r in rows]==[1,2]
    assert all('text' not in r for r in rows)
    for n in (1,2):
        value=page(client,doc,n)
        assert f'REFERENCE TEST PAGE {n}' in value['text']
        assert 'G17 and M03' in value['text'] and '12.500 mm' in value['text']
        assert value['document_id']==doc['id'] and value['processing_method']=='NATIVE_TEXT'
        assert value['character_count']==len(value['text']) and value['error_message'] is None
        assert value['created_at']==value['updated_at']==p['processed_at']
    assert client.get(f"/api/documents/{doc['id']}/file").content==(FIXTURES/'native_reference.pdf').read_bytes()
    assert client.get(f"/api/documents/{doc['id']}/file?download=true").content==(FIXTURES/'native_reference.pdf').read_bytes()


@pytest.mark.parametrize('name',['reference.txt','reference.md'])
def test_text_formats(client,name,monkeypatch):
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:pytest.fail('Plain text must not probe OCR'))
    doc=upload(client,name)
    p=process(client,doc)
    assert p['state']=='READY' and p['plain_text_pages']==1 and p['total_pages']==1
    assert page(client,doc,1)['processing_method']=='PLAIN_TEXT'
    text=page(client,doc,1)['text']
    assert '12.500 mm' in text and '\r' not in text
    if name.endswith('.md'):assert text.startswith('# REFERENCE TEST')


def test_reprocessing_and_profile_isolation(client):
    doc=upload(client)
    original=(client.app.state.document_storage/doc['storage_key']).read_bytes()
    profile_before=client.get(f"/api/machines/{doc['machine_id']}/profile").json()
    first=process(client,doc); ids={p['id'] for p in pages(client,doc)}
    second=process(client,doc)
    assert second['state']=='READY' and second['pages_processed']==2
    assert len(pages(client,doc))==2 and ids.isdisjoint({p['id'] for p in pages(client,doc)})
    assert second['processed_at']>first['processed_at']
    assert (client.app.state.document_storage/doc['storage_key']).read_bytes()==original
    assert client.get(f"/api/machines/{doc['machine_id']}/profile").json()==profile_before
    # A failed new attempt replaces old results, never presents stale text as a success.
    (client.app.state.document_storage/doc['storage_key']).unlink()
    assert process(client,doc)['state']=='FAILED'
    assert pages(client,doc)==[]


@pytest.mark.parametrize('name,expected', [('mixed_reference.pdf','PARTIAL'),('scanned_reference.pdf','FAILED')])
def test_ocr_unavailable(client,monkeypatch,name,expected):
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:(False,ocr.OCR_UNAVAILABLE))
    doc=upload(client,name)
    p=process(client,doc)
    assert p['state']==expected and 'OCR is required' in p['message']
    assert p['pages_with_no_usable_text']==1 and p['ocr_pages']==0
    value=page(client,doc,2 if expected=='PARTIAL' else 1)
    assert value['text']=='' and value['error_message']==ocr.OCR_UNAVAILABLE
    assert value['processing_method']=='OCR'
    if expected=='PARTIAL':assert p['native_text_pages']==p['pages_processed']==1


def test_scanned_fallback_renders_only_required_page(client,monkeypatch):
    calls=[]
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:(True,''))
    def extract(self,image):
        assert isinstance(image,Image.Image) and image.width>1000
        calls.append(image.size)
        return 'REFERENCE TEST PAGE 2\r\nLocal image-only fixture.'
    monkeypatch.setattr(ocr.LocalOcr,'extract',extract)
    doc=upload(client,'mixed_reference.pdf')
    p=process(client,doc)
    assert p['state']=='READY' and p['ocr_pages']==p['native_text_pages']==1
    assert len(calls)==1 and page(client,doc,2)['text'].startswith('REFERENCE TEST PAGE 2\n')


def test_real_local_ocr_when_available(client):
    available,message=ocr.LocalOcr(ProcessingSettings()).availability()
    if not available:pytest.skip(message)
    doc=upload(client,'scanned_reference.pdf')
    p=process(client,doc)
    assert p['state']=='READY' and p['ocr_pages']==1
    assert 'REFERENCE TEST PAGE 2' in page(client,doc,1)['text']


@pytest.mark.parametrize('failure',['empty','timeout','render'])
def test_per_page_failure(client,monkeypatch,failure):
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:(True,''))
    if failure=='render':
        def fail(*args):raise pdf_text.PdfFailure('This PDF page could not be rendered for OCR.')
        monkeypatch.setattr(pdf_text,'render_page',fail)
    else:
        def extract(self,image):
            if failure=='timeout':raise ocr.OcrFailure('OCR could not finish this page within the configured time limit.')
            return ' \n\t'
        monkeypatch.setattr(ocr.LocalOcr,'extract',extract)
    doc=upload(client,'mixed_reference.pdf')
    p=process(client,doc)
    assert p['state']=='PARTIAL' and p['pages_processed']==1
    assert page(client,doc,2)['error_message'] and page(client,doc,2)['text']==''


def test_native_failure_can_fall_back_to_ocr(client,monkeypatch):
    def fail(*args):raise ValueError('sensitive implementation details')
    monkeypatch.setattr(pdf_text,'native_text',fail)
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:(True,''))
    monkeypatch.setattr(ocr.LocalOcr,'extract',lambda self,image:'Recovered local text from page image')
    doc=upload(client)
    p=process(client,doc)
    assert p['state']=='READY' and p['ocr_pages']==2
    assert 'sensitive' not in str(p)


@pytest.mark.parametrize('content',[b'%PDF-1.7\nnot a valid PDF',b'%PDF-1.4\n%%EOF'])
def test_corrupt_pdf(client,content):
    doc=upload(client,content=content)
    p=process(client,doc)
    assert p['state']=='FAILED' and 'damaged or unreadable' in p['message']
    assert pages(client,doc)==[]


def test_encrypted_pdf(client,tmp_path):
    writer=PdfWriter();writer.append(PdfReader(FIXTURES/'native_reference.pdf'));writer.encrypt('test-only-password')
    target=tmp_path/'encrypted.pdf';writer.write(target)
    doc=upload(client,content=target.read_bytes())
    p=process(client,doc)
    assert p['state']=='FAILED' and 'encrypted' in p['message']
    assert pages(client,doc)==[]


@pytest.mark.parametrize('content',[b' \r\n\t',b'\x00',b'\xffbad encoding',b'\x01'*50])
def test_unusable_text(client,content):
    doc=upload(client,'empty.txt',content)
    p=process(client,doc)
    assert p['state']=='FAILED' and p['pages_processed']==0 and p['message']
    assert 'Traceback' not in p['message']


def test_utf16_with_bom(client):
    doc=upload(client,'reference.txt','Machine-level reference 12.500 mm'.encode('utf-16'))
    assert process(client,doc)['state']=='READY'
    assert page(client,doc,1)['text']=='Machine-level reference 12.500 mm'


def test_missing_and_unapproved_type(client,monkeypatch):
    for path in ['/processing','/process','/pages','/pages/1']:
        response=client.post('/api/documents/missing'+path) if path=='/process' else client.get('/api/documents/missing'+path)
        assert response.status_code==404
    doc=upload(client)
    assert client.get(f"/api/documents/{doc['id']}/pages/0").status_code==422
    assert client.get(f"/api/documents/{doc['id']}/pages/99").status_code==404
    get_document = processor.get_document
    def unsupported(db, document_id):
        result = get_document(db, document_id)
        result.file_type = 'NC'
        return result
    monkeypatch.setattr(processor, 'get_document', unsupported)
    p=process(client,doc)
    assert p['state']=='FAILED' and 'Only PDF, TXT, and MD' in p['message']


def test_processing_claim_and_observable_state(client,monkeypatch):
    doc=upload(client)
    entered=Event();release=Event();responses=[]
    actual=processor.process_pdf
    def blocked(path,settings):
        entered.set();assert release.wait(5)
        return actual(path,settings)
    monkeypatch.setattr(processor,'process_pdf',blocked)
    thread=Thread(target=lambda:responses.append(client.post(f"/api/documents/{doc['id']}/process")))
    thread.start()
    try:
        assert entered.wait(5)
        assert client.get(f"/api/documents/{doc['id']}/processing").json()['state']=='PROCESSING'
        second=client.post(f"/api/documents/{doc['id']}/process")
        assert second.status_code==409 and 'already being prepared' in second.json()['detail']
    finally:
        release.set();thread.join(5)
    assert responses[0].json()['state']=='READY'


def test_persistence_archive_and_interrupted_recovery(tmp_path):
    path=tmp_path/'persistent.sqlite3'
    with TestClient(create_app(path)) as c:
        doc=upload(c)
        before=process(c,doc); text=page(c,doc,2)
        c.post(f"/api/documents/{doc['id']}/archive")
        assert process(c,doc)['state']=='READY'
        before=c.get(f"/api/documents/{doc['id']}/processing").json();text=page(c,doc,2)
    with TestClient(create_app(path)) as c:
        assert c.get(f"/api/documents/{doc['id']}/processing").json()==before
        assert page(c,doc,2)==text
    with connect(path) as db:
        db.execute("UPDATE document_processing SET state='PROCESSING',processed_at=NULL WHERE document_id=?",(doc['id'],))
    with TestClient(create_app(path)) as c:
        recovered=c.get(f"/api/documents/{doc['id']}/processing").json()
        assert recovered['state']=='PARTIAL' and 'interrupted' in recovered['message']
        assert page(c,doc,2)==text
        assert process(c,doc)['state']=='READY'


def test_atomic_replacement_failure_preserves_previous_pages(client,monkeypatch):
    doc=upload(client);process(client,doc); before=pages(client,doc)
    monkeypatch.setattr(processor,'process_pdf',lambda *args:[processor.PageResult(1,'Text','INVALID_METHOD')])
    assert client.post(f"/api/documents/{doc['id']}/process").status_code==503
    assert pages(client,doc)==before


def test_normalization_and_threshold_settings():
    assert normalize_text('\ufeffG17\r\nM03\x00  -12.500\tmm\x0c\n')=='G17\nM03  -12.500\tmm'
    assert not native_text_is_usable('  \n ...  ',1)
    assert native_text_is_usable('A B C',3) and not native_text_is_usable('A B C',4)
    with pytest.raises(ValueError):ProcessingSettings(min_native_text_characters=0)


def test_configurable_native_threshold(client,monkeypatch):
    doc=upload(client)
    monkeypatch.setattr(pdf_text,'native_text',lambda *args:'Short text')
    monkeypatch.setattr(ocr.LocalOcr,'availability',lambda self:(False,ocr.OCR_UNAVAILABLE))
    client.app.state.processing_settings=ProcessingSettings(min_native_text_characters=1)
    assert process(client,doc)['state']=='READY'
    client.app.state.processing_settings=ProcessingSettings(min_native_text_characters=40)
    assert process(client,doc)['state']=='FAILED'


def test_ocr_runtime_detection_and_timeout_messages(monkeypatch):
    monkeypatch.setattr(ocr.shutil,'which',lambda name:None)
    assert not ocr.LocalOcr(ProcessingSettings()).availability()[0]
    def timeout(*args,**kwargs):raise RuntimeError('raw timeout')
    monkeypatch.setattr(ocr.pytesseract,'image_to_string',timeout)
    with Image.new('RGB',(10,10)) as image:
        with pytest.raises(ocr.OcrFailure,match='time limit'):ocr.LocalOcr(ProcessingSettings()).extract(image)
    def error(*args,**kwargs):raise ocr.pytesseract.TesseractError(1,'raw secret')
    monkeypatch.setattr(ocr.pytesseract,'image_to_string',error)
    with Image.new('RGB',(10,10)) as image:
        with pytest.raises(ocr.OcrFailure,match='could not read'):ocr.LocalOcr(ProcessingSettings()).extract(image)
