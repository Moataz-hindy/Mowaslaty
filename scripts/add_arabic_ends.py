# Adds Arabic start/end names to every route in routes_summary.json:
#   origin_ar / dest_ar  (in the direction the route actually runs)
# The dataset's Arabic name ("A - B") has a fixed order for both directions,
# so we decide which half is the start by comparing each half with the first
# and last stops of that direction (via_stops are in travel order).
# Routes where the stops give no evidence are left without the fields; the app
# then shows the first stop as the starting point.
# Usage: python scripts/add_arabic_ends.py public/data/routes_summary.json [data/routes_summary.json ...]
import json,re,sys
def norm(t):
    t=(t or '').lower()
    t=re.sub('[أإآ]','ا',t); t=t.replace('ة','ه').replace('ى','ي')
    t=re.sub(r'[ً-ٟ]','',t)
    t=re.sub(r'[^\w\s]',' ',t)
    return [w for w in t.split() if len(w)>2 and w not in {'شارع','ميدان','محطه','موقف','مترو','كوبري','مدينه','الحي','حي','منطقه','بوابه','street','square'}]
def ov(a,b):
    A=set(norm(a)); B=set(norm(' '.join(b)))
    return len(A&B)
def split_pair(longname, origin_en, dest_en):
    parts=[p.strip() for p in (longname or '').split(' - ')]
    return parts
def infer(x):
    la=(x.get('long_ar') or '')
    vs=x.get('via_stops') or []
    # split long_ar into two halves at the " - " that best balances names; try every split
    parts=la.split(' - ')
    if len(parts)<2: return None
    best=None
    first=vs[:3]; last=vs[-3:]
    cands=[]
    for i in range(1,len(parts)):
        a=' - '.join(parts[:i]).strip(); b=' - '.join(parts[i:]).strip()
        # score: a is origin if a matches first stops / b matches last stops
        s_ab=ov(a,first)+ov(b,last)-ov(a,last)-ov(b,first)
        cands.append((abs(s_ab),s_ab,a,b,i))
    # choose split matching english split position if possible
    le=(x.get('long_en') or '').split(' - ')
    oe=(x.get('origin_en') or x.get('origin') or '').strip()
    pos=None
    for i in range(1,len(le)):
        if ' - '.join(le[:i]).strip()==oe or ' - '.join(le[i:]).strip()==oe: pos=i
    cands.sort(key=lambda c:(-c[0], 0 if c[4]==pos else 1))
    _,s,a,b,i=cands[0]
    if s>0: return a,b,'stops'
    if s<0: return b,a,'stops'
    # no stop evidence: use english order mapping
    if pos is not None:
        first_en=' - '.join(le[:pos]).strip()
        a=' - '.join(parts[:pos]).strip(); b=' - '.join(parts[pos:]).strip()
        return (a,b,'en') if first_en==oe else (b,a,'en')
    return None

def main():
    for path in sys.argv[1:]:
        raw=open(path,encoding='utf-8').read()
        routes=json.loads(raw)
        n=0
        for x in routes:
            if x.get('vehicle')=='Metro':
                continue
            res=infer(x)
            x.pop('origin_ar',None); x.pop('dest_ar',None)
            if res and res[2]=='stops':
                x['origin_ar'], x['dest_ar'] = res[0], res[1]
                n+=1
        indent = 2 if raw[:200].count('\n')>1 else None
        sep = None if indent else (',',':')
        open(path,'w',encoding='utf-8').write(json.dumps(routes,ensure_ascii=False,indent=indent,separators=sep))
        print(path, 'routes with Arabic ends:', n, 'of', len(routes))
if __name__=='__main__':
    main()
