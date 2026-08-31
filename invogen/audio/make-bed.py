import wave, math, struct, random
SR=44100; DUR=47.8; N=int(SR*DUR)
random.seed(7)
L=[0.0]*N; R=[0.0]*N

def nf(n):  # midi -> hz
    return 440.0*2**((n-69)/12.0)

BPM=100.0; BEAT=60.0/BPM; BAR=4*BEAT          # 2.4s
# Am - F - C - G, two bars each -> 9.6s cycle
PROG=[[57,60,64,69],[53,57,60,65],[48,55,60,64],[43,50,55,59]]

def add(buf,i,v):
    if 0<=i<N: buf[i]+=v

# ---------- pad: slow-attack detuned sines, one chord per two bars ----------
seg=2*BAR
k=0; t0=0.0
while t0<DUR:
    ch=PROG[k%4]
    for vi,note in enumerate(ch):
        for det,pan in ((-0.06,-0.6),(0.06,0.6),(0.0,0.0)):
            f=nf(note)*(1+det/100.0)
            a0=int(t0*SR); a1=min(N,int((t0+seg+1.2)*SR))
            ph=random.random()*6.283
            for i in range(a0,a1):
                x=(i-a0)/SR
                env=min(1.0,x/1.1)*min(1.0,max(0.0,(seg+1.2-x)/1.4))
                if env<=0: continue
                # a little movement so it never sits still
                trem=1.0+0.10*math.sin(2*math.pi*0.13*x+vi)
                v=math.sin(2*math.pi*f*x+ph)*0.030*env*trem
                v+=math.sin(2*math.pi*f*2*x+ph)*0.008*env   # one octave of shimmer
                lg=(1-pan)*0.5+0.5; rg=(1+pan)*0.5+0.5
                add(L,i,v*lg); add(R,i,v*rg)
    t0+=seg; k+=1

# ---------- sub pulse on the beat, felt not heard ----------
t=0.0
while t<DUR-0.2:
    f=nf(PROG[int(t//seg)%4][0]-12)
    a0=int(t*SR)
    for i in range(a0,min(N,a0+int(0.34*SR))):
        x=(i-a0)/SR
        env=math.exp(-x*9.5)
        v=math.sin(2*math.pi*f*x)*0.075*env
        add(L,i,v); add(R,i,v)
    t+=BEAT

# ---------- arp plucks, offbeat eighths, soft triangle ----------
t=BEAT/2
while t<DUR-0.3:
    ch=PROG[int(t//seg)%4]
    note=ch[1+int((t/BEAT))%3]+12
    f=nf(note); a0=int(t*SR)
    pan=-0.5 if int(t/BEAT)%2 else 0.5
    for i in range(a0,min(N,a0+int(0.55*SR))):
        x=(i-a0)/SR
        env=math.exp(-x*6.0)
        v=(math.sin(2*math.pi*f*x)+0.22*math.sin(2*math.pi*f*3*x)/3)*0.030*env
        lg=(1-pan)*0.5+0.5; rg=(1+pan)*0.5+0.5
        add(L,i,v*lg); add(R,i,v*rg)
    t+=BEAT

# ---------- one riser into the CTA (42.66) ----------
r0,r1=41.9,42.7
a0=int(r0*SR); a1=int(r1*SR); span=a1-a0
lp=0.0
for i in range(a0,min(N,a1)):
    x=(i-a0)/span
    n=random.uniform(-1,1)
    lp=lp*(0.90-0.28*x)+n*(0.10+0.28*x)     # filter opens as it climbs
    v=lp*0.085*(x**1.7)
    add(L,i,v); add(R,i,v)
# and the impact it lands on
a0=int(42.66*SR)
for i in range(a0,min(N,a0+int(1.6*SR))):
    x=(i-a0)/SR
    env=math.exp(-x*3.2)
    v=math.sin(2*math.pi*nf(45)*x)*0.10*env + math.sin(2*math.pi*nf(57)*x)*0.035*env
    add(L,i,v); add(R,i,v)

# ---------- two functional ticks: signature done, one-click convert ----------
for at,f,g in ((30.9,1650,0.055),(32.6,2100,0.050)):
    a0=int(at*SR)
    for i in range(a0,min(N,a0+int(0.09*SR))):
        x=(i-a0)/SR
        v=math.sin(2*math.pi*f*x)*g*math.exp(-x*46)
        add(L,i,v); add(R,i,v)

# ---------- top and tail ----------
fi=int(1.6*SR); fo=int(2.6*SR)
for i in range(fi):
    g=i/fi; L[i]*=g; R[i]*=g
for i in range(fo):
    g=1-i/fo; L[N-1-i]*=g; R[N-1-i]*=g

peak=max(max(abs(v) for v in L),max(abs(v) for v in R))
sc=0.82/peak if peak else 1
w=wave.open('bed.wav','wb')
w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(b''.join(struct.pack('<hh',
    int(max(-1,min(1,L[i]*sc))*32767), int(max(-1,min(1,R[i]*sc))*32767)) for i in range(N)))
w.close(); print('bed.wav written', DUR,'s')
