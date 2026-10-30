"""Transcribe a stem set. Usage: deep.py <stemdir> [bpm_hint]  -> <stemdir>/report.json, sheet.png"""
import sys, json, numpy as np, librosa, soundfile as sf, scipy.signal as sg, scipy.ndimage as ndi
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
D=sys.argv[1]; hint=float(sys.argv[2]) if len(sys.argv)>2 else None
SR=22050
def load(n):
    y,sr=sf.read(f'{D}/{n}.flac',always_2d=True); return y.astype(np.float32),sr
def mono(n):
    y,sr=load(n); return librosa.resample(y.mean(1),orig_sr=sr,target_sr=SR)
drums,bass,other,voc,mix=[mono(n) for n in ('drums','bass','other','vocals','mix')]
NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
nn=lambda m:f'{NAMES[int(m)%12]}{int(m)//12-1}'
HOP=256; fps=SR/HOP
def band_env(y,lo,hi):
    S=np.abs(librosa.stft(y,n_fft=1024,hop_length=HOP))
    f=librosa.fft_frequencies(sr=SR,n_fft=1024); m=(f>=lo)&(f<hi)
    return S[m].sum(0)
def flux(env):
    e=np.log1p(env/ (np.percentile(env,95)+1e-9)*20)
    d=np.maximum(np.diff(e,prepend=e[0]),0); return d
kick=flux(band_env(drums,30,140)); snare=flux(band_env(drums,300,3000)); hat=flux(band_env(drums,6000,10500))
bassf=flux(band_env(bass,30,300)); otherf=flux(band_env(other,200,4000))
all_=kick*1.0+snare*.6+hat*.3+bassf*.3
# Tempo: strongest comb across 60-170, then report candidates
N=len(all_); ac=np.fft.irfft(np.abs(np.fft.rfft(all_-all_.mean(),2*N))**2)[:N]; ac/=ac[0]+1e-9
def comb(bpm):
    lag=60/bpm*fps
    return sum(np.interp(lag*m,np.arange(N),ac) for m in (1,2,3,4,6,8))/6 + .5*sum(np.interp(lag*m/4,np.arange(N),ac) for m in (1,3))/2
grid=np.arange(60,175,.05); sc=np.array([comb(b) for b in grid])
pk,_=sg.find_peaks(sc,distance=30)
top=pk[np.argsort(sc[pk])[::-1][:6]]
cands=[(round(float(grid[i]),2),round(float(sc[i]),3)) for i in top]
# Prefer the beat in 70-140: a comb peak at 60-65 is usually half of a 120-130 pulse.
def norm(b):
    while b<70: b*=2
    while b>140: b/=2
    return b
bpm=norm(float(grid[top[0]]))
if not hint:
    w=(grid>bpm*.985)&(grid<bpm*1.015); bpm=float(grid[w][np.argmax(sc[w])])
if hint:
    w=(grid>hint*.98)&(grid<hint*1.02); bpm=float(grid[w][np.argmax(sc[w])])
beat=60/bpm; bar=4*beat; step=beat/4
# phase: find the 16th-grid offset with max onset energy (kick weighted), then bar start by kick+bass change
def steps(sig,off,nsteps):
    idx=((off+np.arange(nsteps)*step)*fps).astype(int); idx=idx[idx<len(sig)-3]
    return np.array([sig[max(i-2,0):i+3].max() for i in idx])
offs=np.arange(0,step,step/24)
scores=[steps(kick+snare*.5+hat*.2,o,int(len(kick)/fps/step)-1).mean() for o in offs]
off=float(offs[int(np.argmax(scores))])
ns=int((len(kick)/fps-off)/step)-1
K,Sn,H,Bf,Of=[steps(s,off,ns) for s in (kick,snare,hat,bassf,otherf)]
# Best bar phase among 16 rotations: choose rotation where step 0 has most kick, tie by bass onsets
rot=[(K[r::16].mean()*1.0+Bf[r::16].mean()*.5,r) for r in range(16)]
r0=max(rot)[1]
off+=r0*step; K,Sn,H,Bf,Of=[np.roll(a,-r0)[:len(a)-r0] for a in (K,Sn,H,Bf,Of)]
nb=len(K)//16
pat=lambda a:(a[:nb*16].reshape(nb,16).mean(0)/(np.percentile(a,99)+1e-9)).round(2).tolist()
# 2-bar view too
nb2=len(K)//32
pat2=lambda a:(a[:nb2*32].reshape(nb2,32).mean(0)/(np.percentile(a,99)+1e-9)).round(2).tolist()
# Microtiming: mean offset of off-16ths for hats relative to grid (swing)
def swing(sig):
    res=[]
    for s in range(1,len(K)-1,2):
        t=off+s*step
        c=int(t*fps); w=sig[max(c-int(.04*fps),0):c+int(.04*fps)+1]
        if len(w)<3 or w.max()<np.percentile(sig,80): continue
        res.append((np.argmax(w)-len(w)//2)/fps*1000)
    return round(float(np.median(res)),1) if res else None
# CQT piano rolls
def roll(y,fmin,oct):
    C=np.abs(librosa.cqt(y,sr=SR,hop_length=HOP,fmin=fmin,n_bins=12*oct*3,bins_per_octave=36,filter_scale=1.2))
    return C[1::3]*.5+C[0::3]*.25+C[2::3]*.25   # semitone bins, centre at index 1
bmidi=24; omidi=36; vmidi=48
RB=roll(bass,librosa.midi_to_hz(bmidi),4)
RO=roll(other,librosa.midi_to_hz(omidi),5)
RV=roll(voc,librosa.midi_to_hz(vmidi),4)
RM=roll(mix,librosa.midi_to_hz(24),7)
def stepsync(R):
    idx=((off+np.arange(len(K)+1)*step)*fps).astype(int); idx=idx[idx<R.shape[1]]
    return np.stack([R[:,a:b].mean(1) for a,b in zip(idx,idx[1:])],1)
SB,SO,SV=stepsync(RB),stepsync(RO),stepsync(RV)
# Bass line on 16th grid
bn=SB.argmax(0)+bmidi; bv=SB.max(0); thr=np.percentile(bv,50)*.5
bline=[(nn(m) if v>thr else '.') for m,v in zip(bn,bv)]
# Chords per half-bar: pitch classes above threshold from other+bass
n2=8
def chordat(i):
    v=SO[:,i:i+n2].mean(1); pc=np.zeros(12)
    for k,x in enumerate(v): pc[(k+omidi)%12]+=x
    return pc
chroma=np.stack([chordat(i) for i in range(0,SO.shape[1]-n2+1,n2)],1)
Q={'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'m7':[0,3,7,10],'maj7':[0,4,7,11],'m9':[0,3,7,10,2],'maj9':[0,4,7,11,2],'sus2':[0,2,7],'sus4':[0,5,7],'m6':[0,3,7,9],'dim':[0,3,6],'add9':[0,4,7,2],'madd9':[0,3,7,2],'9':[0,4,7,10,2],'m11':[0,3,7,10,5]}
T=[]
for r in range(12):
    for q,iv in Q.items():
        t=np.full(12,-.15); 
        for j,x in enumerate(iv): t[(r+x)%12]=1.0 if j<3 else .7
        T.append((f'{NAMES[r]}{q}',t/np.linalg.norm(t),r))
chords=[]
for i in range(chroma.shape[1]):
    c=chroma[:,i]; 
    if c.max()<=0: chords.append('-'); continue
    c=c/np.linalg.norm(c)
    bs=SB[:,i*n2:i*n2+n2].mean(1); br=(int(bs.argmax())+bmidi)%12
    best=max(T,key=lambda t:c.dot(t[1])+(.08 if t[2]==br else 0))
    chords.append(best[0])
# Vocal presence, stem energy
rms=lambda y:float(np.sqrt((y**2).mean()))
stem_db={n:round(20*np.log10(rms(y)/rms(mix)+1e-9),1) for n,y in (('drums',drums),('bass',bass),('other',other),('vocals',voc))}
# Sidechain: other stem RMS over beat phase
o_env=np.sqrt(ndi.uniform_filter1d(other**2,int(.01*SR)))
beatphase=[]
for b in range(int((len(other)/SR-off)/beat)-1):
    s=int((off+b*beat)*SR); e=int((off+(b+1)*beat)*SR)
    beatphase.append(np.interp(np.linspace(0,1,24),np.linspace(0,1,e-s),o_env[s:e]))
beatphase=np.mean(beatphase,0) if beatphase else np.zeros(24)
pump_db=float(20*np.log10(beatphase.max()/(beatphase.min()+1e-9)+1e-9))
# Clutter: how much of the pitch-time plane is occupied, per stem
def clutter(R,lo_m):
    Z=librosa.amplitude_to_db(R,ref=np.percentile(R.max(0),95)+1e-9)
    act=Z>-24
    return dict(poly=round(float(act.sum(0).mean()),2),occ=round(float(act.mean()),3),
      gaps=round(float((Z.max(0)<-12).mean()),3),
      # persistence: how long a pitch stays on, in seconds (median run length)
      run_s=round(float(np.median([l for row in act for l in (lambda r:np.diff(np.where(np.concatenate([[0],r,[0]])==0)[0])-1)(row.astype(int)) if l>0] or [0])/fps),3))
clut={'other':clutter(RO,omidi),'bass':clutter(RB,bmidi),'mix_c3c7':clutter(RM[24:72],48)}
# Harmonic rhythm: chord changes per bar from half-bar chroma
ch=chroma/(np.linalg.norm(chroma,axis=0,keepdims=True)+1e-9)
sim=(ch[:,1:]*ch[:,:-1]).sum(0)
chg=float((sim<.8).mean()*2)
# Loop length: best repetition period in bars of the other-stem chroma
loop=None;best=-1
for L in (1,2,4,8):
    k=L*2
    if ch.shape[1]<=k+1: continue
    c=float((ch[:,k:]*ch[:,:-k]).sum(0).mean())
    if c>best+.015: best=c;loop=L
# Key, roman numerals, register, top line, stem-level rhythm cells
MAJ=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); MINP=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
pcs=np.zeros(12)
for k in range(SO.shape[0]): pcs[(k+omidi)%12]+=(SO[k]**2).sum()
for k in range(SB.shape[0]): pcs[(k+bmidi)%12]+=(SB[k]**2).sum()*.5
kb=(-9,0,'maj')
for r_ in range(12):
    for nm,t in (('maj',MAJ),('min',MINP)):
        c=np.corrcoef(np.roll(t,r_),pcs)[0,1]
        if c>kb[0]: kb=(float(c),r_,nm)
keyr=kb[1]; keym=kb[2]
ROM=['I','bII','II','bIII','III','IV','#IV','V','bVI','VI','bVII','VII']
def roman(ch):
    if ch=='-' : return '-'
    root=ch[:2] if len(ch)>1 and ch[1]=='b' else ch[0]
    q=ch[len(root):]; r_=(NAMES.index(root)-keyr)%12
    # key is relative to tonic; major or minor tonic spelled by quality
    return ROM[r_]+q
romans=[roman(c) for c in chords]
act=SO>np.percentile(SO.max(0),60)*.4
reg=np.where(act.any(1))[0]
power=(SO**2).sum(1); cum=np.cumsum(power)/power.sum()
reglo=int(np.searchsorted(cum,.1))+omidi; reghi=int(np.searchsorted(cum,.9))+omidi; regc=int(np.searchsorted(cum,.5))+omidi
top=[]
for i in range(SO.shape[1]):
    v=SO[31:,i]   # above G4
    if v.max()<np.percentile(SO.max(0),40)*.5: top.append(None); continue
    idx=np.where(v>v.max()*.5)[0]; top.append(int(idx.max())+31+omidi)
rep={'key':NAMES[keyr]+' '+keym,'keyc':round(kb[0],2),'roman':romans,'register':[nn(reglo),nn(regc),nn(reghi)],'topline':top,'clutter':clut,'chg_per_bar':round(chg,2),'loop_bars':loop,'loop_sim':round(best,3),'dir':D,'bpm':round(bpm,2),'cands':cands,'offset':round(off,3),'bars':nb,
 'kick':pat(K),'snare':pat(Sn),'hat':pat(H),'bass_on':pat(Bf),'other_on':pat(Of),
 'kick2':pat2(K),'snare2':pat2(Sn),'hat2':pat2(H),
 'swing_ms':{'hat':swing(hat),'snare':swing(snare),'other':swing(otherf)},
 'bassline':bline[:128],'chords':chords,'stem_db':stem_db,'pump_db':round(pump_db,1),'pump_curve':np.round(beatphase/beatphase.max(),2).tolist()}
json.dump(rep,open(f'{D}/report.json','w'))
# Sheet
def spb(a): return ' '.join(f'{x:4.2f}' for x in a)
fig,ax=plt.subplots(5,1,figsize=(24,18),gridspec_kw=dict(height_ratios=[2.2,1.4,1,2,1.2]))
bars=8; start=off; end=off+bars*bar
def show(a,R,lo,title,db=40):
    a0=int(start*fps);a1=int(end*fps); Z=librosa.amplitude_to_db(R[:,a0:a1],ref=np.max(R[:,a0:a1])+1e-9)
    a.imshow(Z,aspect='auto',origin='lower',vmin=-db,vmax=0,cmap='magma',extent=[0,bars,lo-.5,lo+R.shape[0]-.5],interpolation='nearest')
    a.set_title(title,loc='left'); 
    for b in range(bars+1): a.axvline(b,color='c',lw=.6)
    for b in np.arange(0,bars,.25): a.axvline(b,color='c',lw=.15)
    t=np.arange(lo-lo%12,lo+R.shape[0],12); a.set_yticks(t); a.set_yticklabels([nn(m) for m in t])
    a.grid(axis='y',color='w',lw=.15)
show(ax[0],RM,24,f'MIX {bpm:.1f} bpm cands {cands[:4]} stems {stem_db} pump {pump_db:.1f}dB')
show(ax[1],RB,bmidi,'BASS stem')
show(ax[3],RO,omidi,'OTHER stem')
show(ax[4],RV,vmidi,'VOCALS stem')
a=ax[2]; a0=int(start*fps);a1=int(end*fps); tt=np.linspace(0,bars,a1-a0)
a.plot(tt,kick[a0:a1]/kick.max()+2,lw=.6,c='r');a.plot(tt,snare[a0:a1]/snare.max()+1,lw=.6,c='g');a.plot(tt,hat[a0:a1]/hat.max(),lw=.6,c='b')
for b in range(bars+1): a.axvline(b,color='k',lw=.6)
for b in np.arange(0,bars,.25): a.axvline(b,color='k',lw=.15)
a.set_title('drums onset: kick / snare / hat',loc='left')
plt.tight_layout();plt.savefig(f'{D}/sheet.png',dpi=62)
print(D,'bpm',round(bpm,2),cands[:4],'stems',stem_db,'pump',round(pump_db,1))
g=lambda a:' '.join(f'{x:.1f}'[1:] if x<1 else '1.' for x in a)
print('kick ',g(rep['kick']));print('snare',g(rep['snare']));print('hat  ',g(rep['hat']));print('bass ',g(rep['bass_on']));print('other',g(rep['other_on']))
print('key',rep['key'],rep['keyc'],'reg',rep['register'],'roman',' '.join(romans[:16]))
print('clutter',clut,'chg/bar',rep['chg_per_bar'],'loop',loop,round(best,2))
print('swing',rep['swing_ms']);print('chords',' '.join(chords[:32]))
print('bass',' '.join(bline[:64]))
