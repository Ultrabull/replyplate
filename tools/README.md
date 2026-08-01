# QR verification harness

`qr.js` writes the review codes that restaurants print thousands of times. A QR
with a wrong bit looks perfect to the eye and does not scan, so it cannot be
checked by looking at it. These scripts check it by machine.

```
pip install zxing-cpp opencv-python-headless numpy segno
node tools/qrgen.js cases.json          # render matrices from qr.js
python3 tools/qrscan.py                 # generate cases, render, decode, report
python3 tools/readback.py "text" M      # read a matrix back to its codewords
```

`qrscan.py` builds around a hundred cases, spanning every error-correction level
and lengths from one character to past the version 20 ceiling, renders each with
`qr.js`, then decodes the result with **zxing-cpp**, the reader most phone
scanners are built on. OpenCV runs as a second opinion; its detector is fussier
and misses a handful of symbols that zxing and real phones read, so it is
reported separately rather than treated as a failure.

`readback.py` unmasks a matrix and reads the codewords out in placement order.
That is what pins down where a fault is: if the codewords read back correctly,
the encoder is right and the problem is elsewhere.

Three real faults were caught this way, none of them visible on screen:

- Format information written on the wrong axis, so the symbol declared the
  wrong mask.
- The reserved format region one module too wide, which stole a data module and
  shifted every codeword after it.
- Alignment patterns skipped wherever they crossed the timing row, which broke
  every code from version 7 upward.
