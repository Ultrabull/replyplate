import json, subprocess, segno, sys
def maskfn(n,r,c):
    return [ (r+c)%2==0, r%2==0, c%3==0, (r+c)%3==0,
             (r//2+c//3)%2==0, (r*c)%2+(r*c)%3==0,
             ((r*c)%2+(r*c)%3)%2==0, ((r+c)%2+(r*c)%3)%2==0 ][n]
ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90]]
def funcmap(size, version):
    res=[[0]*size for _ in range(size)]
    def rect(r0,c0,h,w):
        for r in range(r0,r0+h):
            for c in range(c0,c0+w):
                if 0<=r<size and 0<=c<size: res[r][c]=1
    rect(0,0,9,9); rect(0,size-8,9,8); rect(size-8,0,8,9)
    for i in range(8,size-8): res[6][i]=1; res[i][6]=1
    pos=ALIGN[version-1]; last=len(pos)-1
    for a in range(len(pos)):
        for b in range(len(pos)):
            if (a==0 and b==0) or (a==0 and b==last) or (a==last and b==0): continue
            for dr in range(-2,3):
                for dc in range(-2,3): res[pos[a]+dr][pos[b]+dc]=1
    if version>=7:
        for n in range(18):
            r,c=n//3, size-11+n%3
            res[r][c]=1; res[c][r]=1
    return res
def read(rows, version, mask):
    size=len(rows); m=[[int(ch) for ch in r] for r in rows]; res=funcmap(size,version)
    bits=[]; up=True; col=size-1
    while col>0:
        if col==6: col-=1
        for i in range(size):
            row=size-1-i if up else i
            for j in range(2):
                c=col-j
                if res[row][c]: continue
                bits.append(m[row][c] ^ (1 if maskfn(mask,row,c) else 0))
        up=not up; col-=2
    w=[]
    for i in range(0,len(bits)-7,8):
        b=0
        for j in range(8): b=(b<<1)|bits[i+j]
        w.append(b)
    return w
if __name__=="__main__":
    text, lvl = sys.argv[1], sys.argv[2]
    json.dump([{"text":text,"level":lvl}], open("one.json","w"))
    m=json.loads(subprocess.check_output(["node","qrgen.js","one.json"]).decode())[0]
    got=read(m["rows"], m["version"], m["mask"])
    dump=json.loads(subprocess.check_output(["node","qrdbg2.js",text,lvl]).decode())
    want=[int(x,16) for x in dump["words"]]
    print("mine, expected  :", " ".join(format(b,'02X') for b in want))
    print("mine, read back :", " ".join(format(b,'02X') for b in got[:len(want)]))
    print("self-consistent :", got[:len(want)]==want)
    ref=segno.make(text,error=lvl.lower(),mode='byte',micro=False,boost_error=False)
    rrows=["".join('1' if b else '0' for b in row) for row in ref.matrix]
    sg=read(rrows, ref.version, ref.mask)
    print("segno, read back:", " ".join(format(b,'02X') for b in sg[:len(want)]))
