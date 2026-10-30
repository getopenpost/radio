"""Run htdemucs over a whole mix in chunks; keep compact stem features only.
Usage: fullsep.py <mix> <out.npz> [max_seconds]"""
import subprocess, sys, time, numpy as np, torch, librosa
from demucs.pretrained import get_model
from demucs.apply import apply_model
mix,out=sys.argv[1],sys.argv[2]; maxs=float(sys.argv[3]) if len(sys.argv)>3 else 1e9
model=get_model('htdemucs'); model.eval(); dev='mps'; model.to(dev)
SR=44100; CH=180
p=subprocess.Popen(['ffmpeg','-v','error','-i',mix,'-ac','2','-ar',str(SR),'-f','f32le','pipe:1'],stdout=subprocess.PIPE)
ri=model.sources.index
HOP=512; fps=SR/HOP; NF=4096
freqs=np.fft.rfftfreq(NF,1/SR); win=np.hanning(NF)
BANDS={'drums':[(25,140),(140,800),(800,3000),(3000,6000),(6000,14000)],'bass':[(25,70),(70,160),(160,500),(500,2000)],'other':[(100,300),(300,800),(800,2000),(2000,5000),(5000,14000)],'vocals':[(150,800),(800,3000),(3000,10000)]}
masks={k:[(freqs>=a)&(freqs<b) for a,b in v] for k,v in BANDS.items()}
ok=(freqs>=40)&(freqs<=2500)
pc=np.full(len(freqs),-1); pc[ok]=np.round(12*np.log2(freqs[ok]/261.6256)).astype(int)%12
acc={k:[] for k in BANDS}; chroma={'bass':[],'other':[]}; on={'kick':[],'snare':[],'hat':[]}; prev={}
t0=time.time(); done=0
while done<maxs:
    d=p.stdout.read(4*2*SR*CH)
    if not d: break
    x=np.frombuffer(d,dtype=np.float32).reshape(-1,2).T.copy()
    w=torch.from_numpy(x); ref=w.mean(0); m,s=ref.mean(),ref.std()+1e-6
    with torch.no_grad(): o=apply_model(model,((w-m)/s)[None],device=dev,split=True,overlap=0.1,shifts=0,progress=False)[0]
    o=(o*s+m).cpu().numpy().mean(1)
    for src in BANDS:
        y=o[ri(src)]
        idx=np.arange((len(y)-NF)//HOP+1)[:,None]*HOP+np.arange(NF)
        res=[];cr=[]; 
        for b in range(0,len(idx),2000):
            S=np.abs(np.fft.rfft(y[idx[b:b+2000]]*win,axis=1)).astype(np.float32)
            P=S**2
            res.append(np.stack([P[:,mk].sum(1) for mk in masks[src]],1))
            if src in chroma: cr.append(np.stack([P[:,pc==k].sum(1) for k in range(12)],1))
            if src=='drums':
                for nm,mk in (('kick',masks['drums'][0]),('snare',masks['drums'][2]),('hat',masks['drums'][4])):
                    e=np.log1p(np.sqrt(P[:,mk].sum(1))*5)
                    fl=np.maximum(np.diff(np.concatenate([[prev.get(nm,e[0])],e])),0); prev[nm]=e[-1]
                    on[nm].append(fl.astype(np.float16))
        acc[src].append(np.concatenate(res).astype(np.float32))
        if src in chroma: chroma[src].append(np.concatenate(cr).astype(np.float32))
    done+=x.shape[1]/SR
    print(int(done),'s elapsed',int(time.time()-t0),flush=True)
# Decimate band energies and chroma to ~10 Hz; keep onsets at 86 Hz
dec=8
out_d={}
for k,v in acc.items():
    a=np.concatenate(v); n=len(a)//dec; out_d['E_'+k]=a[:n*dec].reshape(n,dec,-1).mean(1).astype(np.float32)
for k,v in chroma.items():
    a=np.concatenate(v); n=len(a)//dec; out_d['C_'+k]=a[:n*dec].reshape(n,dec,-1).mean(1).astype(np.float32)
for k,v in on.items(): out_d['O_'+k]=np.concatenate(v)
np.savez_compressed(out,fps=fps,dec=dec,**out_d)
print('saved',out,flush=True)
