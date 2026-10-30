"""Score a rendered library against the references. Usage: audit.py <library dir>
Run after mixmetrics.py has written /tmp/audit.json for tracks/*.flac@60+120."""
import json, os, sys, collections, numpy as np
lib=sys.argv[1]
refs=json.load(open('reports/metrics-all.json')); new=json.load(open('/tmp/audit.json'))
FAM={'melodic':('Lock','Grind'),'deep':('house',),'broken':('Grind',),'slow':('slow',)}
def fam(style):
    return [v for k,v in refs.items() if 'Y2Mate' in k and any(t in k for t in FAM[style])]
BANDS=[20,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000]
rows=[]; G=collections.defaultdict(list)
for k,v in new.items():
    tid=os.path.basename(k).split('.flac')[0]; style=tid.split('-')[0]; R=fam(style)
    spec=np.array(v['spec'])-np.median([r['spec'] for r in R],axis=0)
    # Sum of band errors above 40 Hz, the broadest single measure of balance
    err=float(np.sqrt((spec[1:]**2).mean()))
    midfloor=float(np.mean(v['floor'][5:9]))
    rows.append(dict(id=tid,style=style,spec_rms=round(err,1),worst=f"{BANDS[1+int(np.abs(spec[1:]).argmax())]}Hz {spec[1:][np.abs(spec[1:]).argmax()]:+.0f}",midfloor=round(midfloor,1),rough=v['roughness'],crest=v['crest_db'],lra=v['lra_db'],above2k=v['above2k_db'],cent=v['centroid']))
    G[style].append(rows[-1])
rows.sort(key=lambda r:-r['spec_rms'])
print('id                  spec_rms worst        midfloor rough crest  lra  >2k  cent')
for r in rows[:14]: print(f"{r['id']:20s}{r['spec_rms']:7.1f}  {r['worst']:12s}{r['midfloor']:7.1f}{r['rough']:6.2f}{r['crest']:6.1f}{r['lra']:5.1f}{r['above2k']:6.1f}{r['cent']:6.0f}")
print('\nby style (median)     spec_rms midfloor rough crest lra')
for s,x in G.items():
    R=fam(s); rf=np.median([np.mean(r['floor'][5:9]) for r in R])
    print(f"{s:10s} n={len(x):3d} {np.median([r['spec_rms'] for r in x]):6.1f}{np.median([r['midfloor'] for r in x]):8.1f} (ref {rf:.1f}){np.median([r['rough'] for r in x]):6.2f} (ref {np.median([r['roughness'] for r in R]):.2f}){np.median([r['crest'] for r in x]):6.1f}{np.median([r['lra'] for r in x]):5.1f}")
