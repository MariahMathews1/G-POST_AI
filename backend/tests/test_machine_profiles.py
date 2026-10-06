import sqlite3
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.machine_profiles.catalog import applicable, CATALOG

MACHINE = dict(name='Worksheet test', manufacturer='Test', model='Model', machine_type='Lathe', controller='Controller', notes='')


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / 'profile.sqlite3')) as client:
        yield client


def machine(client, kind='Lathe'):
    return client.post('/api/machines', json={**MACHINE, 'machine_type': kind}).json()['id']


def profile(client, mid):
    response = client.get(f'/api/machines/{mid}/profile')
    assert response.status_code == 200
    return response.json()


def fact(p, key):
    return next(f for f in p['facts'] if f['definition']['key'] == key)


def save(client, mid, key='maximum_spindle_speed', **data):
    return client.put(f'/api/machines/{mid}/profile/facts/{key}', json=data)


def test_catalog_contract(client):
    catalog = client.get('/api/profile-definitions').json()
    assert len(catalog['definitions']) == 43
    assert [c['display_name'] for c in catalog['categories']] == ['Machine & Controller', 'Kinematics & Limits', 'Modal Rules & Commands', 'Cycles & Machine Behavior', 'Safe Start / Header / Footer']
    keys = [d['key'] for d in catalog['definitions']]
    assert len(keys) == len(set(keys))
    for d in catalog['definitions']:
        assert {'key', 'display_name', 'description', 'category', 'value_type', 'allowed_units', 'applicable_machine_types', 'normally_important', 'display_order'} <= d.keys()
        assert d['category'] in {c['key'] for c in catalog['categories']}


@pytest.mark.parametrize('kind,y,rotary', [('Lathe',False,False),('Mill',True,True),('Mill-Turn',True,True),('Swiss',False,False),('Other',False,False)])
def test_applicability(client, kind, y, rotary):
    p = profile(client, machine(client, kind))
    keys = {f['definition']['key'] for f in p['facts']}
    assert ('y_minimum' in keys) == y
    assert ('rotary_axis_definition' in keys) == rotary
    assert {'x_minimum', 'z_maximum'} <= keys
    assert all(applicable(f['definition'], kind) for f in p['facts'])


def test_inheritance_is_live_and_read_only(client):
    mid = machine(client)
    p = profile(client, mid)
    for key, value in [('machine_manufacturer','Test'),('machine_model','Model'),('machine_type','Lathe'),('controller_model','Controller')]:
        f = fact(p,key)
        assert f['value'] == value and f['source_type'] == 'MACHINE_RECORD'
        assert f['status'] is None
        assert save(client,mid,key,value='Conflicting value',status='CONFIRMED').status_code == 422
    client.put(f'/api/machines/{mid}',json={**MACHINE,'controller':'Edited controller'})
    assert fact(profile(client,mid),'controller_model')['value'] == 'Edited controller'
    with sqlite3.connect(client.app.state.database_path) as db:
        assert db.execute('SELECT count(*) FROM profile_facts').fetchone()[0] == 0


def test_manual_review_upsert_and_counts(client):
    mid = machine(client)
    initial = profile(client,mid)['summary']
    assert initial == dict(confirmed=0,needs_review=0,missing=35)
    response = save(client,mid,value=3000,unit='rpm',engineering_notes='  Reviewed manual limits  ')
    assert response.status_code == 200
    p = response.json(); f = fact(p,'maximum_spindle_speed')
    assert f['status'] == 'NEEDS_REVIEW' and f['source_type'] == 'PROGRAMMER_ENTRY'
    assert f['engineering_notes'] == 'Reviewed manual limits'
    assert p['summary'] == dict(confirmed=0,needs_review=1,missing=34)
    created = f['created_at']
    p = save(client,mid,value=3000,unit='rpm',status='CONFIRMED').json()
    assert fact(p,'maximum_spindle_speed')['status'] == 'CONFIRMED'
    assert fact(p,'maximum_spindle_speed')['created_at'] == created
    assert fact(p,'maximum_spindle_speed')['updated_at'] > created
    assert p['summary'] == dict(confirmed=1,needs_review=0,missing=34)
    p = save(client,mid,status='NOT_APPLICABLE').json()
    assert fact(p,'maximum_spindle_speed')['value'] is None
    assert p['summary'] == dict(confirmed=0,needs_review=0,missing=34)
    p = save(client,mid,status='MISSING').json()
    assert p['summary'] == initial
    with sqlite3.connect(client.app.state.database_path) as db:
        assert db.execute('SELECT count(*) FROM profile_facts WHERE machine_id=?',(mid,)).fetchone()[0] == 1


@pytest.mark.parametrize('key,data',[
    ('maximum_spindle_speed',dict(value='',unit='rpm')),
    ('maximum_spindle_speed',dict(value=None,status='CONFIRMED')),
    ('maximum_spindle_speed',dict(value=100,unit='mm')),
    ('maximum_spindle_speed',dict(value=100)),
    ('maximum_spindle_speed',dict(value=True,unit='rpm')),
    ('maximum_spindle_speed',dict(value=-5,unit='rpm')),
    ('maximum_spindle_speed',dict(value=100,unit='rpm',status='NOT_APPLICABLE')),
    ('maximum_spindle_speed',dict(value=100,unit='rpm',status='MISSING')),
    ('maximum_spindle_speed',dict(status='NOT_APPLICABLE',unit='rpm')),
    ('controller_version',dict(value={'unexpected':'structure'})),
    ('controller_version',dict(value='V1',unit='in')),
    ('controlled_axes',dict(value=1.5)),
    ('controlled_axes',dict(value=0)),
    ('supported_g_codes',dict(value='G00,G01')),
    ('supported_g_codes',dict(value=[''])),
    ('default_plane',dict(value='Unknown')),
    ('controller_version',dict(value='V1',status='AUTO_CONFIRMED')),
    ('controller_version',dict(value='V1',source_type='MACHINE_RECORD')),
])
def test_invalid_values_not_stored(client,key,data):
    mid = machine(client)
    assert save(client,mid,key,**data).status_code == 422
    assert fact(profile(client,mid),key)['status'] == 'MISSING'


def test_clean_lists_units_and_choices(client):
    mid = machine(client)
    p = save(client,mid,'supported_g_codes',value=[' G00 ', 'G01', 'G00']).json()
    assert fact(p,'supported_g_codes')['value'] == ['G00','G01']
    assert save(client,mid,'x_minimum',value=-11,unit='in').status_code == 200
    assert save(client,mid,'default_plane',value='XZ (G18)').status_code == 200


@pytest.mark.parametrize('value', [[], [{'axis':'D','minimum_angle':0,'maximum_angle':90,'continuous':True}], [{'axis':'A','minimum_angle':90,'maximum_angle':0,'continuous':False}], [{'axis':'A','minimum_angle':0,'maximum_angle':90,'continuous':'yes'}], [{'axis':'A'}], [{'axis':'A','minimum_angle':0,'maximum_angle':90,'continuous':True}]*2])
def test_invalid_rotary_axes(client,value):
    mid=machine(client,'Mill')
    assert save(client,mid,'rotary_axis_definition',value=value).status_code == 422


def test_optional_rotary_and_machine_type_changes(client):
    mid = machine(client,'Mill')
    p = profile(client,mid)
    assert p['summary']['missing'] == 36 # Optional rotary facts do not add missing requirements.
    axes=[dict(axis='A',minimum_angle=-90,maximum_angle=90,continuous=False),dict(axis='C',minimum_angle=0,maximum_angle=360,continuous=True)]
    p = save(client,mid,'rotary_axis_definition',value=axes).json()
    assert fact(p,'rotary_axis_definition')['value'] == axes
    assert p['summary']['missing'] == 36
    client.put(f'/api/machines/{mid}',json=MACHINE)
    f = fact(profile(client,mid),'rotary_axis_definition')
    assert not f['applicable'] and f['value'] == axes
    assert save(client,mid,'rotary_axis_definition',status='NOT_APPLICABLE').status_code == 200
    assert save(client,mid,'y_minimum',value=0,unit='mm').status_code == 422


def test_document_reference_and_ownership(client):
    mid = machine(client)
    doc = client.post('/api/documents',data=dict(machine_id=mid,title='Machine manual',document_type='MACHINE_MANUAL'),files={'file':('manual.txt',b'Machine-level test reference','text/plain')}).json()
    p = save(client,mid,value=3000,unit='rpm',source_document_id=doc['id'],source_location='  Page 42  ',engineering_notes='Verify operating range').json()
    f = fact(p,'maximum_spindle_speed')
    assert f['source_type'] == 'DOCUMENT_REFERENCE' and f['source_document_id'] == doc['id']
    assert f['source_location'] == 'Page 42'
    client.post(f"/api/documents/{doc['id']}/archive")
    assert save(client,mid,value=3000,unit='rpm',source_document_id=doc['id']).status_code == 200
    other=machine(client)
    assert save(client,other,value=3000,unit='rpm',source_document_id=doc['id']).status_code == 422
    assert save(client,mid,value=3000,unit='rpm',source_document_id='missing').status_code == 422
    p=save(client,mid,value=3000,unit='rpm').json()
    assert fact(p,'maximum_spindle_speed')['source_type'] == 'PROGRAMMER_ENTRY'
    assert fact(p,'maximum_spindle_speed')['source_document_id'] is None


def test_archived_machine_and_persistence(tmp_path):
    path=tmp_path/'persistent.sqlite3'
    with TestClient(create_app(path)) as c:
        mid=machine(c)
        c.post(f'/api/machines/{mid}/archive')
        assert save(c,mid,value=3000,unit='rpm',status='CONFIRMED').status_code == 200
        before=profile(c,mid)
    with TestClient(create_app(path)) as c:
        assert profile(c,mid)==before
        assert c.get(f'/api/machines/{mid}').json()['status']=='ARCHIVED'
        c.post(f'/api/machines/{mid}/restore')
        assert fact(profile(c,mid),'maximum_spindle_speed')['status']=='CONFIRMED'


def test_missing_machine_unknown_definition_and_isolation(client):
    mid=machine(client); other=machine(client)
    assert client.get('/api/machines/absent/profile').status_code==404
    assert save(client,'absent',value=10,unit='rpm').status_code==404
    assert save(client,mid,'arbitrary_field',value='No schema creation').status_code==404
    save(client,mid,value=3000,unit='rpm')
    assert fact(profile(client,other),'maximum_spindle_speed')['status']=='MISSING'
