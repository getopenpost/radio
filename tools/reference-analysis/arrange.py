"""Songs and per-bar arrangement from full stem features.
Usage: arrange.py <name> -> reports/<name>-songs2.json, reports/<name>-arrange.png"""
import sys, json, numpy as np, scipy.ndimage as ndi, scipy.signal as sg
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
name=sys.argv[1]
d=np.load(f'decoded/{name}-full.npz'); fps=float(d['fps']); dec=int(d['dec']); ffps=fps/dec
Ed,Eb,Eo,Ev=d['E_drums'],d['E_bass'],d['E_other'],d['E_vocals']; Cb,Co=d['C_bass'],d['C_other']
Ok,Os,Oh=[np.nan_to_num(d[k].astype(np.float32)) for k in ('O_kick','O_snare','O_hat')]
n=len(Ed); T=n/ffps
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
# 1 Hz harmonic profile from bass and other stems
N=int(n/ffps)
sec=lambda a:np.stack([a[int(i*ffps):int((i+1)*ffps)].mean(0) for i in range(N)])
Cbs,Cos=sec(Cb),sec(Co)
norm=lambda a:a/(a.sum(1,keepdims=True)+1e-12)
H=norm(Cbs)*.5+norm(Cos)*.5
# Tempo per 12 s window via kick+snare+hat onsets
sig=Ok+.5*Os+.2*Oh
def tempo_at(a,b):
    x=sig[int(a*fps):int(b*fps)]; x=x-x.mean(); L=len(x)
    if L<fps*6: return 0,0
    ac=np.fft.irfft(np.abs(np.fft.rfft(x,2*L))**2)[:L]; ac/=ac[0]+1e-9
    best=(0,0)
    for bpm in np.arange(70,140,.25):
        lag=60/bpm*fps
        sc=np.interp([lag*m for m in (1,2,4)],np.arange(L),ac).mean()+.3*np.interp(lag/2,np.arange(L),ac)
        if sc>best[1]: best=(bpm,sc)
    return best
WIN=16;HOPT=8
tt=np.arange(0,T-WIN,HOPT); tp=np.array([tempo_at(a,a+WIN) for a in tt])
# Novelty across +-L seconds on harmonic profile
L=30; cum=np.cumsum(H,0); nov=np.zeros(N)
for i in range(L,N-L):
    a=cum[i]-cum[i-L]; b=cum[i+L]-cum[i]
    nov[i]=1-a.dot(b)/(np.linalg.norm(a)*np.linalg.norm(b)+1e-12)
# Tempo novelty
tmed=ndi.median_filter(tp[:,0],5); tn=np.zeros(N)
for i in range(N):
    j=int((i-WIN/2)/HOPT); a=tmed[max(0,j-3):max(1,j)]; b=tmed[max(0,j+1):j+4]
    if len(a) and len(b): tn[i]=abs(np.median(a)-np.median(b))
score=nov+np.clip(tn/4,0,1)*.25
peaks,_=sg.find_peaks(score,distance=75,prominence=.05)
edges=[0,*peaks.tolist(),N]
segs=[dict(a=a,b=b) for a,b in zip(edges,edges[1:])]
def prof(g): return H[g['a']:g['b']].sum(0)
def bpm_of(g):
    a,b=g['a'],g['b']; idx=(tt>=a)&(tt+WIN<=b)
    if idx.sum()==0: return float(tempo_at(a,b)[0])
    return float(np.median(tp[idx,0]))
# Merge similar neighbours
changed=True
while changed:
    changed=False
    for i in range(len(segs)-1):
        p,q=prof(segs[i]),prof(segs[i+1]); c=p.dot(q)/(np.linalg.norm(p)*np.linalg.norm(q)+1e-12)
        bp,bq=bpm_of(segs[i]),bpm_of(segs[i+1])
        same_t=min(abs(bp-bq),abs(bp*1.5-bq),abs(bp-bq*1.5),abs(bp*2-bq),abs(bp-bq*2))<1.2
        if (c>.93 and same_t) or (segs[i+1]['b']-segs[i+1]['a'])<40 or (segs[i]['b']-segs[i]['a'])<40:
            segs[i]['b']=segs[i+1]['b']; del segs[i+1]; changed=True; break
MAJ=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); MINp=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
def key_of(p):
    best=(-9,None)
    for r in range(12):
        for nm,t in (('maj',MAJ),('min',MINp)):
            c=np.corrcoef(np.roll(t,r),p)[0,1]
            if c>best[0]: best=(c,f'{NAMES[r]} {nm}')
    return best
# Presence per bar per layer
def band(a,i): return a[:,i]
dbn=lambda v:10*np.log10(v+1e-10)
layers={'kick':dbn(Ed[:,0]),'clap':dbn(Ed[:,2]),'hat':dbn(Ed[:,4]),'sub':dbn(Eb[:,0]+Eb[:,1]),'midbass':dbn(Eb[:,2]),'chord':dbn(Eo[:,1]+Eo[:,2]),'high':dbn(Eo[:,3]),'voc':dbn(Ev[:,1])}
songs=[]
for i,g in enumerate(segs):
    a,b=g['a'],g['b']; bpm=bpm_of(g)
    # choose true beat: prefer the value in [100,135] if multiplicative relation shows strong kick there
    k=key_of(prof(g)); bar=240/bpm
    pres={}
    nb=int((b-a)/bar)
    for nm,l in layers.items():
        thr=np.percentile(l,92)-14 if nm in('kick','sub','chord') else np.percentile(l,92)-16
        v=[]
        for j in range(nb):
            x=l[int((a+j*bar)*ffps):int((a+(j+1)*bar)*ffps)]
            v.append(float(np.mean(x>thr)) if len(x) else 0)
        pres[nm]=v
    # Section summary: runs of same kick on/off
    kickon=(np.array(pres['kick'])>.15) if nb else np.array([])
    runs=[]
    if nb:
        s0=0
        for j in range(1,nb+1):
            if j==nb or kickon[j]!=kickon[s0]: runs.append(('K' if kickon[s0] else '-',j-s0)); s0=j
    songs.append(dict(i=i,start=a,end=b,dur=b-a,bpm=round(bpm,1),key=k[1],keyc=round(float(k[0]),2),bars=nb,kick_runs=runs,pres=pres))
json.dump(songs,open(f'reports/{name}-songs2.json','w'))
print(name,'songs',len(songs),'median dur',np.median([x['dur'] for x in songs]))
for x in songs:
    print(f"{x['i']:2d} {x['start']//60:3d}:{x['start']%60:02d} {x['dur']:4d}s {x['bpm']:6.1f} {x['key']:7s} .{int(x['keyc']*100):02d} bars {x['bars']:3d} "+' '.join(f"{r}{c}" for r,c in x['kick_runs']))
fig,ax=plt.subplots(len(songs),1,figsize=(18,len(songs)*.62+1))
ax=np.atleast_1d(ax)
for x,a in zip(songs,ax):
    M=np.array([x['pres'][k] for k in ('voc','high','chord','midbass','sub','hat','clap','kick')])
    a.imshow(M,aspect='auto',cmap='Greys',vmin=0,vmax=1,interpolation='nearest',extent=[0,x['bars'],0,8]); a.set_xlim(0,256)
    a.set_yticks([]); a.set_xticks(range(0,256,16)); a.tick_params(labelsize=5)
    a.set_ylabel(f"{x['i']} {x['bpm']}\n{x['key']}",rotation=0,fontsize=6,labelpad=22); a.grid(axis='x',lw=.2)
plt.tight_layout(pad=.2);plt.savefig(f'reports/{name}-arrange.png',dpi=70)
