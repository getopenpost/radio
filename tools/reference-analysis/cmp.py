"""Compare files against reference group medians. Usage: cmp.py <name=spec> ..."""
import sys, json, subprocess, numpy as np, collections
d=json.load(open('reports/metrics-all.json'))
G=collections.defaultdict(list)
for k,v in d.items():
    if 'Y2Mate' in k:
        g='REF-house' if 'house' in k else 'REF-lock' if 'Lock' in k else 'REF-grind' if 'Grind' in k else 'REF-slow'
        G[g].append(v)
args=[a.split('=',1) for a in sys.argv[1:]]
subprocess.run(['.venv/bin/python','-I','scripts/mixmetrics.py','/tmp/cmp.json']+[a[1] for a in args],check=True)
r=json.load(open('/tmp/cmp.json'))
for n,s in args: G[n].append(r[s])
keys=['centroid','below400','above2k_db','above4k_db','hf_floor_db','flatness','harm_ratio_db','roughness','crest_db','lra_db','hf_onsets_s']
print(f"{'':10s} "+' '.join(f'{k[:8]:>8s}' for k in keys))
for g in G: print(f"{g[:10]:10s} "+' '.join(f"{np.median([v[k] for v in G[g]]):8.2f}" for k in keys))
E=[20,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000]
for m in ('spec','floor','width'):
    print(m.ljust(10)+' '.join(f'{e:6d}' for e in E))
    for g in G: print(f"{g[:10]:10s}"+' '.join(f"{np.median([v[m][i] for v in G[g]]):6.1f}" for i in range(14)))
