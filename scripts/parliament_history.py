"""Build 2008-2024 Legislative Yuan seat composition from original CEC files.

Only seat counts are harmonized across terms. No voter-transfer inference and
no historical district boundary assumptions are made.
"""
import csv, json, collections, hashlib
from pathlib import Path

project = Path(__file__).resolve().parents[1]
root = project.parent / 'votedata/votedata/voteData'

TERMS = [
    dict(year=2008, term=7, election='2008-01-12', folder='2008立委',
         regional='區域', plain='平原', mountain='山原', suffix=''),
    dict(year=2012, term=8, election='2012-01-14', folder='20120114-總統及立委',
         regional='區域立委', plain='平地立委', mountain='山地立委', suffix=''),
    dict(year=2016, term=9, election='2016-01-16', folder='2016總統立委',
         regional='區域立委', plain='平地立委', mountain='山地立委', suffix='T'),
    dict(year=2020, term=10, election='2020-01-11', folder='2020總統立委',
         regional='區域立委', plain='平地立委', mountain='山地立委', suffix=''),
    dict(year=2024, term=11, election='2024-01-13', folder='2024總統立委',
         regional='區域立委', plain='平地立委', mountain='山地立委', suffix=''),
]

SHORT = {
    '中國國民黨': '國民黨',
    '民主進步黨': '民進黨',
    '台灣民眾黨': '民眾黨',
    '無黨籍及未經政黨推薦': '無黨籍',
    '時代力量': '時代力量',
    '台灣團結聯盟': '台灣團結聯盟',
    '親民黨': '親民黨',
    '無黨團結聯盟': '無黨團結聯盟',
    '台灣基進': '台灣基進',
    '新黨': '新黨',
}


def rows(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.reader(f))


def clean(value):
    return value.strip().strip("'").strip()


def build_term(spec):
    source = root / spec['folder']
    suffix = spec['suffix']

    def name(base, kind=None):
        if not suffix:
            return base + '.csv'
        code = {'regional': '1', 'plain': '2', 'mountain': '3', 'list': '4'}[kind]
        return base + '_T' + code + '.csv'

    parties = {clean(r[0]): r[1] for r in rows(source / spec['regional'] / 'elpaty.csv')}

    def party(code):
        full = parties.get(clean(code), clean(code))
        return SHORT.get(full, full)

    members = []
    systems = {}
    for key, folder, seats in [('regional', spec['regional'], 73),
                               ('plain', spec['plain'], 3),
                               ('mountain', spec['mountain'], 3)]:
        grouped = collections.Counter()
        elected = 0
        for r in rows(source / folder / name('elcand', key)):
            if len(r) < 15 or r[14].strip() not in ['*', '!']:
                continue
            grouped[party(r[7])] += 1
            elected += 1
            members.append(dict(kind=key, party=party(r[7]), name=r[6]))
        assert elected == seats, (spec['year'], key, elected, seats)
        systems[key] = dict(seats=seats, parties=[dict(party=p, seats=n) for p, n in grouped.most_common()])

    allocated = {clean(r[0]): int(r[4]) for r in rows(source / '不分區政黨' / name('elretks', 'list'))}
    assert sum(allocated.values()) == 34, (spec['year'], allocated)
    elected = collections.Counter()
    list_members = []
    for r in rows(source / '不分區政黨' / name('elrepm', 'list')):
        if len(r) < 10 or r[9].strip() not in ['*', '!']:
            continue
        elected[clean(r[0])] += 1
        list_members.append(dict(party=party(r[0]), name=r[2], rank=int(r[1])))
        members.append(dict(kind='list', party=party(r[0]), name=r[2]))
    assert all(elected[code] == seats for code, seats in allocated.items()), (spec['year'], elected, allocated)
    assert sum(elected.values()) == 34
    systems['list'] = dict(seats=34, parties=[dict(party=party(code), seats=seats) for code, seats in
                                               sorted(allocated.items(), key=lambda kv: -kv[1]) if seats])

    totals = collections.Counter(m['party'] for m in members)
    assert len(members) == 113, (spec['year'], len(members))
    by_kind = collections.Counter(m['kind'] for m in members)
    assert by_kind == {'regional': 73, 'list': 34, 'plain': 3, 'mountain': 3}, by_kind

    party_rows = []
    for p, seats in totals.most_common():
        row = dict(party=p, seats=seats)
        for key in ['regional', 'list', 'plain', 'mountain']:
            row[key] = sum(1 for m in members if m['party'] == p and m['kind'] == key)
        party_rows.append(row)

    hashes = {}
    for folder in {spec['regional'], spec['plain'], spec['mountain'], '不分區政黨'}:
        for path in (source / folder).glob('*.csv'):
            hashes[str(path.relative_to(source))] = hashlib.sha256(path.read_bytes()).hexdigest()

    return dict(year=spec['year'], term=spec['term'], election=spec['election'],
                seats=113, majority=57, parties=party_rows, systems=systems,
                counts=dict(totals), sourceFolder=spec['folder'], sourceSHA256=hashes)


def main():
    terms = [build_term(spec) for spec in TERMS]
    payload = dict(
        kind='parliament-history',
        title='立法委員席次組成 · 第7–11屆',
        version='2026-11-04',
        unit='各屆選舉當選結果，非現任名單',
        terms=terms,
        method='席次按區域73、不分區34、平地原住民3、山地原住民3分別核對，合計113席；'
               '跨屆對照是政黨席次組成變化，不是個別選民轉投或票源轉移推論。'
               '2008起均為單一選區兩票制，總席次相同；無黨籍為候選人合計類別。',
        sources=['https://db.cec.gov.tw/ElecTable',
                 'https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=159&pid=8'],
    )
    (project / 'dist/parliament-history.json').write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for t in terms:
        print(t['year'], '第%d屆' % t['term'], t['counts'])
    print('Wrote dist/parliament-history.json with', len(terms), 'terms')


if __name__ == '__main__':
    main()
