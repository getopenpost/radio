"""Coherent average of drum hits on the transcribed grid; measure them.
Usage: oneshot.py <stemdir> ... -> prints table, writes <stemdir>/oneshots.png"""
import sys, json, numpy as np, soundfile as sf, scipy.signal as sg, librosa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
SR=44100
def analyse(D):
    r=json.load(open(f'{D}/report.json')); y,sr=sf.read(f'{D}/drums.flac',always_2d=True); y=y.mean(1)
    bpm=r['bpm'];off=r['offset'];step=60/bpm/4
    res={}
    def collect(steps,dur,band=None,name=''):
        x=y
        if band: 
            sos=sg.butter(4,band,btype='band',fs=SR,output='sos'); x=sg.sosfiltfilt(sos,y)
        L=int(dur*SR); seg=[]
        n=int((len(y)/SR-off)/step)
        for s in range(n):
            if s%16 not in steps: continue
            t=int((off+s*step)*SR)-int(.01*SR)
            if t<0 or t+L>len(y): continue
            seg.append(x[t:t+L])
        if not seg: return None
        seg=np.stack(seg)
        # refine alignment by cross-correlation against the mean
        for _ in range(2):
            m=seg.mean(0); al=[]
            for s_ in seg:
                c=sg.correlate(s_[:int(.08*SR)],m[:int(.08*SR)],mode='same'); lag=np.argmax(c)-int(.04*SR)
                al.append(np.roll(s_,-lag))
            seg=np.stack(al)
        return seg.mean(0)
    k=collect([0,4,8,12],.42); out={}
    # Kick measurement: pitch track via zero-crossing on low-passed
    if k is not None:
        lp=sg.sosfiltfilt(sg.butter(4,400,fs=SR,output='sos'),k)
        env=np.abs(sg.hilbert(lp)); pk=np.argmax(env); e=env/env.max()
        tail=np.where(e[pk:]<.1)[0]; d10=tail[0]/SR if len(tail) else None
        tail=np.where(e[pk:]<.5)[0]; d50=tail[0]/SR if len(tail) else None
        # inst freq
        an=sg.hilbert(lp); ph=np.unwrap(np.angle(an)); fi=np.diff(ph)*SR/2/np.pi
        fi=sg.medfilt(fi,301); at=lambda ms:float(fi[min(pk+int(ms/1000*SR),len(fi)-1)])
        S=np.abs(np.fft.rfft(k*np.hanning(len(k)))); f=np.fft.rfftfreq(len(k),1/SR)
        c=float((f*S**2).sum()/(S**2).sum())
        hf=10*np.log10((S[f>1000]**2).sum()/(S**2).sum())
        out['kick']=dict(p5=round(at(5)),p15=round(at(15)),p30=round(at(30)),p60=round(at(60)),p120=round(at(120)),d50=round(d50*1000) if d50 else None,d10=round(d10*1000) if d10 else None,cent=round(c),hf_db=round(hf,1))
    sn=collect([4,12],.3,(150,12000)); 
    if sn is not None:
        env=np.abs(sg.hilbert(sn)); e=env/env.max(); pk=np.argmax(e); t=np.where(e[pk:]<.1)[0]
        S=np.abs(np.fft.rfft(sn*np.hanning(len(sn))))**2; f=np.fft.rfftfreq(len(sn),1/SR)
        out['clap']=dict(d10=round(t[0]/SR*1000) if len(t) else None,cent=round(float((f*S).sum()/S.sum())),snr=round(float(env[:int(.04*SR)].max()/np.median(env[int(.2*SR):])),1))
    h=collect([2,6,10,14],.22,(2500,16000))
    if h is not None:
        env=np.abs(sg.hilbert(h)); e=env/env.max(); pk=np.argmax(e); t=np.where(e[pk:]<.1)[0]
        S=np.abs(np.fft.rfft(h*np.hanning(len(h))))**2; f=np.fft.rfftfreq(len(h),1/SR)
        out['hat']=dict(d10=round(t[0]/SR*1000) if len(t) else None,cent=round(float((f*S).sum()/S.sum())),rel_kick_db=round(float(20*np.log10(np.abs(h).max()/(np.abs(k).max()+1e-9))),1))
    if sn is not None and k is not None: out['clap']['rel_kick_db']=round(float(20*np.log10(np.abs(sn).max()/np.abs(k).max())),1)
    return k,sn,h,out
fig,ax=plt.subplots(len(sys.argv[1:]),3,figsize=(16,2.6*len(sys.argv[1:])),squeeze=False)
for i,D in enumerate(sys.argv[1:]):
    k,sn,h,o=analyse(D); print(D.split('/')[-1],o)
    for j,(s,n) in enumerate(((k,'kick'),(sn,'clap'),(h,'hat'))):
        if s is None: continue
        X=librosa.amplitude_to_db(np.abs(librosa.stft(s/np.abs(s).max(),n_fft=1024,hop_length=64)),ref=np.max)
        ax[i,j].imshow(X[:300],origin='lower',aspect='auto',vmin=-60,vmax=0,cmap='magma'); ax[i,j].set_title(D.split('/')[-1]+' '+n,fontsize=8)
plt.tight_layout();plt.savefig('reports/oneshots.png',dpi=55)
