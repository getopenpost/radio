"""Separate windows with htdemucs on MPS. Usage: sep.py <mix.mp3> <outdir> <name:start:dur> ...
Writes <outdir>/<name>/{mix,drums,bass,other,vocals}.flac (44.1k stereo)."""
import subprocess, sys, os, time, numpy as np, soundfile as sf, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
mix,outdir=sys.argv[1],sys.argv[2]
model=get_model('htdemucs'); model.eval(); dev='mps' if torch.backends.mps.is_available() else 'cpu'; model.to(dev)
for spec in sys.argv[3:]:
    name,start,dur=spec.split(':'); t0=time.time()
    raw=subprocess.run(['ffmpeg','-v','error','-ss',start,'-t',dur,'-i',mix,'-ac','2','-ar','44100','-f','f32le','pipe:1'],stdout=subprocess.PIPE,check=True).stdout
    x=np.frombuffer(raw,dtype=np.float32).reshape(-1,2).T.copy()
    w=torch.from_numpy(x)
    ref=w.mean(0); m,s=ref.mean(),ref.std()
    with torch.no_grad():
        out=apply_model(model,((w-m)/s)[None],device=dev,split=True,overlap=0.25,shifts=0,progress=False)[0]
    out=(out*s+m).cpu().numpy()
    d=f'{outdir}/{name}'; os.makedirs(d,exist_ok=True)
    sf.write(f'{d}/mix.flac',x.T,44100,subtype='PCM_16')
    for i,src in enumerate(model.sources):
        sf.write(f'{d}/{src}.flac',np.clip(out[i].T,-1,1),44100,subtype='PCM_16')
    print(name,float(dur),'s in',round(time.time()-t0,1),'s',flush=True)
