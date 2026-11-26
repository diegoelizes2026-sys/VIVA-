import numpy as np, wave
import json,sys
V=sys.argv[1];M=json.load(open(f'ev_{V}.json'));sr=44100; T=M['T']; n=int(sr*T); L=np.zeros(n); R=np.zeros(n)
rng=np.random.default_rng(7)
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*sr); s=sig[:max(0,n-i)]; L[i:i+len(s)]+=s*g*(1-pan); R[i:i+len(s)]+=s*g*(1+pan)
def env(d,a=.003,dec=8):
    k=np.arange(int(d*sr))/sr; return np.minimum(k/a,1)*np.exp(-k*dec)
def kick():
    d=.45;k=np.arange(int(d*sr))/sr; f=45+110*np.exp(-k*30); ph=2*np.pi*np.cumsum(f)/sr
    return np.tanh(2.2*np.sin(ph)*np.exp(-k*7))
def lp(x,a): 
    y=np.zeros_like(x); acc=0.
    for i,v in enumerate(x): acc+=a*(v-acc); y[i]=acc
    return y
def hat(): x=rng.standard_normal(int(.06*sr)); x=x-lp(x,.3); return x*env(.06,.001,60)
def clap():
    x=rng.standard_normal(int(.25*sr)); x=x-lp(x,.08); e=env(.25,.001,18)
    for o in (0.01,0.022):
        j=int(o*sr); seg=env(.25,.001,40)[:len(e)-j]; e[j:]+=seg*.6
    return x*e*.7
def tone(f,d,dec=3,wav='saw'):
    k=np.arange(int(d*sr))/sr
    s=(2*((k*f)%1)-1) if wav=='saw' else np.sin(2*np.pi*f*k)
    return s*env(d,.005,dec)
def whoosh(d=.45,up=True):
    x=rng.standard_normal(int(d*sr)); k=np.linspace(0,1,len(x))
    a=0.02+ (0.5*k if up else 0.5*(1-k)); y=np.zeros_like(x); acc=0.
    for i,v in enumerate(x): acc+=a[i]*(v-acc); y[i]=acc
    return y*np.sin(np.pi*k)**2*2.5
def impact():
    d=1.2;k=np.arange(int(d*sr))/sr; f=38+80*np.exp(-k*12)
    s=np.tanh(3*np.sin(2*np.pi*np.cumsum(f)/sr)*np.exp(-k*3.5))
    nz=rng.standard_normal(len(k))*np.exp(-k*14)*.5
    return s+nz
def pop(f=880):
    d=.12;k=np.arange(int(d*sr))/sr; return np.sin(2*np.pi*(f+f*np.exp(-k*60))*k)*env(d,.001,35)
bpm=128; beat=60/bpm
roots=[43.65,51.91,38.89,34.65]
for b in range(int(T/beat)):
    t=b*beat; bar=b//4
    if t>=T-.6: break
    add(kick(),t,.85)
    add(hat(),t+beat/2,.25,.3); add(hat(),t+beat/4,.08,-.3)
    if b%2==1: add(clap(),t,.4)
    r=roots[bar%4]
    add(lp(tone(r*2,beat*.9,4),.08),t,.5); add(lp(tone(r*2,beat*.45,6),.08),t+beat/2,.3)
    if b%4==0:
        for m_,pn in ((4,-.4),(4*1.189,.4),(4*1.498,0)): add(lp(tone(r*m_,beat*4,0.6),.04),t,.09,pn)
for e in M['ev']:
    t,k=e['t'],e['k']
    if k=='hit': add(impact(),t,.7)
    elif k=='cut': add(whoosh(.4),max(0,t-.36),.45)
    elif k=='send': add(pop(1200),t,.5)
    elif k=='recv': add(pop(880),t,.5)
    elif k=='pop': add(pop(1500),t,.6)
    elif k=='strike': add(whoosh(.2,False),t,.4)
    elif k=='count':
        for tt in np.arange(t,t+e['d'],.06): add(pop(2400)*.4,tt,.15)
m=np.stack([L,R],1); m[-int(.8*sr):]*=np.linspace(1,0,int(.8*sr))[:,None]
m=m/np.abs(m).max()*.89
with wave.open(f'a_{V}.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((m*32767).astype('<i2').tobytes())
