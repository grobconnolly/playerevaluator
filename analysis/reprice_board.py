#!/usr/bin/env python3
"""Reprice the 2026 board: v7 engine vs refit coefficients. Base tier, base haircut."""
import json, re, math
import numpy as np, pandas as pd

coef = json.load(open('refit-coefficients.json'))
board = json.load(open('board.json'))    # v7 run: rank,name,pos,age,level(label),mu,base1

POS_MAP = {'RHP':'RHP','LHP':'LHP','C':'C','1B':'CORNER','3B':'CORNER','DH':'CORNER',
           '2B':'MIF','SS':'MIF','OF':'OF','CF':'OF','LF':'OF','RF':'OF','TWP':'RHP'}
DUR = {'CPX/DSL/R':12.7,'A':11.2,'A+':10.2,'AA':9.2,'AAA':8.2,'MLB':7.2}
def df_time(D, r=0.12, c=0.042): return (1+r)**-D * (1+c)

def mu_new(rank, pos, age):
    x = coef['const'] + coef['logranK']*math.log(rank) + coef['age']*age
    p = POS_MAP.get(pos, 'OF')
    if p != 'RHP': x += coef[f'pos_{p}']
    return math.exp(x)

rows = []
for p in board:
    mn = mu_new(p['rank'], p['pos'], p['age'])
    D = DUR[p['level']]
    offer_new = mn * 0.01 * 0.80 * df_time(D) / 1.75
    rows.append(dict(rank=p['rank'], name=p['name'], pos=p['pos'], age=p['age'], level=p['level'],
                     mu_v7=p['mu'], mu_new=mn, off_v7=p['base1'], off_new=offer_new,
                     chg=offer_new/p['base1']-1))
d = pd.DataFrame(rows)
print(f"board totals (1% of all 100, base tier/base haircut): v7 ${d.off_v7.sum()/1e6:.2f}M -> refit ${d.off_new.sum()/1e6:.2f}M")
print(f"median 1% offer: v7 ${d.off_v7.median()/1e3:.0f}K -> refit ${d.off_new.median()/1e3:.0f}K")
print(f"\nby rank bucket (avg 1% offer):")
d['b'] = pd.cut(d['rank'], [0,10,25,50,100], labels=['1-10','11-25','26-50','51-100'])
for b, g in d.groupby('b', observed=True):
    print(f"  {b:>6}: v7 ${g.off_v7.mean()/1e3:6.1f}K -> refit ${g.off_new.mean()/1e3:6.1f}K  ({(g.off_new.mean()/g.off_v7.mean()-1)*100:+.0f}%)")
print("\nbiggest UP-reprices (v7 was underbidding):")
for _, r in d.nlargest(6, 'chg').iterrows():
    print(f"  #{r['rank']:>3} {r['name']:<22} {r['pos']:<3} {r['level']:<9} ${r.off_v7/1e3:6.1f}K -> ${r.off_new/1e3:6.1f}K ({r.chg*100:+.0f}%)")
print("biggest DOWN-reprices (v7 was overbidding):")
for _, r in d.nsmallest(6, 'chg').iterrows():
    print(f"  #{r['rank']:>3} {r['name']:<22} {r['pos']:<3} {r['level']:<9} ${r.off_v7/1e3:6.1f}K -> ${r.off_new/1e3:6.1f}K ({r.chg*100:+.0f}%)")
zaz = mu_new(36, 'RHP', 21)
print(f"\nZazueta (#36 RHP 21, AA): refit mu ${zaz/1e6:.1f}M -> 1% offer ${zaz*0.01*0.80*df_time(9.2)/1.75/1e3:.1f}K (v7: $69.0K)")
d.to_csv('/Users/rob/Desktop/Front Row Capital/Deal_Evaluator/top-100/canonical/board-reprice-2026.csv', index=False)
print("saved board-reprice-2026.csv")
