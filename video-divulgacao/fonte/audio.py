import numpy as np, wave
sr=44100; T=26; n=sr*T; L=np.zeros(n); R=np.zeros(n)
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
bpm=120; beat=60/bpm
# bass progression (F minor-ish -> Ab -> Eb -> Db)
roots=[43.65,51.91,38.89,34.65]
for b in range(int(T/beat)):
    t=b*beat; bar=b//4
    if t>=25.2: break
    drop = t>=3.0
    if b%4==0 or (drop and b%2==0) or (t>=12.4 and t<21.4): add(kick(),t,.9)
    if drop: add(hat(),t+beat/2,.25,.3); add(hat(),t+beat/4,.1,-.3)
    if drop and b%2==1: add(clap(),t,.45)
    r=roots[(bar)%4]
    if drop:
        add(lp(tone(r*2,beat*.9,4),.08),t,.55); add(lp(tone(r*2,beat*.45,6),.08),t+beat/2,.35)
    # pad
    if b%4==0:
        for m,pn in ((4,-.4),(4*1.189,.4),(4*1.498,0)):
            add(lp(tone(r*m,beat*4,0.6),.04),t,.10,pn)
# impacts and whooshes
for t in (0.0,1.0,4.6,13.9,20.55,22.1): add(impact(),t,.8)
for c in (3,5.6,12.4,15.4,19.4,21.4): add(whoosh(.45),c-.4,.5)
for i in range(5): add(whoosh(.25),15.55+i*.75-.05,.3,(-1)**i*.4)
for t,f in ((6.5,1200),(7.75,880),(8.55,880),(9.7,1200),(10.95,880)): add(pop(f),t,.5)
# counter ticks
for t in np.arange(12.6,13.9,.06): add(pop(2400)*.4,t,.15)
add(pop(1500),23.35,.6)
m=np.stack([L,R],1); m[-int(.8*sr):]*=np.linspace(1,0,int(.8*sr))[:,None]
m=m/np.abs(m).max()*.89
with wave.open('trilha.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((m*32767).astype('<i2').tobytes())
