"""How a song moves over time: per-8-bar stem levels and brightness. Usage: evolve.py <mix> <song idx>..."""
import sys, json, numpy as np
name=sys.argv[1]; S=json.load(open(f'reports/{name}-songs2.json')); d=np.load(f'decoded/{name}-full.npz')
fps=float(d['fps']); dec=int(d['dec']); ff=fps/dec
Eo,Ed,Eb,Ev=d['E_other'],d['E_drums'],d['E_bass'],d['E_vocals']
db=lambda v:10*np.log10(v+1e-10)
for i in map(int,sys.argv[2:]):
    x=S[i]; bar=240/x['bpm']
    print(f"--- {name} {i} bpm {x['bpm']} {x['key']} bars {x['bars']}")
    print('bar  kick clap  hat  sub mbas chrd high voc | otherBright(hi-lo dB)')
    for b in range(0,x['bars'],8):
        a=int((x['start']+b*bar)*ff); e=int((x['start']+(b+8)*bar)*ff)
        o=Eo[a:e].mean(0); dr=Ed[a:e].mean(0); ba=Eb[a:e].mean(0); v=Ev[a:e].mean(0)
        print(f"{b:3d} {db(dr[0]):5.0f}{db(dr[2]):5.0f}{db(dr[4]):5.0f}{db(ba[0]+ba[1]):5.0f}{db(ba[2]):5.0f}{db(o[1]+o[2]):5.0f}{db(o[3]):5.0f}{db(v[1]):5.0f} | {db(o[3])-db(o[1]):6.1f}")
