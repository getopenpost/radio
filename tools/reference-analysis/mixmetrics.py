"""Perceptual mix metrics. Usage: mixmetrics.py <out.json> <path[@start+dur]> ...  (parallel)"""
import sys, json, re, subprocess, numpy as np, scipy.signal as sg, scipy.ndimage as ndi
from multiprocessing import Pool
SR=44100
def load(spec):
    m=re.match(r'^(.*?)(?:@(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?))?$',spec); path,st,du=m.groups()
    cmd=['ffmpeg','-v','error']+(['-ss',st,'-t',du] if st else [])+['-i',path,'-ac','2','-ar',str(SR),'-f','f32le','pipe:1']
    r=subprocess.run(cmd,stdout=subprocess.PIPE).stdout
    return np.frombuffer(r,dtype=np.float32).reshape(-1,2).T
def pl(f1,a1,f2,a2):
    s=0.24/(0.0207*np.minimum(f1,f2)+18.96); d=np.abs(f2-f1)
    return np.minimum(a1,a2)*(np.exp(-3.5*s*d)-np.exp(-5.75*s*d))
EDGES=[20,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000]
def metrics(spec):
    x=load(spec); mono=x.mean(0); side=(x[0]-x[1])/2; mid=(x[0]+x[1])/2
    N=4096; H=1024; f=np.fft.rfftfreq(N,1/SR); w=np.hanning(N)
    nfr=(len(mono)-N)//H
    idx=np.arange(nfr)[:,None]*H+np.arange(N)
    P=[];PS=[]
    for b in range(0,nfr,1000):
        P.append((np.abs(np.fft.rfft(mid[idx[b:b+1000]]*w,axis=1))**2).astype(np.float32))
        PS.append((np.abs(np.fft.rfft(side[idx[b:b+1000]]*w,axis=1))**2).astype(np.float32))
    P=np.vstack(P);PS=np.vstack(PS)
    tot=P.sum(); out={}
    bandE=np.stack([P[:,(f>=a)&(f<b)].sum(1) for a,b in zip(EDGES,EDGES[1:])],1)
    bandS=np.stack([PS[:,(f>=a)&(f<b)].sum(1) for a,b in zip(EDGES,EDGES[1:])],1)
    db=lambda v:10*np.log10(v+1e-12)
    ref=tot/nfr
    out['spec']=np.round(db(bandE.mean(0)/ref),1).tolist()
    out['floor']=np.round(db(np.percentile(bandE,10,axis=0)/ref),1).tolist()
    out['width']=np.round(db(bandS.mean(0)/(bandE.mean(0)+1e-12)),1).tolist()
    # Centroid
    S=P.mean(0); out['centroid']=round(float((f*S).sum()/S.sum()),1)
    out['below400']=round(float(S[f<400].sum()/S.sum()*100),1)
    out['above2k_db']=round(float(db(S[f>2000].sum()/S.sum())),1)
    out['above4k_db']=round(float(db(S[f>4000].sum()/S.sum())),1)
    hf=P[:,(f>=4000)&(f<14000)].sum(1)
    out['hf_floor_db']=round(float(db(np.percentile(hf,20)/ref)),1)
    out['hf_p90_db']=round(float(db(np.percentile(hf,90)/ref)),1)
    # flatness 1-8k: geometric/arith mean: 1 = noise, 0 = tonal
    m=(f>=800)&(f<8000); sub=P[:,m]+1e-10
    fl=np.exp(np.log(sub).mean(1))/sub.mean(1)
    # weight frames by energy in that band
    wt=sub.sum(1); out['flatness']=round(float((fl*wt).sum()/wt.sum()),4)
    # noise share of band above 1k: mean power vs power of median-smoothed peaks: tonal peakiness
    # HPSS-like: harmonic = median along time, percussive = median along freq
    sP=P[::4][:, (f>=100)&(f<8000)]
    Hm=ndi.median_filter(np.sqrt(sP),size=(9,1)); Pm=ndi.median_filter(np.sqrt(sP),size=(1,9))
    out['harm_ratio_db']=round(float(db((Hm**2).sum()/(Pm**2).sum())),1)
    # Residual: what is neither tonal nor transient = noisy
    Res=np.maximum(np.sqrt(sP)-np.maximum(Hm,Pm),0)
    out['residual_db']=round(float(db((Res**2).sum()/sP.sum())),1)
    # Roughness (Plomp-Levelt) on 16k FFT frames, 4 per second, partials 80-4000 Hz
    N2=16384; w2=np.hanning(N2); fz=np.fft.rfftfreq(N2,1/SR); r=[]
    for s in range(0,len(mono)-N2,SR//4):
        A=np.abs(np.fft.rfft(mono[s:s+N2]*w2))
        band=(fz>=80)&(fz<=4000); Ab=A*band
        pk,_=sg.find_peaks(Ab,height=Ab.max()*.02,distance=3)
        if len(pk)<2: r.append(0); continue
        pk=pk[np.argsort(A[pk])[::-1][:32]]
        fr=fz[pk]; am=A[pk]/ (A[pk].max()+1e-9)
        ii,jj=np.triu_indices(len(pk),1)
        r.append(float(pl(fr[ii],am[ii],fr[jj],am[jj]).sum()))
    out['roughness']=round(float(np.mean(r)),3); out['roughness_p90']=round(float(np.percentile(r,90)),3)
    # Crest / short-term loudness swing
    rms=np.sqrt(ndi.uniform_filter1d(mono**2,int(.4*SR))[::int(.1*SR)])
    out['crest_db']=round(float(20*np.log10(np.abs(mono).max()/(np.sqrt((mono**2).mean())+1e-9))),1)
    out['lra_db']=round(float(20*np.log10(np.percentile(rms,95)/(np.percentile(rms,10)+1e-9))),1)
    # onset rate above 2k and overall
    e=np.log1p(np.sqrt(P[:,(f>=2000)&(f<14000)].sum(1)));fx=np.maximum(np.diff(e),0)
    pk,_=sg.find_peaks(fx,height=np.percentile(fx,95)*.5,distance=4); out['hf_onsets_s']=round(len(pk)/(len(mono)/SR),1)
    return spec,out
if __name__=='__main__':
    specs=sys.argv[2:]
    with Pool(6) as p: res=dict(p.map(metrics,specs,chunksize=1))
    json.dump(res,open(sys.argv[1],'w'),indent=0)
