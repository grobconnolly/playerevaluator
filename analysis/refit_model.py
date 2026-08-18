#!/usr/bin/env python3
"""Full refit: 14 vintages (2001-2014), fixed 12-yr horizon, 2026$, zero-earners included.
Tweedie GLM log link; cluster-robust by player. Holdout validation on 2013-2014."""
import csv, json, re, unicodedata
import numpy as np, pandas as pd
import statsmodels.api as sm

def norm(name):
    s = unicodedata.normalize('NFD', name).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z]', '', s.lower())

IDX = {2005:58.28,2006:60.16,2007:61.87,2008:64.25,2009:64.02,2010:65.07,2011:67.12,
       2012:68.51,2013:69.51,2014:70.64,2015:70.73,2016:71.62,2017:73.14}
g_fwd = (100/73.14)**(1/9)
for y in range(2018,2027): IDX[y] = IDX[y-1]*g_fwd
g_back = (73.14/58.28)**(1/12)
for y in range(2004,1996,-1): IDX[y] = IDX[y+1]/g_back

sal = json.load(open('earnings-final.json'))
sal = {norm(k): {int(y):v for y,v in d.items()} for k,d in sal.items()}

POS_MAP = {'RHP':'RHP','LHP':'LHP','P':'RHP','C':'C','1B':'CORNER','3B':'CORNER','DH':'CORNER',
           '2B':'MIF','SS':'MIF','IF':'MIF','OF':'OF','CF':'OF','LF':'OF','RF':'OF'}
H = 12
recs = []
for r in csv.DictReader(open('/Users/rob/Desktop/Front Row Capital/Deal_Evaluator/top-100/canonical/features.csv')):
    v = int(r['vintage'])
    if not (2001 <= v <= 2014) or not r['age']: continue
    s = sal.get(norm(r['name']), {})
    y12 = sum(x * 100/IDX[min(y,2026)] for y,x in s.items() if v <= y < v+H)
    pos = POS_MAP.get(r['position'].strip().upper().split('/')[0], 'OF')
    recs.append(dict(vintage=v, player=norm(r['name']), rank=int(r['rank']),
                     age=float(r['age']), posb=pos, y=y12))
df = pd.DataFrame(recs)
print(f"n={len(df)} rows, {df.player.nunique()} unique players, zero-earners {(df.y==0).mean()*100:.1f}%")
print(f"12-yr horizon 2026$: mean ${df.y.mean()/1e6:.1f}M median ${df.y.median()/1e6:.1f}M")

def design(d):
    X = pd.DataFrame({'logranK': np.log(d['rank']), 'age': d.age})
    for p in ['C','CORNER','LHP','MIF','OF']:   # RHP = reference
        X[f'pos_{p}'] = (d.posb == p).astype(float)
    return sm.add_constant(X)

def fit(d):
    return sm.GLM(d.y, design(d), family=sm.families.Tweedie(var_power=1.6, link=sm.families.links.Log())
                 ).fit(cov_type='cluster', cov_kwds={'groups': d.player.values})

# ---- holdout validation: train 2001-2011, score 2013-2014 ----
tr, te = df[df.vintage <= 2011], df[df.vintage >= 2013]
m = fit(tr)
pred = m.predict(design(te))
# Spearman without scipy:
def spearman(a, b):
    ra, rb = pd.Series(a).rank(), pd.Series(b).rank()
    return np.corrcoef(ra, rb)[0,1]
print(f"\nHOLDOUT (train 01-11 n={len(tr)}, test 13-14 n={len(te)}):")
print(f"  Spearman(pred, realized 12-yr) = {spearman(pred.values, te.y.values):.3f}")
print(f"  mean pred ${pred.mean()/1e6:.1f}M vs realized ${te.y.mean()/1e6:.1f}M (bias ratio {pred.mean()/te.y.mean():.2f})")
by_bucket = te.assign(pred=pred.values, b=pd.cut(te['rank'], [0,10,25,50,100], labels=['1-10','11-25','26-50','51-100']), observed=True)
print("  bucket | pred mean | realized mean")
for b, g in by_bucket.groupby('b', observed=True):
    print(f"    {b:>6}: ${g.pred.mean()/1e6:6.1f}M   ${g.y.mean()/1e6:6.1f}M")

# ---- final model on all 14 vintages ----
mf = fit(df)
print("\nFINAL MODEL (2001-2014, cluster-robust by player):")
for k, b, se in zip(mf.params.index, mf.params.values, mf.bse.values):
    print(f"  {k:>10}: {b:+.4f} (se {se:.4f})")
lr = mf.params['logranK']
print(f"\nlog-rank elasticity {lr:+.3f}: #1/#100 ratio = {np.exp(-lr*np.log(100)):.2f}x  (v7: 3.58x; empirical decile ~5.7x)")
print(f"age: {(np.exp(mf.params['age'])-1)*100:+.1f}%/yr at all levels (v7: -20% to +14% by level)")
json.dump({k: float(v) for k, v in mf.params.items()},
          open('refit-coefficients.json','w'), indent=1)

# ---- dispersion for the app's Gamma machinery (positives only) ----
pos = df[df.y > 0]
mp = sm.GLM(pos.y, design(pos), family=sm.families.Gamma(link=sm.families.links.Log())).fit()
mu = mp.fittedvalues
pearson_phi = ((pos.y - mu)**2 / mu**2).sum() / (len(pos) - len(mp.params))
print(f"\nGamma dispersion among earners: phi={pearson_phi:.3f} -> shape={1/pearson_phi:.4f} (v7: phi 2.90, shape 0.345)")
print(f"P(zero | top-100) empirical = {(df.y==0).mean():.3f}")
