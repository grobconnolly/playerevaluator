#!/usr/bin/env python3
"""Reconcile local T100-*.csv (July pull) against top-100/gsheet/*.csv (today's pull).
Outputs: per-vintage join stats, career-total disputes, cross-vintage salary conflicts."""
import csv, re, json, unicodedata
from collections import defaultdict

BASE = "/Users/rob/Desktop/Front Row Capital/Deal_Evaluator/top-100"

def norm(name):
    s = unicodedata.normalize('NFD', name).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z]', '', s.lower())

def money(x):
    x = (x or '').replace('$','').replace(',','').replace('"','').strip()
    if not x or x in ('-','\\',): return None
    try: return float(x)
    except: return None

def load_local(year):
    try: rows = list(csv.reader(open(f"{BASE}/T100-{year}.csv", encoding='utf-8-sig')))
    except FileNotFoundError: return None
    hdr = rows[0]
    ycols = {i:int(h) for i,h in enumerate(hdr) if re.fullmatch(r'(19|20)\d\d', h.strip())}
    tot_i = next((i for i,h in enumerate(hdr) if h.strip() in ('Total','Career Earnings')), len(hdr)-1)
    out = {}
    for r in rows[1:]:
        if not r or not r[0].strip().isdigit(): continue
        sal = {ycols[i]: money(r[i]) for i in ycols if i < len(r) and money(r[i])}
        out[norm(r[1])] = dict(rank=int(r[0]), name=r[1].strip(),
                               total=money(r[tot_i]) if tot_i < len(r) else None, sal=sal)
    return out

def load_gsheet(year):
    try: rows = list(csv.reader(open(f"{BASE}/gsheet/{year}.csv")))
    except FileNotFoundError: return None
    hdr = rows[0]
    ycols = {i:int(h) for i,h in enumerate(hdr) if re.fullmatch(r'(19|20)\d\d', h.strip())}
    tot_i = next((i for i,h in enumerate(hdr) if h.strip() in ('Career','Career Earnings','Total')), None)
    out = {}
    for r in rows[1:]:
        if not r or not r[0].strip().isdigit(): continue
        # handle split first/last name (2011-style blocks shouldn't appear in year tabs, but guard)
        nm = r[1].strip()
        sal = {ycols[i]: money(r[i]) for i in ycols if i < len(r) and money(r[i])}
        out[norm(nm)] = dict(rank=int(r[0]), name=nm,
                             total=money(r[tot_i]) if tot_i and tot_i < len(r) else None, sal=sal)
    return out

report = {'vintages': {}, 'disputes': [], 'cross_vintage': []}
for y in range(2001, 2018):
    L, G = load_local(y), load_gsheet(y)
    if G is None: continue
    st = {'gsheet_rows': len(G)}
    if L:
        both = set(L) & set(G)
        st.update(local_rows=len(L), matched=len(both),
                  local_only=sorted(L[k]['name'] for k in set(L)-set(G) if (L[k]['total'] or 0) > 1000),
                  gsheet_only=sorted(G[k]['name'] for k in set(G)-set(L)))
        for k in both:
            lt, gt = L[k]['total'], G[k]['total']
            if lt is not None and gt is not None and abs(lt-gt) > 1000:
                report['disputes'].append(dict(vintage=y, name=L[k]['name'], rank=L[k]['rank'],
                                               local=round(lt), gsheet=round(gt), gap=round(abs(lt-gt))))
            # rank agreement
            if L[k]['rank'] != G[k]['rank']:
                st.setdefault('rank_mismatch', []).append(f"{L[k]['name']} L#{L[k]['rank']} vs G#{G[k]['rank']}")
    report['vintages'][y] = st

# cross-vintage salary conflicts WITHIN the gsheet (same player, same year, different $)
series = defaultdict(dict)   # norm -> {year: {vintage: $}}
names = {}
for y in range(2001, 2018):
    G = load_gsheet(y)
    if not G: continue
    for k, v in G.items():
        names[k] = v['name']
        for yr, s in v['sal'].items():
            series[k].setdefault(yr, {})[y] = s
for k, yrs in series.items():
    for yr, by_v in yrs.items():
        vals = set(round(v) for v in by_v.values())
        if len(vals) > 1 and max(vals)-min(vals) > 1000:
            report['cross_vintage'].append(dict(player=names[k], year=yr,
                values={str(v): round(s) for v,s in by_v.items()}, spread=max(vals)-min(vals)))

report['disputes'].sort(key=lambda d: -d['gap'])
report['cross_vintage'].sort(key=lambda d: -d['spread'])
json.dump(report, open('/private/tmp/claude-501/-Users-rob-Desktop-Front-Row-Capital-Deal-Evaluator/6b2272ee-b8e9-4dd8-b032-bc0133038a59/scratchpad/recon.json','w'), indent=1)

print("=== per-vintage join ===")
for y, st in report['vintages'].items():
    lo = st.get('local_only', []); rm = st.get('rank_mismatch', [])
    print(f"{y}: gsheet {st['gsheet_rows']} rows" +
          (f", local {st['local_rows']}, matched {st['matched']}, local-only-with-$ {len(lo)}, rank-mismatch {len(rm)}" if 'local_rows' in st else " (no local file)"))
print(f"\n=== career-total disputes >$1k: {len(report['disputes'])} ===")
for d in report['disputes'][:15]:
    print(f"  {d['vintage']} #{d['rank']} {d['name']}: local ${d['local']:,} vs gsheet ${d['gsheet']:,} (gap ${d['gap']:,})")
print(f"\n=== cross-vintage salary conflicts in gsheet: {len(report['cross_vintage'])} ===")
for d in report['cross_vintage'][:10]:
    print(f"  {d['player']} {d['year']}: {d['values']} (spread ${d['spread']:,})")
