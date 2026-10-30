"""Corpus-wide statistics from corpus/*.json. Usage: aggregate.py [prefix ...]"""
import sys, json, glob, os, collections, numpy as np
pref=sys.argv[1:] or ['']
R=[]
for f in sorted(glob.glob('corpus/*.json')):
    b=os.path.basename(f)[:-5]
    if any(b.startswith(p) for p in pref): R.append((b,json.load(open(f))))
main=[(b,r) for b,r in R if not b.endswith('b')]; brk=[(b,r) for b,r in R if b.endswith('b')]
print(len(main),'main windows',len(brk),'breakdowns')
med=lambda f,S=main:float(np.median([f(r) for _,r in S]))
print('BPM',sorted(round(r['bpm'],1) for _,r in main))
print('stems med',{k:round(med(lambda r:r['stem_db'][k]),1) for k in ('drums','bass','other','vocals')},'pump',med(lambda r:r['pump_db']))
print('other poly med',med(lambda r:r['clutter']['other']['poly']),'occ',med(lambda r:r['clutter']['other']['occ']),'gaps',med(lambda r:r['clutter']['other']['gaps']),'mix gaps',med(lambda r:r['clutter']['mix_c3c7']['gaps']))
print('chord changes/bar',np.percentile([r['chg_per_bar'] for _,r in main],[10,50,90]),'loop',collections.Counter(r['loop_bars'] for _,r in main))
print('register',collections.Counter(r['register'][1] for _,r in main).most_common(8),'hi',collections.Counter(r['register'][2] for _,r in main).most_common(6),'lo',collections.Counter(r['register'][0] for _,r in main).most_common(6))
print('key',collections.Counter(r['key'] for _,r in main).most_common(24))
print('modes',collections.Counter(r['key'].split()[1] for _,r in main))
print('swing hat',collections.Counter(r['swing_ms']['hat'] for _,r in main).most_common(6))
def cell(a,thr=.4): return ''.join('x' if v>=thr else '.' for v in a)
for nm,thr in (('kick',.4),('snare',.45),('hat',.45),('bass_on',.25),('other_on',.3)):
    c=collections.Counter(cell(r[nm],thr) for _,r in main)
    print(nm,[(k,v) for k,v in c.most_common(8)])
for nm,thr in (('kick2',.4),('snare2',.45)):
    pass
# Chord loops: per-bar root (relative to tonic) at bar level
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
ROM=['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII']
def rootq(rm):
    for n in sorted(ROM,key=len,reverse=True):
        if rm.startswith(n): return n,rm[len(n):]
    return rm,''
def tonicize(r):
    # Express roots relative to the actual minor tonic when key says min, keep degree names
    seq=[rootq(x) for x in r['roman']]
    return seq
loops=collections.Counter(); quals=collections.Counter(); degs=collections.Counter()
for b,r in main:
    s=tonicize(r); rt=[x[0] for x in s if x[0]!='-']
    for x in s: quals[x[1]]+=1
    bars=[rt[i] for i in range(0,len(rt),2)]
    degs.update(bars)
    L=r['loop_bars'] or 4
    if len(bars)>=2*L:
        loop=tuple(bars[:L*2 if L<4 else L])
        # canonical rotation
        rots=[loop[i:]+loop[:i] for i in range(len(loop))]
        loops[(r['key'].split()[1],min(rots))]+=1
print('chord qualities',quals.most_common(14)); print('degree tally',degs.most_common(12))
print('loops'); 
for k,v in loops.most_common(40): print(' ',v,k[0],' '.join(k[1]))
