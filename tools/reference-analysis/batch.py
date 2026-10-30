"""Pick windows from the song list and write sep commands. Usage: batch.py <name> -> stdout: label:start:dur per line"""
import sys, json, numpy as np
name=sys.argv[1]; S=json.load(open(f'reports/{name}-songs2.json'))
for x in S:
    bar=240/x['bpm']; runs=x['kick_runs']; pos=0; best=None; brk=None
    for r,c in runs:
        if r=='K' and (best is None or c>best[1]): best=(pos,c)
        if r=='-' and c>=6 and pos>4 and (brk is None or c>brk[1]): brk=(pos,c)
        pos+=c
    if best and best[1]>=8:
        c=min(best[1],28); st=x['start']+(best[0]+max(0,(best[1]-c)//2))*bar
        print(f"{name}-s{x['i']:02d}:{st:.2f}:{c*bar:.2f}")
    if brk:
        c=min(brk[1],12); st=x['start']+(brk[0]+1)*bar
        print(f"{name}-s{x['i']:02d}b:{st:.2f}:{c*bar:.2f}")
