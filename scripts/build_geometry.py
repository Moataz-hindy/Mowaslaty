# Builds public/data/routes_geometry.v2.json from data/routes_geometry.json:
# simplifies each route (Douglas-Peucker, tolerance in metres) and stores it as a
# Google encoded polyline (precision 5). Usage:
#   python scripts/build_geometry.py data/routes_geometry.json public/data/routes_geometry.v2.json 5
# If you change the data, bump the file name (v3, v4...) and update src/utils/dataLoader.js
# so browsers fetch the new file instead of a cached one.
import json, math, sys, gzip
src, dst, tol = sys.argv[1], sys.argv[2], float(sys.argv[3])

def dp(pts, eps):
    # Douglas-Peucker on a local equirectangular projection (metres)
    if len(pts) < 3: return pts
    lat0 = math.radians(pts[0][0]); kx = 111320*math.cos(lat0); ky = 110540
    P = [(p[1]*kx, p[0]*ky) for p in pts]
    keep = [False]*len(pts); keep[0]=keep[-1]=True
    stack=[(0,len(pts)-1)]
    while stack:
        a,b = stack.pop()
        ax,ay=P[a]; bx,by=P[b]; dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy
        best=-1; bi=-1
        for i in range(a+1,b):
            px,py=P[i]
            if L==0: d=math.hypot(px-ax,py-ay)
            else:
                t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L))
                d=math.hypot(px-(ax+t*dx),py-(ay+t*dy))
            if d>best: best=d; bi=i
        if best>eps:
            keep[bi]=True; stack.append((a,bi)); stack.append((bi,b))
    return [p for p,k in zip(pts,keep) if k]

def enc_num(v):
    v = ~(v<<1) if v<0 else (v<<1)
    out=[]
    while v>=0x20:
        out.append(chr((0x20|(v&0x1f))+63)); v>>=5
    out.append(chr(v+63)); return ''.join(out)

def encode(pts):  # Google encoded polyline, precision 5, [lat,lng]
    res=[]; plat=plng=0
    for lat,lng in pts:
        ilat=round(lat*1e5); ilng=round(lng*1e5)
        res.append(enc_num(ilat-plat)); res.append(enc_num(ilng-plng))
        plat,plng=ilat,ilng
    return ''.join(res)

g=json.load(open(src))
before=sum(len(v) for v in g.values())
out={}; after=0
for k,v in g.items():
    s=dp(v,tol) if tol>0 else v
    # drop consecutive duplicates
    s=[p for i,p in enumerate(s) if i==0 or p!=s[i-1]]
    if len(s)<2: s=v[:1]+v[-1:]
    after+=len(s); out[k]=encode(s)
data=json.dumps(out,separators=(',',':'))
open(dst,'w').write(data)
print(f"tol={tol}m points {before} -> {after} ({after/before:.0%}); file {len(data)/1e6:.2f} MB, gzip {len(gzip.compress(data.encode(),9))/1e6:.2f} MB")
