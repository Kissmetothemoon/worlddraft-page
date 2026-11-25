import argparse
import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGIONS = ['Africa', 'Papunesia', 'Eurasia', 'North America', 'South America', 'Australia']
BENCHMARK = dict(en='eng', ja='jpn', zh='cmn', es='spa', fr='fra', de='deu', hi='hin', sr='srp',
                 ru='rus', ar='arb', sw='swh', th='tha', ko='kor', am='amh', bn='ben', te='tel')
MACRO_NAMES = {'grn':'Guarani', 'srd':'Sardinian'}

def xy(lon, lat):
    theta = math.asin(math.sqrt(3)/2 * math.sin(math.radians(float(lat))))
    a, b, c, d = 1.340264, -.081106, .000893, .003796
    x = 2*math.sqrt(3)*math.radians(float(lon))*math.cos(theta)/(3*(a+3*b*theta**2+theta**6*(7*c+9*d*theta**2)))
    y = theta*(a+theta**2*(b+theta**4*(c+d*theta**2)))
    return [round(358+x*125,1), round(172-y*125,1)]

def svg_path(points):
    return 'M'+'L'.join(f'{x:g},{y:g}' for x,y in (xy(*p[:2]) for p in points))

def read_csv(path):
    with path.open(encoding='utf8', newline='') as handle:
        return list(csv.DictReader(handle))

def read_json(path):
    return json.loads(path.read_text(encoding='utf8'))

def build(languages, values, land_path):
    rows = read_csv(languages)
    spoken = {r['Language_ID'] for r in read_csv(values) if r['Parameter_ID']=='category' and r['Code_ID']=='category-Spoken_L1_Language'}
    by_iso = {r['ISO639P3code']:r for r in rows if r['ISO639P3code']}
    atlas = [r for r in rows if r['ID'] in spoken]
    def has_point(r):
        return bool(r['Latitude'] and r['Longitude'])
    atlas.sort(key=lambda r: not has_point(r))
    dots = [xy(r['Longitude'],r['Latitude']) for r in atlas if has_point(r)]
    entries = [[r['ID'], r['Name'], r['ISO639P3code'], sum(1<<i for i,k in enumerate(REGIONS) if k in r['Macroarea'].split(';'))] for r in atlas]
    def catalogue_id(r):
        return r['ID'] if r['ID'] in spoken else r['Language_ID'] if r['Language_ID'] in spoken else None
    study = {k:xy(by_iso[v]['Longitude'],by_iso[v]['Latitude']) for k,v in BENCHMARK.items()}
    study_ids = {catalogue_id(by_iso[v]):k for k,v in BENCHMARK.items()}
    assert len(study_ids)==16 and None not in study_ids
    survey = []
    for row in read_json(ROOT/'data/survey_summary.json')['languages']:
        r = by_iso.get(row['iso'])
        name = row['name']
        if name == row['iso'].upper():
            name = r['Name'] if r else MACRO_NAMES.get(row['iso'],name)
        point = xy(r['Longitude'],r['Latitude']) if r and has_point(r) else None
        survey.append([row['flores'],name,row['tokens_per_word'],point,catalogue_id(r) if r else None])
    land = []
    for feature in read_json(land_path)['features']:
        g = feature['geometry']
        for poly in g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]:
            if max(p[1] for p in poly[0]) >= -59:
                land.extend(svg_path(ring)+'Z' for ring in poly)
    grid = ''.join(svg_path([(lon,lat) for lat in range(-62,86,3)]) for lon in range(-150,151,30))
    grid += ''.join(svg_path([(lon,lat) for lon in range(-180,181,3)]) for lat in range(-60,61,30))
    return dict(catalogue=len(atlas),mapped=len(dots),land=''.join(land),grid=grid,dots=dots,study=study,
                fertility={r['lang']:r['tw'] for r in read_json(ROOT/'data/languages.json')}, regions=REGIONS,
                entries=entries,studyIds=study_ids,survey=survey)

if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Prepare the static Equal Earth atlas from Glottolog CLDF and Natural Earth land.')
    for key in ['languages','values','land']:
        p.add_argument('--'+key,type=Path,required=True)
    a = p.parse_args()
    data = build(a.languages,a.values,a.land)
    header = '/* Glottolog 5.4 (CC BY 4.0), Natural Earth (public domain) and project data. See README.md. */\n'
    bundle = json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (ROOT/'assets/atlas-geography.js').write_text(header+'window.WorldDraftGeography='+bundle+';\n',encoding='utf8')

