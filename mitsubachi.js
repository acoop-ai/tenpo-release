/* >>> mitsubachi 0.3.1・正の印 90ba258c78c4・mitsubachi.js の写し（_共通\ミツバチ から make_copies.py が書く・手で直さない） <<< */
/* ミツバチの共通部品 0.3.1（段0・2026-11-24／0.3.0＝待ちのハチが 8 の字に飛ぶ・0.3.1＝8 の字で奥へ行って手前へ戻る・2026-11-25）— 正はこのファイル（Desktop\ClaudeCode\_共通\ミツバチ\mitsubachi.js）
   - 各システムは版を作るときに make_copies.py で写す（手で直さない・動いている最中に読みに行かない）。写しが正と同じかは check_copies.py で数える。
   - 絵は2案だけ: B もふはち（既定）・C むぎわらはち。使う人が選ぶ（setStyle・ブラウザに覚える。覚えられない端末でも B で動く）。
   - 画像ファイル・外の読み込みなし（通信が切れても絵は崩れない）。絵は部品の中で SVG の字を組む。外から来た値は絵に入れない（案・角度・大きさは決まった物だけ受ける）。
   - 字（案内の文）は textContent で入れる（HTML として働かない）。見た目は mitsubachi.css。style の属性を書かない（CSP の style-src 'self' の画面でも動く）。
   - 動きは Web Animations（transform と opacity だけ）。端末の「動きを減らす」・setMotion(false) のときは止めた絵（動きを作らない）。
   - 待ちのハチは、横長の 8 の字（ミツバチの 8 の字ダンスの形）を 1 周 3.6 秒で飛ぶ。進む方へ向き（左へ進むときは左右を返す）、羽ばたきは2枚の絵の切り替え（0.3.0）。
     0.3.1: モックと同じく、右の輪で奥へ行き（小さく・少し淡く・影は小さく奥へ）、左の輪で手前へ戻る（大きく・はっきり・影は大きく手前へ）。大きさ 0.70〜1.15 倍。
   - 待ちは delay（既定 0.3 秒）までに終われば何も作らない＝速い操作には一切の重さが乗らない。
   - 質感のフィルタ・鉛筆の線は既定で外す（重さを測って決めた: 提案書 V1「6 速さと守り」）。 */
(function (G) {
  'use strict';
  var VERSION = '0.3.1';
  var CHEEK = '#F08A78', DARK = '#2A170A';
  var own = function (o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); };
  var STYLES = {
    B: { name: 'もふはち', label: 'もふ', fur: ['#FFE4A8', '#F2B84C', '#D88C2E'], line: '#6E4520', lw: 1.4, stripe: '#4A2E16', hatchCol: '#A86A18', hatch: .6,
      eye: 'bead', mouth: 'w', fuzz: 2.6, neck: 'ruff', hat: false, tip: 'heart', cheekR: 5, blush: true, disp: 1.8, wash: .22, grain: .28, holes: false },
    C: { name: 'むぎわらはち', label: 'むぎわら', fur: ['#FFF2A8', '#FFD04A', '#EFA62C'], line: '#5A3616', lw: 2.3, stripe: '#3E2712', hatchCol: '#C0841C', hatch: .3,
      eye: 'mid', mouth: 'smile', fuzz: 0, neck: 'scarf', hat: true, tip: 'ball', cheekR: 4.2, blush: false, disp: 2.6, wash: .18, grain: .36, holes: true }
  };
  var KEYS = ['B', 'C'];
  /* 小さい所（24〜32px）: B の毛と細い線はつぶれるので、毛を外し線を太くする（色と顔は B のまま）。C は線が太いのでそのまま */
  var SMALL = { B: { fuzz: 0, lw: 2, blush: false, mouthW: 1.9 } };
  /* 既定（重さを測って決めた）: 案 B・質感なし・鉛筆の線なし・待ちは「その場で羽ばたく1匹」 */
  var DEF = { style: 'B', tex: false, flat: true };
  var S = STYLES.B, U = 'mb0', FLAT = true;
  var uidN = 0;
  function f(n) { return +(+n).toFixed(2); }
  function bandH(cx, cy, rx, ry, y1, y2, sag) {
    function hw(y) { var t = (y - cy) / ry; return rx * Math.sqrt(Math.max(0, 1 - t * t)); }
    var h1 = hw(y1) * .97, h2 = hw(y2) * .97;
    return 'M' + f(cx - h1) + ' ' + f(y1) + 'Q' + f(cx) + ' ' + f(y1 + sag) + ' ' + f(cx + h1) + ' ' + f(y1) + 'L' + f(cx + h2) + ' ' + f(y2) + 'Q' + f(cx) + ' ' + f(y2 + sag) + ' ' + f(cx - h2) + ' ' + f(y2) + 'Z';
  }
  function bandV(cx, cy, rx, ry, x1, x2, sag) {
    function hh(x) { var t = (x - cx) / rx; return ry * Math.sqrt(Math.max(0, 1 - t * t)) * .97; }
    var a = hh(x1), b = hh(x2);
    return 'M' + f(x1) + ' ' + f(cy - a) + 'Q' + f(x1 + sag) + ' ' + f(cy) + ' ' + f(x1) + ' ' + f(cy + a) + 'L' + f(x2) + ' ' + f(cy + b) + 'Q' + f(x2 + sag) + ' ' + f(cy) + ' ' + f(x2) + ' ' + f(cy - b) + 'Z';
  }
  function el(cx, cy, rx, ry, fill, extra) { return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function ln(d, w, col, extra) { return '<path d="' + d + '" fill="none" stroke="' + (col || S.line) + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '/>'; }
  function fuzzE(cx, cy, rx, ry, n, amp) {
    var d = '';
    for (var i = 0; i <= n; i++) {
      var a = i / n * 2 * Math.PI, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      if (i === 0) { d = 'M' + f(x) + ' ' + f(y); continue; }
      var m = (i - .5) / n * 2 * Math.PI;
      d += 'Q' + f(cx + (rx + amp) * Math.cos(m)) + ' ' + f(cy + (ry + amp) * Math.sin(m)) + ' ' + f(x) + ' ' + f(y);
    }
    return d + 'Z';
  }
  function geo(cx, cy, rx, ry, n) { return S.fuzz ? 'path d="' + fuzzE(cx, cy, rx, ry, n, S.fuzz) + '"' : 'ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '"'; }
  function u(id) { return 'url(#' + U + id + ')'; }
  function blobFill(g) { return '<' + g + ' fill="' + u('gf') + '"/>' + (FLAT ? '' : '<' + g + ' fill="' + u('h') + '" mask="' + u('hk') + '"/>'); }
  function blobLine(g) { return '<' + g + ' fill="none" stroke="' + S.line + '" stroke-width="' + S.lw + '" stroke-linejoin="round"/>'; }
  function rot(r, x, y) { return r ? ' transform="rotate(' + r + ' ' + x + ' ' + y + ')"' : ''; }
  function head(H) {
    var g = geo(H.x, H.y, H.rx, H.ry, 26), hx = H.x - H.rx * .36, hy = H.y - H.ry * .52;
    return blobFill(g) + blobLine(g) + el(hx, hy, H.rx * .3, H.ry * .14, '#fff', ' fill-opacity=".55"' + rot(-24, f(hx), f(hy)));
  }
  function bodyF(b) {
    var cx = b[0], cy = b[1], rx = b[2], ry = b[3], g = geo(cx, cy, rx, ry, 14);
    return '<g' + rot(b[4], cx, cy) + '>' +
      '<path d="M' + f(cx - 1.7) + ' ' + f(cy + ry - .8) + 'L' + cx + ' ' + f(cy + ry + 4.6) + 'L' + f(cx + 1.7) + ' ' + f(cy + ry - .8) + 'Z" fill="' + S.stripe + '"/>' +
      blobFill(g) +
      '<path d="' + bandH(cx, cy, rx, ry, cy - 5.2, cy - 2.2, 1.3) + '" fill="' + S.stripe + '"/>' +
      '<path d="' + bandH(cx, cy, rx, ry, cy + 1, cy + 4, 1.3) + '" fill="' + S.stripe + '"/>' +
      '<path d="' + bandH(cx, cy, rx, ry, cy + 6.6, cy + 8.4, .9) + '" fill="' + S.stripe + '"/>' +
      blobLine(g) + '</g>';
  }
  function bodyS(b) {
    var cx = b[0], cy = b[1], rx = b[2], ry = b[3], g = geo(cx, cy, rx, ry, 16);
    return '<path d="M' + f(cx - rx + .8) + ' ' + f(cy - 2.6) + 'L' + f(cx - rx - 5.4) + ' ' + f(cy + .4) + 'L' + f(cx - rx + .8) + ' ' + f(cy + 3.2) + 'Z" fill="' + S.stripe + '"/>' +
      ln('M' + f(cx - 6) + ' ' + f(cy + ry - 1) + 'L' + f(cx - 7) + ' ' + f(cy + ry + 4.6) + 'M' + f(cx + 2) + ' ' + f(cy + ry - .5) + 'L' + f(cx + 2) + ' ' + f(cy + ry + 5.5), 2.2, S.stripe) +
      blobFill(g) +
      '<path d="' + bandV(cx, cy, rx, ry, cx - 10, cx - 6.8, -1.5) + '" fill="' + S.stripe + '"/>' +
      '<path d="' + bandV(cx, cy, rx, ry, cx - 3, cx + .2, -1.5) + '" fill="' + S.stripe + '"/>' +
      '<path d="' + bandV(cx, cy, rx, ry, cx + 4, cx + 6.4, -1.5) + '" fill="' + S.stripe + '"/>' +
      blobLine(g);
  }
  function arms(b) {
    return el(b[0] - b[2] - .4, b[1] - 3, 2.3, 3.4, S.stripe, rot(25, f(b[0] - b[2] - .4), f(b[1] - 3))) +
      el(b[0] + b[2] + .4, b[1] - 3, 2.3, 3.4, S.stripe, rot(-25, f(b[0] + b[2] + .4), f(b[1] - 3)));
  }
  function neck(n) {
    if (!S.neck) return '';
    var x = n[0], y = n[1], rx = n[2], ry = n[3];
    if (S.neck === 'ruff') {   // えりまき（B）。小さい所では毛を外した楕円
      var d = S.fuzz ? 'path d="' + fuzzE(x, y, rx, ry, 16, 2.4) + '"' : 'ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(rx + 1.2) + '" ry="' + f(ry + 1.2) + '"';
      return '<' + d + ' fill="#FFF4D8" stroke="' + S.line + '" stroke-width="' + f(S.lw * .85) + '" stroke-linejoin="round"' + rot(n[4], x, y) + '/>' +
        (FLAT ? '' : '<' + d + ' fill="' + u('h') + '" mask="' + u('hk') + '" fill-opacity=".5"' + rot(n[4], x, y) + '/>');
    }
    var s = '<g' + rot(n[4], x, y) + '>' + el(x, y, rx, ry, '#4E9A5B', ' stroke="' + S.line + '" stroke-width="' + f(S.lw * .8) + '"') +
      '<circle cx="' + f(x - rx * .5) + '" cy="' + f(y + .6) + '" r=".9" fill="#fff" fill-opacity=".85"/><circle cx="' + f(x) + '" cy="' + f(y + 1.4) + '" r=".9" fill="#fff" fill-opacity=".85"/><circle cx="' + f(x + rx * .5) + '" cy="' + f(y + .6) + '" r=".9" fill="#fff" fill-opacity=".85"/>';
    if (n[5] !== 'none') {
      var kx = n[5] === 'back' ? x : x + rx * .62, ky = y + ry * .6;
      s += '<path d="M' + f(kx) + ' ' + f(ky) + 'L' + f(kx - 3.4) + ' ' + f(ky + 6) + 'L' + f(kx + .6) + ' ' + f(ky + 5) + 'ZM' + f(kx) + ' ' + f(ky) + 'L' + f(kx + 4.6) + ' ' + f(ky + 5) + 'L' + f(kx + 1.4) + ' ' + f(ky + 6.6) + 'Z" fill="#4E9A5B" stroke="' + S.line + '" stroke-width="' + f(S.lw * .7) + '" stroke-linejoin="round"/>' +
        '<circle cx="' + f(kx) + '" cy="' + f(ky) + '" r="1.8" fill="#3F8550" stroke="' + S.line + '" stroke-width="' + f(S.lw * .6) + '"/>';
    }
    return s + '</g>';
  }
  function hat(H, r) {
    var cx = H.x, by = H.y - H.ry * .6, w = H.rx, cw = w * .56, ch = w * .5;
    var brimD = 'ellipse cx="' + f(cx) + '" cy="' + f(by) + '" rx="' + f(w * 1.14) + '" ry="' + f(w * .28) + '"';
    var crownD = 'path d="M' + f(cx - cw) + ' ' + f(by) + 'C' + f(cx - cw) + ' ' + f(by - ch * 1.28) + ' ' + f(cx + cw) + ' ' + f(by - ch * 1.28) + ' ' + f(cx + cw) + ' ' + f(by) + 'Z"';
    return '<g' + rot(r, cx, H.y) + '>' +
      '<' + brimD + ' fill="' + u('gs') + '" stroke="' + S.line + '" stroke-width="' + f(S.lw * .85) + '"/><' + brimD + ' fill="' + u('st') + '"/>' +
      '<' + crownD + ' fill="' + u('gs') + '" stroke="' + S.line + '" stroke-width="' + f(S.lw * .85) + '" stroke-linejoin="round"/><' + crownD + ' fill="' + u('st') + '"/>' +
      '<path d="M' + f(cx - cw) + ' ' + f(by - .6) + 'Q' + f(cx) + ' ' + f(by + 2.6) + ' ' + f(cx + cw) + ' ' + f(by - .6) + 'L' + f(cx + cw * .96) + ' ' + f(by - 5) + 'Q' + f(cx) + ' ' + f(by - 2) + ' ' + f(cx - cw * .96) + ' ' + f(by - 5) + 'Z" fill="#D9573F" stroke="' + S.line + '" stroke-width="' + f(S.lw * .6) + '" stroke-linejoin="round"/>' +
      '</g>';
  }
  function heart(x, y, s) { return 'M' + f(x) + ' ' + f(y + s * .95) + 'C' + f(x - s * 1.7) + ' ' + f(y - s * .1) + ' ' + f(x - s * .95) + ' ' + f(y - s * 1.35) + ' ' + f(x) + ' ' + f(y - s * .4) + 'C' + f(x + s * .95) + ' ' + f(y - s * 1.35) + ' ' + f(x + s * 1.7) + ' ' + f(y - s * .1) + ' ' + f(x) + ' ' + f(y + s * .95) + 'Z'; }
  function tip(x, y) {
    if (S.tip === 'heart') return '<path d="' + heart(x, y, 2.7) + '" fill="' + CHEEK + '" stroke="' + S.line + '" stroke-width=".9"/>';
    return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="2.3" fill="' + S.stripe + '"/><circle cx="' + f(x - .7) + '" cy="' + f(y - .7) + '" r=".7" fill="#fff" fill-opacity=".6"/>';
  }
  function ants(view, H) {
    var x = H.x, y = H.y, L;
    if (view === 'S') L = [[x - 4, y - 20.5, x - 4.5, y - 28.5, x, y - 32.5], [x + 5, y - 20, x + 6.5, y - 28.5, x + 12, y - 31.5]];
    else {
      var l = (view === 'F' || view === 'B') ? [-6.5, 6.5] : [-7.5, 5.5];
      L = [[x + l[0], y - 21.6, x + l[0] - 2.5, y - 28, x + l[0] - 7, y - 30.2], [x + l[1], y - 21.6, x + l[1] + 2.5, y - 28, x + l[1] + 7, y - 30.2]];
    }
    return L.map(function (p) { return ln('M' + f(p[0]) + ' ' + f(p[1]) + 'Q' + f(p[2]) + ' ' + f(p[3]) + ' ' + f(p[4]) + ' ' + f(p[5]), 1.7, S.stripe) + tip(p[4], p[5]); }).join('');
  }
  function eye(x, y, sq) {
    if (S.eye === 'bead') return el(x, y, 2.3 * sq, 2.9, DARK) + '<circle cx="' + f(x - .7 * sq) + '" cy="' + f(y - 1) + '" r=".9" fill="#fff"/>';
    var rx = 3.2 * sq, ry = 4;
    return el(x, y, rx, ry, u('ge'), ' stroke="' + DARK + '" stroke-width=".5"') +
      '<circle cx="' + f(x - rx * .3) + '" cy="' + f(y - ry * .34) + '" r="' + f(rx * .42) + '" fill="#fff"/>' +
      '<circle cx="' + f(x + rx * .36) + '" cy="' + f(y + ry * .46) + '" r="' + f(rx * .2) + '" fill="#fff" fill-opacity=".85"/>';
  }
  function cheek(x, y) {
    var s = '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + S.cheekR + '" fill="' + CHEEK + '" fill-opacity=".48"/>';
    if (S.blush) for (var i = 0; i < 3; i++) s += ln('M' + f(x - 2.6 + i * 2) + ' ' + f(y + 1.3) + 'L' + f(x - 1.3 + i * 2) + ' ' + f(y - 1.4), .8, '#D8645A', ' stroke-opacity=".75"');
    return s;
  }
  function mouth(x, y, sq, sad) {
    if (sad) return ln('M' + f(x - 2.6 * sq) + ' ' + f(y + 3.2) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + 2.6 * sq) + ' ' + f(y + 3.2), 1.5, DARK);
    if (S.mouth === 'w') return ln('M' + f(x - 3 * sq) + ' ' + f(y) + 'Q' + f(x - 1.5 * sq) + ' ' + f(y + 2.8) + ' ' + f(x) + ' ' + f(y + .4) + 'Q' + f(x + 1.5 * sq) + ' ' + f(y + 2.8) + ' ' + f(x + 3 * sq) + ' ' + f(y), S.mouthW || 1.4, DARK);
    return ln('M' + f(x - 2.8 * sq) + ' ' + f(y) + 'Q' + f(x) + ' ' + f(y + 3.8) + ' ' + f(x + 2.8 * sq) + ' ' + f(y), 1.6, DARK);
  }
  function face(F, sad) {
    var s = '';
    F.c.forEach(function (c) { s += cheek(c[0], c[1]); });
    F.e.forEach(function (e) {
      s += eye(e[0], e[1], e[2]);
      if (sad) { var L = e[0] < F.m[0]; s += ln(L ? 'M' + f(e[0] - 4) + ' ' + f(e[1] - 6.4) + 'L' + f(e[0] + 3) + ' ' + f(e[1] - 8.6) : 'M' + f(e[0] + 4) + ' ' + f(e[1] - 6.4) + 'L' + f(e[0] - 3) + ' ' + f(e[1] - 8.6), 1.5, DARK); }
    });
    return s + mouth(F.m[0], F.m[1], F.m[2], sad);
  }
  function wing(w, op) {
    var cx = w[0], cy = w[1], rx = w[2], ry = w[3];
    return '<g' + rot(w[4], cx, cy) + '>' +
      el(cx, cy, rx, ry, u('gw'), ' fill-opacity="' + op + '" stroke="#8FB2C4" stroke-width="1.1"') +
      ln('M' + f(cx) + ' ' + f(cy + ry * .85) + 'Q' + f(cx - rx * .25) + ' ' + f(cy) + ' ' + f(cx + rx * .1) + ' ' + f(cy - ry * .62), .8, '#9CBDCD', ' stroke-opacity=".8"') +
      ln('M' + f(cx - rx * .08) + ' ' + f(cy + ry * .15) + 'Q' + f(cx + rx * .45) + ' ' + f(cy - ry * .1) + ' ' + f(cx + rx * .55) + ' ' + f(cy - ry * .45), .7, '#9CBDCD', ' stroke-opacity=".7"') +
      el(cx - rx * .32, cy - ry * .36, rx * .22, ry * .3, '#fff', ' fill-opacity=".75"') +
      '</g>';
  }
  /* 羽の角度は1つの絵に1つ（羽ばたきは、角度ちがいの絵を2枚重ねて外側の箱の opacity を切り替える＝絵の描き直しが起きない） */
  var WING = 0;
  function wg(list) { return (list || []).map(function (w) { var a = WING ? 10 : -14; return '<g transform="rotate(' + f(w[0] === 'l' ? a : -a) + ' ' + w[2] + ' ' + w[3] + ')">' + wing(w[1], w[4]) + '</g>'; }).join(''); }
  var POSE = {
    F: { h: [40, 33, 26, 23], b: [40, 65, 12, 10, 0], n: [40, 56, 13, 4.5, 0, 'side'], arms: 1,
      wb: [['l', [17, 19, 7.5, 13, -36], 32, 30, .85], ['r', [63, 19, 7.5, 13, 36], 48, 30, .85]],
      face: { e: [[30, 36, 1], [50, 36, 1]], c: [[22.6, 43.6], [57.4, 43.6]], m: [40, 43, 1] }, hr: 0 },
    '3F': { h: [44, 33, 26, 23], b: [36, 66, 12, 10, 14], n: [39, 56.5, 13, 4.5, 8, 'side'],
      wb: [['r', [64, 18, 6.2, 11, 28], 48, 30, .7], ['l', [18, 20, 7.5, 13, -34], 32, 30, .85]],
      face: { e: [[33, 36, 1], [54.5, 35.5, .84]], c: [[26.4, 43.6], [61.4, 43]], m: [45, 43, .95] }, hr: -5 },
    S: { h: [50, 37, 24, 22], side: [22, 60, 15, 10.5], n: [34, 51.5, 4.5, 12, 32, 'none'],
      wb: [['l', [30, 30, 5.6, 11, -18], 30, 44, .5]], wm: [['l', [21, 36, 6.4, 12.5, -30], 24, 48, .88]],
      face: { e: [[59.5, 37, .8]], c: [[53.5, 46]], m: [65, 45.2, .8] }, hr: -8 },
    B: { h: [40, 33, 26, 23], b: [40, 65, 12, 10, 0], n: [40, 56, 13, 4.5, 0, 'back'], back: 1,
      wf: [['l', [15, 38, 8, 14.5, -30], 33, 54, .8], ['r', [65, 38, 8, 14.5, 30], 47, 54, .8]], hr: 0 },
    '3B': { h: [44, 33, 26, 23], b: [36, 66, 12, 10, 14], n: [39, 56.5, 13, 4.5, 8, 'back'], back: 1,
      wf: [['l', [17, 38, 7.8, 14, -28], 34, 54, .8], ['r', [63, 36, 6.2, 11.5, 26], 48, 52, .72]], hr: 5 }
  };
  var VIEWS = ['S', '3F', 'F', '3B', 'B'];
  function compose(view, sad) {
    var P = POSE[view], H = { x: P.h[0], y: P.h[1], rx: P.h[2], ry: P.h[3] };
    var bod = P.side ? bodyS(P.side) : bodyF(P.b), hd = head(H), an = ants(view, H), ht = S.hat ? hat(H, P.hr) : '', nk = neck(P.n);
    if (P.back) {
      var fur = ln('M' + f(H.x - 10) + ' ' + f(H.y - 12) + 'Q' + f(H.x) + ' ' + f(H.y - 18) + ' ' + f(H.x + 10) + ' ' + f(H.y - 12), 1.4, null, ' stroke-opacity=".35"') +
        ln('M' + f(H.x - 14) + ' ' + f(H.y - 3) + 'Q' + f(H.x) + ' ' + f(H.y - 11) + ' ' + f(H.x + 14) + ' ' + f(H.y - 3), 1.4, null, ' stroke-opacity=".3"');
      return hd + fur + ht + an + bod + nk + wg(P.wf);
    }
    return wg(P.wb) + bod + (P.arms ? arms(P.b) : '') + wg(P.wm) + nk + hd + face(P.face, sad) + ht + an +
      (sad ? '<path d="M' + f(H.x + 22) + ' ' + f(H.y - 17) + 'q-3.4 5 0 7.4q3.4-2.4 0-7.4z" fill="#8BD3F5" fill-opacity=".85"/>' : '');
  }
  /* 質感（にじみ・紙の粒）＝モックの見た目。重いので既定は「なし」（tex:true のときだけ） */
  function filt() {
    var w = S.wash, k = S.grain, wo = f(1 - w * .5), ko = f(1 - k * .55);
    return '<filter id="' + U + 'P" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="w"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="w" scale="' + S.disp + '" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="11" result="w0"/>' +
      '<feColorMatrix in="w0" type="matrix" values="' + w + ' 0 0 0 ' + f(wo + .04) + '  ' + w + ' 0 0 0 ' + f(wo + .02) + '  ' + w + ' 0 0 0 ' + wo + '  0 0 0 0 1" result="wash"/>' +
      '<feComposite in="wash" in2="d" operator="in" result="wi"/>' +
      '<feBlend in="d" in2="wi" mode="multiply" result="m"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="g0"/>' +
      '<feColorMatrix in="g0" type="matrix" values="' + k + ' 0 0 0 ' + ko + '  ' + k + ' 0 0 0 ' + ko + '  ' + k + ' 0 0 0 ' + ko + '  0 0 0 0 1" result="gr"/>' +
      '<feComposite in="gr" in2="m" operator="in" result="gi"/>' +
      '<feBlend in="m" in2="gi" mode="multiply" result="t"/>' +
      (S.holes ? '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="h0"/>' +
        '<feColorMatrix in="h0" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -1.3" result="hm"/>' +
        '<feComposite in="t" in2="hm" operator="in"/>' : '') +
      '</filter>';
  }
  function defs(tex) {
    return '<defs>' +
      '<radialGradient id="' + U + 'gf" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="' + S.fur[0] + '"/><stop offset=".55" stop-color="' + S.fur[1] + '"/><stop offset="1" stop-color="' + S.fur[2] + '"/></radialGradient>' +
      '<radialGradient id="' + U + 'ge" cx=".5" cy=".75" r=".65"><stop offset="0" stop-color="#8A5428"/><stop offset="1" stop-color="' + DARK + '"/></radialGradient>' +
      '<linearGradient id="' + U + 'gw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8FCFD"/><stop offset="1" stop-color="#C6DEEB"/></linearGradient>' +
      (S.hat ? '<linearGradient id="' + U + 'gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7DE98"/><stop offset="1" stop-color="#DAAA55"/></linearGradient>' +
        '<pattern id="' + U + 'st" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0 1H2" stroke="#A87A30" stroke-width=".45" stroke-opacity=".55"/></pattern>' : '') +
      (FLAT ? '' : '<pattern id="' + U + 'h" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0V2.6" stroke="' + S.hatchCol + '" stroke-width=".8" stroke-opacity="' + S.hatch + '"/></pattern>' +
        '<linearGradient id="' + U + 'hm" x1=".15" y1=".15" x2=".9" y2=".95"><stop offset=".3" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
        '<mask id="' + U + 'hk" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="' + u('hm') + '"/></mask>') +
      (tex ? filt() : '') + '</defs>';
  }
  function styleKey(k) { return own(STYLES, k) ? k : getStyle(); }
  /* 1つの角度の絵（SVG の字）。o: {style:'B'|'C', mood:'sad', wing:0|1, small:true, tex:true, flat:false}。id は絵ごとに変える（同じ id の絵を並べても色が混ざらない） */
  function svg(view, o) {
    o = o || {};
    if (!own(POSE, view)) view = 'F';   /* 決まった角度だけ（外から来た値を絵に入れない） */
    var key = styleKey(o.style);
    S = STYLES[key];
    if (o.small && own(SMALL, key)) { var x = {}, k; for (k in S) if (own(S, k)) x[k] = S[k]; for (k in SMALL[key]) if (own(SMALL[key], k)) x[k] = SMALL[key][k]; S = x; }
    U = 'mb' + (++uidN) + '_';
    FLAT = o.flat == null ? DEF.flat : !!o.flat;
    var tex = o.tex == null ? DEF.tex : !!o.tex;
    WING = o.wing ? 1 : 0;
    var inner = compose(view, o.mood === 'sad');
    return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-mb-style="' + key + '">' + defs(tex) +
      (tex ? '<g filter="' + u('P') + '">' + inner + '</g>' : inner) + '</svg>';
  }

  /* ---------- 設定: 絵の案・動き（どちらもブラウザに覚える。覚えられない端末でも、開いている間は効く） ---------- */
  function store() { try { return G.localStorage; } catch (e) { return null; } }
  function read(key) { try { var s = store(); return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function write(key, v) { try { var s = store(); if (s) s.setItem(key, v); } catch (e) { /* 覚えられない端末 */ } }
  var STYLE_KEY = 'mitsubachi_style', MOTION_KEY = 'mitsubachi_motion';
  var styleForced = null, motionForced = null;
  var styleFns = [];
  function getStyle() { var v = styleForced != null ? styleForced : read(STYLE_KEY); return own(STYLES, v) ? v : DEF.style; }
  function setStyle(k) {
    if (!own(STYLES, k)) return false;
    styleForced = k; write(STYLE_KEY, k);
    styleFns.slice().forEach(function (fn) { try { fn(k); } catch (e) { /* 聞き手の失敗で止めない */ } });
    return true;
  }
  function onStyle(fn) { if (typeof fn === 'function') styleFns.push(fn); }
  function styleList() { return KEYS.map(function (k) { return { key: k, name: STYLES[k].name, label: STYLES[k].label }; }); }
  var mq = G.matchMedia ? G.matchMedia('(prefers-reduced-motion: reduce)') : null;
  /* 端末の「動きを減らす」がオンか（止まって見える訳を、選ぶ所に1行で出すため） */
  function deviceReduced() { return !!(mq && mq.matches); }
  var motionFns = [];   // 動きの設定が変わったら呼ぶ（選ぶ所の1行）
  function motionOn() {
    var v = motionForced != null ? motionForced : read(MOTION_KEY);
    if (v === 'off') return false;
    if (mq && mq.matches) return false;   // 端末の「動きを減らす」に従う
    return true;
  }
  var live = [];   // いま出ている待ちのカード（設定が変わったら、止める・動かす）
  function forget(h) { var i = live.indexOf(h); if (i >= 0) live.splice(i, 1); }
  function syncMotion() { var on = motionOn(); live.slice().forEach(function (h) { h.motion(on); }); motionFns.slice().forEach(function (fn) { try { fn(on); } catch (e) { /* 聞き手の失敗で止めない */ } }); }
  function setMotion(on) { motionForced = on ? 'on' : 'off'; write(MOTION_KEY, motionForced); syncMotion(); }
  if (mq) { try { mq.addEventListener('change', syncMotion); } catch (e) { try { mq.addListener(syncMotion); } catch (e2) { /* 古い端末 */ } } }
  try { G.addEventListener('storage', function (e) { if (e.key === STYLE_KEY) { styleForced = null; var k = getStyle(); styleFns.slice().forEach(function (fn) { try { fn(k); } catch (x) { } }); } }); } catch (e) { /* 古い端末 */ }

  /* ---------- 部品の組み立て ---------- */
  function E(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  var SIZES = /^s(24|32|48|56|64|96|128)$/;
  /* 止まった絵（1つの角度）。size は CSS の大きさの印（s24・s32・s48・s56・s64・s96・s128）。24・32 は小さい所の形 */
  function bee(o) {
    o = o || {};
    var sz = SIZES.test(o.size) ? o.size : 's48';
    var small = o.small != null ? !!o.small : (sz === 's24' || sz === 's32');
    var w = E('span', 'mb-bee mb-' + sz + (o.halo ? ' mb-halo' : ''));
    w.innerHTML = svg(own(POSE, o.view) ? o.view : 'F', { style: o.style, mood: o.mood === 'sad' ? 'sad' : '', small: small });
    return w;
  }
  function inLive(host) { for (var n = host; n && n.getAttribute; n = n.parentNode) if (n.getAttribute('aria-live') || n.getAttribute('role') === 'status' || n.getAttribute('role') === 'alert') return true; return false; }

  /* 待ち（画面ぜんたいが待つ幕の中のカード）。字が先・蜂は横に添える。
     delay（既定 300ms）までに end() されたら、何も作らない。slowMs（既定 8 秒）で sub に「時間がかかっています」。
     30 秒で止めて理由と「もう一度」を出すのは、呼ぶ側（通信を打ち切る側）が error() で出す。
     o: {text, sub, delay, slowMs, slowText, onShown(box), comb:true（本当の進み具合があるときだけ）, style:'B'|'C'（この1枚だけ案を決める・見本など。省けば選んだ案）}
     返す値 h: end()・stage(字)＝段の字を替えて 8 秒を数え直す・progress(0〜1)・built（作ったか） */
  function wait(host, o) {
    o = o || {};
    var h = { ended: false, built: false, box: null, anims: [], timers: [], start: null, still: null, style: own(STYLES, o.style) ? o.style : null };
    var delay = o.delay == null ? 300 : Math.max(0, +o.delay || 0);
    var slowMs = o.slowMs == null ? 8000 : +o.slowMs;
    function slowLater() {
      h.timers.push(setTimeout(function () { if (!h.ended && h.sub) { h.sub.textContent = o.slowText || '時間がかかっています（通信を確かめています）…'; h.box.classList.add('mb-slow'); } }, slowMs));
    }
    function build() {
      if (h.ended) return;
      var box = h.box = E('div', 'mb-wait' + (o.comb ? ' mb-wait-comb' : ''));
      if (!inLive(host)) { box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); }
      if (o.comb) buildComb(box, h); else buildHover(box, h);
      var tx = box.appendChild(E('div', 'mb-wtxt'));
      h.cap = tx.appendChild(E('div', 'mb-cap', o.text || '読み込んでいます…'));
      h.sub = tx.appendChild(E('div', 'mb-sub', o.sub || ''));
      host.appendChild(box);
      h.built = true;
      h.motion(motionOn());
      live.push(h);
      slowLater();
      if (o.onShown) o.onShown(box);
    }
    h.motion = function (on) {
      if (!h.box) return;
      h.box.classList.toggle('mb-still', !on);
      if (!on && h.still) h.still();   // 止まった絵（正面の1枚）は、止めるときに作る
      if (on && !h.anims.length && h.start) h.anims = h.start();
      if (!on) { h.anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* 古い端末 */ } }); h.anims = []; }
    };
    h.stage = function (t) {
      o.text = t;
      if (!h.box) return;
      h.cap.textContent = t; h.sub.textContent = o.sub || ''; h.box.classList.remove('mb-slow');
      h.timers.forEach(clearTimeout); h.timers = []; slowLater();
    };
    h.progress = function (p) { if (h.setP) h.setP(p); };
    h.end = function () {
      if (h.ended) return;
      h.ended = true; h.timers.forEach(clearTimeout); h.timers = [];
      h.anims.forEach(function (a) { try { a.cancel(); } catch (e) { } }); h.anims = [];
      if (h.box && h.box.parentNode) h.box.parentNode.removeChild(h.box);
      forget(h);
    };
    if (delay > 0) h.timers.push(setTimeout(build, delay)); else build();
    return h;
  }
  /* 8 の字に飛ぶ1匹（0.3.0・2026-11-25 PO「ハチが 8 の字に飛んで回る」）。横長の 8 の字（∞・真ん中で交わる）を 1 周 3.6 秒で回る。
     横向きの絵（羽の角度ちがいの2枚を重ね、外側の箱の opacity で羽ばたく）を、進む方へ向け（左へ進むときは左右を返す＝端で向きを変える）、
     上り下りに合わせて少し傾ける。道筋の点は1回だけ作って使い回す。
     0.3.1（2026-11-25 PO「モックのように奥にも移動する立体感がない」）: 提案書のモック（回って飛ぶ）と同じ奥行き＝横 sin u・縦 sin 2u・奥行き cos u。
       真ん中を手前で1回・奥で1回通り、右の輪で奥へ行って、左の輪で手前へ戻る。奥ほど小さく（0.70 倍）・少し淡く（奥の半分だけ・いちばん奥で 0.72）、
       手前ほど大きく（1.15 倍）・はっきり。影は地面の上: 手前では大きく濃く下へ、奥では小さく淡く上へ（遠くの地面は上に見える）。ハチが高い所では影を少し小さく。
       輪の端（右＝奥へ向かう・左＝手前へ向かう）では、横向きの絵を細くして返す代わりに、斜め後ろ（3B）・斜め前（3F）の絵に替えて向きを返す（モックと同じ・横向きの絵は細くならない）。
       動かすのは transform と opacity だけ（絵は描き直さない・羽ばたきは前のまま）。字とは重ならない置き場なので、重なりの順は切り替えない（字を隠さない）。
       重くしない作り: 絵は「3 つの角度（行）× 羽の角度 2 つ（列）」を1枚の版に並べ、窓（はみ出しを切る箱）から1枚だけ見せる。羽ばたき＝版を横へ・角度を替える＝版を縦へずらす
       （どちらも transform の1つの動き）。動きは 飛ぶ箱・影・角度・羽ばたき の 4 つ＝0.3.0 と同じ数（1枚ずつ opacity で切り替えると、絵の数だけ動きが増え、画面の仕事が増えた＝実測）。
     端末の「動きを減らす」なら、飛ぶ絵は隠して正面の止まった絵（0.2.0 と同じ大きさ・置き場） */
  var LOOP = { ms: 3600, n: 48, ax: 40, ay: 14, near: 1.15, far: .70, fade: .72, gz: 6, turn: .65, cell: 80, frames: null };
  var TURN_VIEWS = ['S', '3B', '3F'];                                           // 版の行: 横向き・輪の右の端（奥へ向かう＝斜め後ろ）・輪の左の端（手前へ向かう＝斜め前）
  function loopFrames() {
    if (LOOP.frames) return LOOP.frames;
    var mid = (LOOP.near + LOOP.far) / 2, amp = (LOOP.near - LOOP.far) / 2, P2 = 2 * Math.PI, d = LOOP.turn, C = LOOP.cell;
    var R1 = Math.PI / 2, R2 = 3 * Math.PI / 2;                                // 輪の端（ここで左右を返す）
    var off = function (u) { return +(u / P2).toFixed(5); }, S = 'steps(1,end)', EPS = .0002; // 左右を返すのは 0.7 ミリ秒の間（同じ時刻の点を2つ置かない）
    function at(u, face) {
      var x = LOOP.ax * Math.sin(u), y = LOOP.ay * Math.sin(2 * u), z = Math.cos(u); // 横長の 8 の字（真ん中で交わる）・奥行き（1＝いちばん手前・−1＝いちばん奥）
      var dx = LOOP.ax * Math.cos(u), dy = 2 * LOOP.ay * Math.cos(2 * u);       // 画面の上で進む向き
      var w = clamp(Math.abs(dx) / (LOOP.ax * .5), .45, 1);                    // 輪の端では傾きを弱める
      var tilt = face * w * clamp(Math.atan2(dy, Math.abs(dx) + 1e-6) * 180 / Math.PI, -24, 24); // 下りは頭を下げ、上りは上げる
      var sc = mid + amp * z;                                                  // 奥 0.70 倍 〜 手前 1.15 倍（なめらかに）
      var op = z < 0 ? 1 + (LOOP.fade - 1) * -z : 1;                           // 奥の半分だけ少し淡く（いちばん奥で 0.72）
      var low = (y + LOOP.ay) / (2 * LOOP.ay);                                 // 0＝高い所 〜 1＝低い所（高いほど影は小さい）
      return {
        fly: { offset: off(u), transform: 'translate(' + f(x) + 'px,' + f(y) + 'px) rotate(' + f(tilt) + 'deg) scale(' + f(face * sc) + ',' + f(sc) + ')', opacity: f(op) },
        shadow: { offset: off(u), transform: 'translate(' + f(x) + 'px,' + f(LOOP.gz * z) + 'px) scale(' + f(sc * (.8 + .2 * low)) + ')', opacity: f(.45 + .55 * (z + 1) / 2) }
      };
    }
    // 道筋の点: 1 周を n 等分＋輪の端に2つ（返す前と、0.7 ミリ秒あと＝一瞬で左右を返す。斜めの絵を見せている間なので、横向きの絵は細くならない）
    var fly = [], shadow = [], flips = [[R1, 1, -1], [R2, -1, 1]];
    for (var i = 0; i <= LOOP.n; i++) {
      var u = i / LOOP.n * P2, same = false;
      while (flips.length && flips[0][0] <= u + 1e-9) {
        var fl = flips.shift(), a = at(fl[0], fl[1]).fly, b = at(fl[0], fl[2]).fly; b.offset = +(a.offset + EPS).toFixed(5);
        fly.push(a, b); same = same || Math.abs(fl[0] - u) < 1e-9;
      }
      var p = at(u, u < R1 || u > R2 ? 1 : -1);                                // 右へ進むとき 1・左へ −1
      if (!same) fly.push(p.fly);                                              // 輪の端と同じ点は上の2つで置いた
      shadow.push(p.shadow);                                                   // 影は左右を返さない（等分の点だけ）
    }
    var row = function (k) { return 'translateY(' + (-k * C) + 'px)'; };       // 版の行（0＝横向き・1＝斜め後ろ・2＝斜め前）。替わるのは一瞬（steps）
    var view = [{ offset: 0, transform: row(0), easing: S }, { offset: off(R1 - d), transform: row(1), easing: S }, { offset: off(R1 + d), transform: row(0), easing: S },
      { offset: off(R2 - d), transform: row(2), easing: S }, { offset: off(R2 + d), transform: row(0), easing: S }, { offset: 1, transform: row(0) }];
    var flap = [{ offset: 0, transform: 'translateX(0px)', easing: S }, { offset: .5, transform: 'translateX(' + (-C) + 'px)', easing: S }, { offset: 1, transform: 'translateX(' + (-C) + 'px)' }]; // 羽の角度 2 つを 0.08 秒ずつ
    LOOP.frames = { fly: fly, shadow: shadow, view: view, flap: flap };
    return LOOP.frames;
  }
  function buildHover(box, h) {
    var st = box.appendChild(E('div', 'mb-stage mb-loop'));
    var sh = st.appendChild(E('span', 'mb-shadow'));
    var fly = st.appendChild(E('div', 'mb-fly'));
    var so = h.style || undefined;
    // 窓（はみ出しを切る 80px の箱）＞ 行を替える版（縦にずらす）＞ 羽ばたきの版（横にずらす）＞ 6 枚の絵（3 つの角度 × 羽の角度 2 つ）
    var win = fly.appendChild(E('span', 'mb-win')), rows = win.appendChild(E('span', 'mb-rows')), cols = rows.appendChild(E('span', 'mb-cols'));
    TURN_VIEWS.forEach(function (v, k) {
      [0, 1].forEach(function (w) { var c = cols.appendChild(E('span', 'mb-cell mb-r' + k + ' mb-k' + w)); c.innerHTML = svg(v, { wing: w, style: so }); });
    });
    h.still = function () {
      if (st.querySelector('.mb-rest')) return;
      var r = st.appendChild(E('span', 'mb-rest'));
      r.innerHTML = svg('F', { wing: 0, style: so });
    };
    if (typeof fly.animate !== 'function') { box.classList.add('mb-noanim'); h.still(); return; }
    h.start = function () {
      var fr = loopFrames(), loop = { duration: LOOP.ms, iterations: Infinity };
      return [fly.animate(fr.fly, loop), sh.animate(fr.shadow, loop), rows.animate(fr.view, loop), cols.animate(fr.flap, { duration: 160, iterations: Infinity })];
    };
  }
  /* 本当の進み具合（何件のうち何件）が分かる長い待ちだけ。作り物の進み具合は出さない */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var HC = [[-28, -48], [28, -48], [56, 0], [28, 48], [-28, 48], [-56, 0], [0, 0]].map(function (d) { return [110 + d[0], 95 + d[1]]; });
  function hexPts(cx, cy, r) { return [0, 1, 2, 3, 4, 5].map(function (k) { var a = (-90 + 60 * k) * Math.PI / 180; return f(cx + r * Math.cos(a)) + ',' + f(cy + r * Math.sin(a)); }).join(' '); }
  function buildComb(box, h) {
    var wrap = box.appendChild(E('div', 'mb-comb'));
    wrap.innerHTML = '<svg viewBox="0 0 220 190" aria-hidden="true" focusable="false">' + HC.map(function (c) {
      return '<polygon class="mb-hx" points="' + hexPts(c[0], c[1], 30) + '"/><polygon class="mb-hf" points="' + hexPts(c[0], c[1], 27) + '"/>';
    }).join('') + '</svg>';
    var fills = Array.prototype.slice.call(wrap.querySelectorAll('.mb-hf'));
    var fl = wrap.appendChild(E('span', 'mb-flyer'));
    fl.appendChild(bee({ view: 'F', size: 's32', style: h.style || undefined }));
    var pct = box.appendChild(E('div', 'mb-pct', '0%'));
    var cur = -1;
    function place(i) { var c = HC[i]; fl.style.left = (c[0] / 220 * 100) + '%'; fl.style.top = ((c[1] - 9) / 190 * 100) + '%'; }
    place(0);
    h.setP = function (p) {
      p = clamp(+p || 0, 0, 1);
      fills.forEach(function (n, i) { n.classList.toggle('on', p >= (i + 1) / 7 - 1e-4); });
      var i = Math.min(6, Math.floor(p * 7));
      if (i !== cur) { cur = i; place(i); }
      pct.textContent = Math.round(p * 100) + '%';
    };
  }

  /* エラー（やり直せば直るものだけ＝通信・混雑・30 秒。入力の誤り・権限・保存できていない、には使わない）
     o: {title, text, retryLabel, onRetry(box), closeLabel, onClose(box), size, style}。押した釦はすぐ薄くする（二度押しで2回呼ばない） */
  function error(host, o) {
    o = o || {};
    var box = E('div', 'mb-err');
    box.setAttribute('role', 'alert');
    var b = box.appendChild(bee({ view: 'F', mood: 'sad', size: SIZES.test(o.size) ? o.size : 's64', style: o.style }));
    if (motionOn()) b.classList.add('mb-wob');
    var tx = box.appendChild(E('div', 'mb-txt'));
    tx.appendChild(E('b', 'mb-ttl', o.title || 'つながりませんでした'));
    tx.appendChild(E('div', 'mb-sub', o.text || '電波のよい場所で、もう一度ためしてください。'));
    var acts = E('div', 'mb-acts'), btns = [];
    function add(label, cls, fn) {
      var btn = acts.appendChild(E('button', cls, label));
      btn.type = 'button';
      btn.addEventListener('click', function () { if (btn.disabled) return; btns.forEach(function (x) { x.disabled = true; }); fn(box); });
      btns.push(btn);
    }
    if (typeof o.onRetry === 'function') add(o.retryLabel || 'もう一度ためす', 'mb-btn', o.onRetry);
    if (typeof o.onClose === 'function') add(o.closeLabel || '閉じる', 'mb-btn mb-btn-ghost', o.onClose);
    if (btns.length) tx.appendChild(acts);
    host.appendChild(box);
    return box;
  }
  /* 空（まだ何も無い）。動かさない。次の一手の釦を添える。o: {title, text, actionLabel, onAction, size, style} */
  function empty(host, o) {
    o = o || {};
    var box = E('div', 'mb-empty');
    box.appendChild(bee({ view: '3F', size: SIZES.test(o.size) ? o.size : 's48', style: o.style }));
    var tx = box.appendChild(E('div', 'mb-txt'));
    tx.appendChild(E('b', 'mb-ttl', o.title || 'まだありません'));
    if (o.text) tx.appendChild(E('div', 'mb-sub', o.text));
    if (typeof o.onAction === 'function') {
      var btn = tx.appendChild(E('button', 'mb-btn', o.actionLabel || '次へ'));
      btn.type = 'button';
      btn.addEventListener('click', function () { if (btn.disabled) return; btn.disabled = true; o.onAction(box); });
    }
    host.appendChild(box);
    return box;
  }
  /* できた（大きな区切りだけ・1回だけ跳ねる。中身はすぐ出す＝跳ねるのを待たせない）。段2 から */
  function done(host, o) {
    o = o || {};
    var box = E('div', 'mb-done');
    box.setAttribute('role', 'status');
    var b = box.appendChild(bee({ view: 'F', size: SIZES.test(o.size) ? o.size : 's32' }));
    if (motionOn()) b.classList.add('mb-hop');
    box.appendChild(E('b', 'mb-ttl', o.text || 'できました'));
    host.appendChild(box);
    return box;
  }
  /* 絵の案を選ぶ所（「ハチ：もふ／むぎわら」）。押すとすぐ替わり、この端末に覚える。ほかの所で替えても印がそろう */
  function picker(host, o) {
    o = o || {};
    var box = E('div', 'mb-pick');
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', o.label || 'ハチの絵を選ぶ');
    box.appendChild(E('span', 'mb-pick-label', o.title || 'ハチ：'));
    var btns = KEYS.map(function (k) {
      var b = box.appendChild(E('button', 'mb-pick-btn'));
      b.type = 'button'; b.setAttribute('data-style', k); b.title = STYLES[k].name;
      b.appendChild(bee({ view: 'F', size: 's32', style: k }));
      b.appendChild(E('span', 'mb-pick-name', STYLES[k].label));
      b.addEventListener('click', function () { setStyle(k); });
      return b;
    });
    function paint() { var cur = getStyle(); btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-style') === cur)); }); }
    paint(); onStyle(paint);
    host.appendChild(box);
    /* 止まって見える訳（端末の「動きを減らす」がオンの時だけ1行） */
    var note = E('p', 'mb-pick-note', 'この PC は『動きを減らす』の設定なので、ハチは止まって見えます');
    note.hidden = !deviceReduced();
    host.appendChild(note);
    motionFns.push(function () { note.hidden = !deviceReduced(); });
    return box;
  }

  G.Mitsubachi = { version: VERSION, svg: svg, bee: bee, wait: wait, error: error, empty: empty, done: done, picker: picker,
    getStyle: getStyle, setStyle: setStyle, onStyle: onStyle, styleList: styleList, motionOn: motionOn, setMotion: setMotion, deviceReduced: deviceReduced, views: VIEWS.slice() };
})(window);
