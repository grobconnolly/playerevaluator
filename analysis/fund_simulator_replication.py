#!/usr/bin/env python3
"""Independent replication of the FRC Fund I LP simulator.
28 names random from 3 consecutive Top-100s, $300K(2026$)/4%, era-deflated,
15-yr hard stop + discounted terminal sale, fees 2%x3+0.5%x12, LP-first then 80/20.
"""
import csv, re, sys
import random, statistics, math

DATA = "/Users/rob/Desktop/Front Row Capital/Deal_Evaluator/top-100"

# --- inflation index: $100 (2026) equivalents. From T100-Master.csv ---
IDX = {2005:58.28,2006:60.16,2007:61.87,2008:64.25,2009:64.02,2010:65.07,2011:67.12,
       2012:68.51,2013:69.51,2014:70.64,2015:70.73,2016:71.62,2017:73.14,2026:100.0}
# fill 2018-2025 and beyond by CAGR 2017->2026
c = (100.0/73.14)**(1/9)
for y in range(2018,2026): IDX[y] = IDX[y-1]*c
for y in range(2027,2050): IDX[y] = IDX[y-1]*c

def restate(amount, year):          # era $ -> 2026 $
    return amount * 100.0/IDX[year]

def money(s):
    s = s.strip().replace('"','').replace('$','').replace(',','')
    if not s: return 0.0
    try: return float(s)
    except: return 0.0

def load_cohort(year):
    """Return list of dicts: rank, name, salaries {year: $}."""
    path = f"{DATA}/T100-{year}.csv"
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        rdr = csv.reader(f)
        header = next(rdr)
        # year columns = headers that parse as 4-digit years
        ycols = {i: int(h) for i,h in enumerate(header) if re.fullmatch(r'(19|20)\d\d', h.strip())}
        for r in rdr:
            if len(r) < 3 or not r[0].strip().isdigit(): continue
            sal = {ycols[i]: money(r[i]) for i in ycols if i < len(r) and money(r[i])>0}
            rows.append(dict(rank=int(r[0]), name=r[1].strip(), sal=sal))
    return rows

def build_pool(start, lo=1, hi=100):
    """Union of start..start+2 cohorts; keep first appearance per player; rank filter per that list."""
    seen = {}
    for y in (start, start+1, start+2):
        for p in load_cohort(y):
            key = p['name'].lower()
            if key not in seen:
                seen[key] = dict(rank=p['rank'], name=p['name'], sal=p['sal'], sign=y)
    return [p for p in seen.values() if lo <= p['rank'] <= hi]

def deal_flows(p, start, stake=0.04, price2026=300_000, term_r=0.12):
    """Return dict year -> 2026$ net cash for one deal (negative=outflow)."""
    fl = {}
    sy = p['sign']
    fl[sy] = fl.get(sy,0.0) - restate(price2026 * IDX[sy]/100.0, sy)   # = -300000 by construction
    end = start + 14                       # 15-yr window inclusive
    for y, s in p['sal'].items():
        if sy <= y <= end:
            fl[y] = fl.get(y,0.0) + restate(stake*s, y)
    # terminal sale: PV at end of remaining salaries, restated
    tv = sum(stake*s / (1+term_r)**(y-end) for y,s in p['sal'].items() if y > end)
    if tv>0: fl[end] = fl.get(end,0.0) + restate(tv, end)
    return fl

def irr(years, flows):
    """Simple IRR via bisection on dated annual flows."""
    y0 = min(years)
    def npv(r): return sum(f/(1+r)**(y-y0) for y,f in zip(years,flows))
    lo_r, hi_r = -0.9, 5.0
    if npv(lo_r)*npv(hi_r) > 0: return float('nan')
    for _ in range(80):
        mid = (lo_r+hi_r)/2
        if npv(lo_r)*npv(mid) <= 0: hi_r = mid
        else: lo_r = mid
    return (lo_r+hi_r)/2

def simulate(start=2012, lo=1, hi=100, n_players=28, n_sims=10_000, seed=42,
             fund=10_000_000, commit=1_000_000, sleeve_deals=28, lemons=1.0, verbose=True):
    pool = build_pool(start, lo, hi)
    rng = random.Random(seed)
    end = start+14
    moics, irrs, best_share = [], [], []
    npool = len(pool)
    for _ in range(n_sims):
        picks = rng.sample(range(npool), min(n_players,npool))
        # portfolio collections per year (2026$)
        coll = {}; per_deal = []
        for i in picks:
            p = pool[i]
            tot = 0.0
            for y, f in deal_flows(p, start).items():
                if f > 0:
                    f *= lemons
                    coll[y] = coll.get(y,0.0) + f; tot += f
            per_deal.append(tot)
        # fund-level: fees on committed, LP-first waterfall, LP=commit/fund share
        lp_share = commit/fund
        fee = {start+k: (0.02 if k<3 else 0.005)*fund for k in range(15)}
        lp_flows = {start: -commit}
        cum_dist = 0.0
        for y in range(start, end+1):
            cash = coll.get(y,0.0) - fee.get(y,0.0)
            if cash <= 0: continue
            # return of capital first (100% to LPs pro-rata), then 80/20
            roc = max(0.0, min(cash, fund - cum_dist))
            profit = cash - roc
            lp_flows[y] = lp_flows.get(y,0.0) + lp_share*(roc + 0.80*profit)
            cum_dist += cash
        dist = sum(v for v in lp_flows.values() if v>0)
        moics.append(dist/commit)
        ys = sorted(lp_flows); irrs.append(irr(ys,[lp_flows[y] for y in ys]))
        tot_coll = sum(per_deal) or 1.0
        best_share.append(max(per_deal)/tot_coll)
    def pct(v, q):
        v = sorted(v); k = (len(v)-1)*q/100.0; f = int(k)
        return v[f] + (v[min(f+1,len(v)-1)]-v[f])*(k-f)
    ok_ir = [x for x in irrs if x==x]
    res = dict(pool=npool, med=statistics.median(moics), avg=statistics.fmean(moics),
               p10=pct(moics,10), p90=pct(moics,90), best=max(moics), worst=min(moics),
               losers=100.0*sum(1 for x in moics if x<1)/len(moics),
               med_irr=statistics.median(ok_ir)*100, avg_irr=statistics.fmean(ok_ir)*100,
               med_best_share=statistics.median(best_share)*100)
    if verbose:
        print(f"start={start} ranks {lo}-{hi} pool={npool} lemons={lemons}: "
              f"median {res['med']:.2f}x avg {res['avg']:.2f}x P10 {res['p10']:.2f}x P90 {res['p90']:.2f}x "
              f"best {res['best']:.2f}x worst {res['worst']:.2f}x losers {res['losers']:.2f}% "
              f"medIRR {res['med_irr']:.1f}% avgIRR {res['avg_irr']:.1f}% | best-deal share of collections (med) {res['med_best_share']:.0f}%")
    return res

if __name__ == "__main__":
    print("=== REPLICATION: vintage 2012, ranks 1-100 (their claim: med 7.42x avg 7.55x P10 4.92x best 16.64x 0% losers avgIRR 24.3%) ===")
    simulate(2012, 1, 100)
    print("\n=== REPLICATION: vintage 2012, ranks 25-75 (their claim: med 5.98x best 12.70x 0% losers avgIRR 22.0%) ===")
    simulate(2012, 25, 75)
    print("\n=== VINTAGE SENSITIVITY: ranks 1-100, all start years ===")
    for s in range(2005, 2015): simulate(s, 1, 100)
    print("\n=== SELECTION STRESS (2012): who actually signs? ===")
    simulate(2012, 26, 100)
    simulate(2012, 51, 100)
    print("\n=== LEMONS STRESS (2012, ranks 25-75): signers' true earnings = 70%/50% of pool draw ===")
    simulate(2012, 25, 75, lemons=0.7)
    simulate(2012, 25, 75, lemons=0.5)
