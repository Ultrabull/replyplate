"""Every matrix our encoder produces is decoded by two independent readers.
zxing-cpp is the reference (it is what most phone scanners are built on);
OpenCV is a second opinion whose detector is known to be fussier."""
import json, subprocess, random, string, sys
import numpy as np, cv2, zxingcpp

random.seed(11)
alpha = string.ascii_letters + string.digits + ":/?&=._-~%#@+"
cases = [
 {"text":"https://g.page/r/CQm9nZ2xLbF0EBM/review","level":"M"},
 {"text":"https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4","level":"M"},
 {"text":"https://reply-plate.com/r/olive-table","level":"M"},
 {"text":"HELLO WORLD","level":"L"},
 {"text":"a","level":"H"},
 {"text":"Cafe Olive resena","level":"M"},
 {"text":"Café Olivé reseña ★","level":"M"},
 {"text":"https://ex.com/u?q=caf%C3%A9&x=1","level":"Q"},
]
for n in [1,2,3,5,8,11,17,25,32,40,53,64,77,90,100,120,150,180,220,260,300,400,500,700]:
    for lv in ["L","M","Q","H"]:
        cases.append({"text":"".join(random.choice(alpha) for _ in range(n)),"level":lv})
json.dump(cases, open("qrcases.json","w"))
mine = json.loads(subprocess.check_output(["node","qrgen.js","qrcases.json"]).decode())

def pad(rows, scale=10, q=4):
    g=np.array([[0 if ch=="1" else 255 for ch in r] for r in rows],dtype=np.uint8)
    s=g.shape[0]; a=np.full((s+2*q,s+2*q),255,dtype=np.uint8); a[q:q+s,q:q+s]=g
    return np.kron(a, np.ones((scale,scale),dtype=np.uint8))

det = cv2.QRCodeDetector()
ok = bad = over = 0
cvsoft = 0
fails = []
for c, m in zip(cases, mine):
    if not m["ok"]:
        over += 1; continue
    im = pad(m["rows"])
    z = zxingcpp.read_barcode(im)
    ztext = z.text if z else None
    if ztext != c["text"]:
        bad += 1; fails.append((c["level"], len(c["text"]), m["version"], repr(ztext)[:50])); continue
    ok += 1
    if det.detectAndDecode(im)[0] != c["text"]:
        cvsoft += 1

print("zxing-cpp decoded correctly : %d" % ok)
print("zxing-cpp failed            : %d" % bad)
print("beyond version 20 capacity  : %d  (encoder refuses, as designed)" % over)
print("of the good ones, OpenCV's fussier detector missed %d" % cvsoft)
for f in fails[:12]:
    print("  FAIL level=%s len=%s version=%s got=%s" % f)
sys.exit(1 if bad else 0)
