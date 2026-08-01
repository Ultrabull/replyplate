/* Minimal QR encoder, byte mode, versions 1 to 20.

   Why this exists rather than a library or an image service: the review code is
   the one thing an owner prints a thousand times. It cannot depend on a CDN
   staying up, and sending a client's review link to somebody else's server to
   have a picture made is a needless leak. This runs entirely in the page.

   The error-correction block table and the alignment-pattern table below were
   generated from a reference implementation rather than typed by hand, because a
   single wrong number produces a code that looks perfect and does not scan.
   See qr-verify: every matrix this produces is compared bit for bit against an
   independent encoder.

   Usage:  QR.encode("https://example.com", "M")  ->  {size, modules: [[0|1]]}
*/
window.QR = (function () {
  "use strict";

  /* [version-1][ecLevel] = [ecCodewordsPerBlock, [[blockCount, dataCodewords], ...]] */
  var ECB = [[[7,[[1,19]]],[10,[[1,16]]],[13,[[1,13]]],[17,[[1,9]]]],[[10,[[1,34]]],[16,[[1,28]]],[22,[[1,22]]],[28,[[1,16]]]],[[15,[[1,55]]],[26,[[1,44]]],[18,[[2,17]]],[22,[[2,13]]]],[[20,[[1,80]]],[18,[[2,32]]],[26,[[2,24]]],[16,[[4,9]]]],[[26,[[1,108]]],[24,[[2,43]]],[18,[[2,15],[2,16]]],[22,[[2,11],[2,12]]]],[[18,[[2,68]]],[16,[[4,27]]],[24,[[4,19]]],[28,[[4,15]]]],[[20,[[2,78]]],[18,[[4,31]]],[18,[[2,14],[4,15]]],[26,[[4,13],[1,14]]]],[[24,[[2,97]]],[22,[[2,38],[2,39]]],[22,[[4,18],[2,19]]],[26,[[4,14],[2,15]]]],[[30,[[2,116]]],[22,[[3,36],[2,37]]],[20,[[4,16],[4,17]]],[24,[[4,12],[4,13]]]],[[18,[[2,68],[2,69]]],[26,[[4,43],[1,44]]],[24,[[6,19],[2,20]]],[28,[[6,15],[2,16]]]],[[20,[[4,81]]],[30,[[1,50],[4,51]]],[28,[[4,22],[4,23]]],[24,[[3,12],[8,13]]]],[[24,[[2,92],[2,93]]],[22,[[6,36],[2,37]]],[26,[[4,20],[6,21]]],[28,[[7,14],[4,15]]]],[[26,[[4,107]]],[22,[[8,37],[1,38]]],[24,[[8,20],[4,21]]],[22,[[12,11],[4,12]]]],[[30,[[3,115],[1,116]]],[24,[[4,40],[5,41]]],[20,[[11,16],[5,17]]],[24,[[11,12],[5,13]]]],[[22,[[5,87],[1,88]]],[24,[[5,41],[5,42]]],[30,[[5,24],[7,25]]],[24,[[11,12],[7,13]]]],[[24,[[5,98],[1,99]]],[28,[[7,45],[3,46]]],[24,[[15,19],[2,20]]],[30,[[3,15],[13,16]]]],[[28,[[1,107],[5,108]]],[28,[[10,46],[1,47]]],[28,[[1,22],[15,23]]],[28,[[2,14],[17,15]]]],[[30,[[5,120],[1,121]]],[26,[[9,43],[4,44]]],[28,[[17,22],[1,23]]],[28,[[2,14],[19,15]]]],[[28,[[3,113],[4,114]]],[26,[[3,44],[11,45]]],[26,[[17,21],[4,22]]],[26,[[9,13],[16,14]]]],[[28,[[3,107],[5,108]]],[26,[[3,41],[13,42]]],[30,[[15,24],[5,25]]],[28,[[15,15],[10,16]]]]];

  /* Alignment-pattern centre coordinates, indexed by version-1. */
  var ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90]];

  var LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  /* The two bits that go into the format information, which are not the same as
     the ordering above. L=01, M=00, Q=11, H=10. */
  var LEVEL_BITS = [1, 0, 3, 2];

  /* ---- GF(256) arithmetic, primitive polynomial 0x11d ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function genPoly(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= poly[j] ? EXP[(LOG[poly[j]] + i) % 255] : 0;
      }
      poly = next;
    }
    return poly;
  }

  function ecBytes(data, n) {
    var gen = genPoly(n), res = data.slice().concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coef = res[i];
      if (!coef) continue;
      var lc = LOG[coef];
      for (var j = 0; j < gen.length; j++) res[i + j] ^= gen[j] ? EXP[(LOG[gen[j]] + lc) % 255] : 0;
    }
    return res.slice(data.length);
  }

  /* ---- data encoding ---- */
  function utf8(str) {
    var out = [], s = encodeURIComponent(str);
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "%") { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else out.push(s.charCodeAt(i));
    }
    return out;
  }

  function totalDataCodewords(v, ec) {
    var spec = ECB[v - 1][ec], n = 0;
    spec[1].forEach(function (g) { n += g[0] * g[1]; });
    return n;
  }

  function pickVersion(byteLen, ec) {
    for (var v = 1; v <= 20; v++) {
      var lenBits = v < 10 ? 8 : 16;
      var needed = Math.ceil((4 + lenBits + byteLen * 8) / 8);
      if (needed <= totalDataCodewords(v, ec)) return v;
    }
    return null;
  }

  function buildCodewords(bytes, v, ec) {
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);                                   // byte mode
    push(bytes.length, v < 10 ? 8 : 16);          // character count
    bytes.forEach(function (b) { push(b, 8); });

    var cap = totalDataCodewords(v, ec) * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);   // terminator
    while (bits.length % 8) bits.push(0);
    var words = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      words.push(b);
    }
    var pad = [0xec, 0x11], p = 0;
    while (words.length < cap / 8) words.push(pad[p++ % 2]);

    /* Split into blocks, then interleave data and error words as the spec requires. */
    var spec = ECB[v - 1][ec], ecw = spec[0];
    var dataBlocks = [], ecBlocks = [], at = 0;
    spec[1].forEach(function (g) {
      for (var k = 0; k < g[0]; k++) {
        var blk = words.slice(at, at + g[1]); at += g[1];
        dataBlocks.push(blk);
        ecBlocks.push(ecBytes(blk, ecw));
      }
    });
    var out = [], maxData = Math.max.apply(null, dataBlocks.map(function (b) { return b.length; }));
    for (var c = 0; c < maxData; c++) {
      for (var b2 = 0; b2 < dataBlocks.length; b2++) {
        if (c < dataBlocks[b2].length) out.push(dataBlocks[b2][c]);
      }
    }
    for (var c2 = 0; c2 < ecw; c2++) {
      for (var b3 = 0; b3 < ecBlocks.length; b3++) out.push(ecBlocks[b3][c2]);
    }
    return out;
  }

  /* ---- matrix ---- */
  function newMatrix(size) {
    var m = [], r = [];
    for (var i = 0; i < size; i++) {
      m.push(new Int8Array(size).fill(-1));   // -1 = free, 0/1 = set
      r.push(new Uint8Array(size));           // 1 = function pattern, do not mask
    }
    return { m: m, r: r, size: size };
  }

  function placeFinder(M, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= M.size || cc >= M.size) continue;
        var inner = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                    (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        M.m[rr][cc] = inner ? 1 : 0;
        M.r[rr][cc] = 1;
      }
    }
  }

  function placeFunctions(M, v) {
    var size = M.size;
    placeFinder(M, 0, 0); placeFinder(M, 0, size - 7); placeFinder(M, size - 7, 0);

    for (var i = 8; i < size - 8; i++) {          // timing
      var bit = i % 2 === 0 ? 1 : 0;
      M.m[6][i] = bit; M.r[6][i] = 1;
      M.m[i][6] = bit; M.r[i][6] = 1;
    }

    var pos = ALIGN[v - 1], last = pos.length - 1;
    for (var a = 0; a < pos.length; a++) {
      for (var b = 0; b < pos.length; b++) {
        /* Only the three finder corners are skipped. Testing "is this module
           already reserved" instead wrongly drops the patterns that sit on the
           timing row and column, which breaks every code from version 7 up. */
        if ((a === 0 && b === 0) || (a === 0 && b === last) || (a === last && b === 0)) continue;
        var pr = pos[a], pc = pos[b];
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            M.m[pr + dr][pc + dc] = on ? 1 : 0;
            M.r[pr + dr][pc + dc] = 1;
          }
        }
      }
    }

    M.m[size - 8][8] = 1; M.r[size - 8][8] = 1;   // always-dark module

    /* Reserve the format areas so data placement skips them. The second copy is
       8 modules long, not 9: reserving one extra steals a data module and every
       codeword after it lands in the wrong place. */
    function reserve(r, c) { if (!M.r[r][c]) { M.r[r][c] = 1; M.m[r][c] = 0; } }
    for (var k = 0; k <= 8; k++) { reserve(8, k); reserve(k, 8); }
    for (var k2 = 0; k2 < 8; k2++) { reserve(8, size - 1 - k2); reserve(size - 1 - k2, 8); }

    if (v >= 7) {
      var vi = versionInfo(v);
      for (var n = 0; n < 18; n++) {
        var bitv = (vi >> n) & 1, r1 = Math.floor(n / 3), c1 = size - 11 + (n % 3);
        M.m[r1][c1] = bitv; M.r[r1][c1] = 1;
        M.m[c1][r1] = bitv; M.r[c1][r1] = 1;
      }
    }
  }

  function versionInfo(v) {
    var d = v << 12, rem = d;
    for (var i = 0; i < 6; i++) {
      if (rem >> (17 - i) & 1) rem ^= 0x1f25 << (5 - i);
    }
    return d | rem;
  }

  function formatInfo(ec, mask) {
    var d = (LEVEL_BITS[ec] << 3) | mask, rem = d << 10;
    for (var i = 0; i < 5; i++) {
      if (rem >> (14 - i) & 1) rem ^= 0x537 << (4 - i);
    }
    return ((d << 10) | rem) ^ 0x5412;
  }

  function placeFormat(M, ec, mask) {
    var f = formatInfo(ec, mask), size = M.size, i;
    function bit(n) { return (f >> n) & 1; }

    /* First copy. Bits 0 to 8 run UP column 8 beside the top-left finder, then
       bits 9 to 14 run LEFT along row 8. Getting these two axes the wrong way
       round produces a code that looks right and reads as the wrong mask. */
    for (i = 0; i <= 5; i++) M.m[i][8] = bit(i);
    M.m[7][8] = bit(6);
    M.m[8][8] = bit(7);
    M.m[8][7] = bit(8);
    for (i = 9; i < 15; i++) M.m[8][14 - i] = bit(i);

    /* Second copy: bits 0 to 7 along row 8 from the right edge, bits 8 to 14
       down column 8 from the bottom edge. */
    for (i = 0; i < 8; i++) M.m[8][size - 1 - i] = bit(i);
    for (i = 8; i < 15; i++) M.m[size - 15 + i][8] = bit(i);

    M.m[size - 8][8] = 1;
  }

  function maskFn(n, r, c) {
    switch (n) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
    }
  }

  function placeData(M, words) {
    var size = M.size, bitIdx = 0, up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                       // the vertical timing column is skipped
      for (var i = 0; i < size; i++) {
        var row = up ? size - 1 - i : i;
        for (var j = 0; j < 2; j++) {
          var c = col - j;
          if (M.r[row][c]) continue;
          var bit = 0;
          if (bitIdx < words.length * 8) bit = (words[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
          M.m[row][c] = bit;
        }
      }
      up = !up;
    }
  }

  function applyMask(M, n) {
    var out = [];
    for (var r = 0; r < M.size; r++) {
      out.push(new Int8Array(M.size));
      for (var c = 0; c < M.size; c++) {
        out[r][c] = M.r[r][c] ? M.m[r][c] : (M.m[r][c] ^ (maskFn(n, r, c) ? 1 : 0));
      }
    }
    return out;
  }

  /* The four penalty rules from the spec. Lower is better. */
  function penalty(g, size) {
    var p = 0, r, c, i;
    for (r = 0; r < size; r++) {
      for (var dir = 0; dir < 2; dir++) {
        var run = 1, prev = dir ? g[0][r] : g[r][0];
        for (i = 1; i < size; i++) {
          var v = dir ? g[i][r] : g[r][i];
          if (v === prev) { run++; }
          else { if (run >= 5) p += run - 2; run = 1; prev = v; }
        }
        if (run >= 5) p += run - 2;
      }
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var a = g[r][c];
        if (a === g[r][c + 1] && a === g[r + 1][c] && a === g[r + 1][c + 1]) p += 3;
      }
    }
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function scan(get) {
      for (var s = 0; s + 11 <= size; s++) {
        var m1 = true, m2 = true;
        for (var k = 0; k < 11; k++) {
          var val = get(s + k);
          if (val !== pat1[k]) m1 = false;
          if (val !== pat2[k]) m2 = false;
        }
        if (m1) p += 40;
        if (m2) p += 40;
      }
    }
    for (r = 0; r < size; r++) {
      (function (rr) { scan(function (x) { return g[rr][x]; }); })(r);
      (function (cc) { scan(function (x) { return g[x][cc]; }); })(r);
    }
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += g[r][c];
    var pct = (dark * 100) / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  function encode(text, level) {
    var ec = LEVELS[(level || "M").toUpperCase()];
    if (ec === undefined) ec = LEVELS.M;
    var bytes = utf8(String(text == null ? "" : text));
    var v = pickVersion(bytes.length, ec);
    if (!v) throw new Error("Too much text for a QR code this size. Use a shorter link.");

    var words = buildCodewords(bytes, v, ec);
    var size = v * 4 + 17;
    var M = newMatrix(size);
    placeFunctions(M, v);
    placeData(M, words);

    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      var g = applyMask(M, mask);
      /* Format bits differ per mask, so they must be written before scoring. */
      var tmp = { m: g, r: M.r, size: size };
      placeFormat(tmp, ec, mask);
      var s = penalty(g, size);
      if (s < bestScore) { bestScore = s; best = g; bestMask = mask; }
    }
    var modules = [];
    for (var r = 0; r < size; r++) modules.push(Array.prototype.slice.call(best[r]));
    return { size: size, version: v, mask: bestMask, level: (level || "M").toUpperCase(), modules: modules };
  }

  /* Renders to an SVG string. Vector, so it stays sharp at any print size, which
     matters because the same file gets used on a receipt and on a window sticker. */
  function svg(text, opts) {
    opts = opts || {};
    var q = encode(text, opts.level || "M");
    var quiet = opts.quiet == null ? 4 : opts.quiet;       // the spec asks for 4 modules
    var total = q.size + quiet * 2;
    var dark = opts.dark || "#000000", light = opts.light || "#ffffff";
    var d = "";
    for (var r = 0; r < q.size; r++) {
      for (var c = 0; c < q.size; c++) {
        if (q.modules[r][c]) d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
      '<path d="' + d + '" fill="' + dark + '"/></svg>';
  }

  return { encode: encode, svg: svg };
})();
