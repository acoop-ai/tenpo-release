// ステータスの画面（店舗運営/MDの辞書・ステータス化）。形は見本（設計\見本_V1）と同じ。中身は窓口から（店ごとのデータ＝店舗目線の指南書の形）。
// 段1: ログイン → 役目で最初の画面（店＝自店の札・AI のコメント・次の一手・部門の行）。段2: 店の木を裏で先取りして、部門 → 中分類 → クラスへ掘る。
// 信頼境界: 窓口の返事（数・AI のコメントの文・店の名前）は、すべて esc を通して字として出す（HTML として描かない）。
//   利用ガイドの本文だけは、窓口の Guide.html（作る側が書いた物）を HTML として出す（台本・on〜 の属性・javascript: は外してから）。
(function () {
  'use strict';
  var AUTH = window.StoreOpsAuth;
  // 数の有る無し: 窓口の数には null（比べる店が足りない・記録が無い）がある。組み込みの isFinite は null を 0 と見るので、数の型だけを数とする
  var isFinite = function (v) { return typeof v === 'number' && Number.isFinite(v); };   // eslint-disable-line no-shadow-restricted-names
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v, k) { if (!isFinite(v)) return '―'; var neg = v < 0, x = Math.abs(v), s = (k ? x.toFixed(k) : String(Math.round(x))), p = s.split('.'), a = p[0], o = ''; while (a.length > 3) { o = ',' + a.slice(-3) + o; a = a.slice(0, -3); } return (neg ? '−' : '') + a + o + (p[1] ? '.' + p[1] : ''); }
  function sg(d, k) { if (!isFinite(d)) return '―'; var a = Math.abs(d).toFixed(k == null ? 1 : k); return (d > 0.05 ? '+' : d < -0.05 ? '−' : '±') + a; }
  function cls(d) { return d > 0.05 ? 'up' : d < -0.05 ? 'dn' : 'zz'; }

  // ── 中身（ページを開いている間だけ・端末に残さない）
  var ME = null;                 // statusStart の返事（役目・見られる店・要約）
  var SUM = null, TREE = null, TREE_P = null;   // いま見ている店の要約・木（DATA の写し）
  var DATA = {}, CUR = '';                      // 店のコード → { sum, tree, p }（ページを開いている間だけ）
  function useStore(code) { CUR = code; var d = DATA[code] || (DATA[code] = {}); SUM = d.sum || null; TREE = d.tree || null; TREE_P = d.p || null; }
  function N() { return (TREE || SUM || { N: {} }).N; }
  function TX(i) { var d = TREE || SUM, t = d && d.tx; return t ? (Array.isArray(t) ? t[i] : t[String(i)]) : ''; }
  function AX(i) { var d = TREE || SUM, t = d && d.ax; return t ? (Array.isArray(t) ? t[i] : t[String(i)]) : null; }
  function meta() { return (TREE || SUM).meta; }

  // 見る数（指南書と同じ4つ）。pr＝物差し（同じ型の店の中央・エリアの中央・何番目・店の数）の鍵
  var MK = { a: { nm: '売上', u: '千円/日', pr: 'yo' }, q: { nm: '販売数', u: '点/日', pr: 'qyo' }, c: { nm: '来客数', u: '人/日', pr: 'cyo' }, u: { nm: '単価', u: '円', pr: 'uyo' } };
  var LVNM = { 0: '店', 1: '部門', 2: '中分類', 3: '小分類', 4: 'クラス' };
  var KIDNM = { 0: '部門', 1: '中分類', 2: 'クラス' };
  function mname(m, n) { if (m === 'c') return n.lv >= 1 ? '買った人の数' : '来客数'; if (m === 'u') return n.lv >= 1 ? '1人あたり売上' : '客単価'; return MK[m].nm; }
  function mval(n, m) { return m === 'a' ? n.sd : (n.mt && n.mt[m] ? n.mt[m].d : NaN); }
  function pct(r) { return isFinite(r) ? (r - 1) * 100 : NaN; }   // 倍率 → 前年からの増減（%）。数が無ければ NaN（0 にしない）
  function myo(n, m) { return pct(m === 'a' ? n.yo : (n.mt && n.mt[m] ? n.mt[m].yo : NaN)); }
  // ほかの店と比べない店（PO 11/14）: 店ごとのファイルの meta.nc。中央・何番目を、どの段にも出さない
  var NC_NOTE = 'この店は、ほかの店と比べない店です（ほかの店から作る物差しと順位は出しません）。';
  function nc() { var d = TREE || SUM; return !!(d && d.meta && d.meta.nc); }
  function mpr(n, m) { if (nc()) return null; var p = n.pr && n.pr[MK[m].pr]; return p ? { peer: pct(p[0]), area: pct(p[1]), rank: p[2], n: p[3] } : null; }
  /** 下の段（中分類の下は、小分類をはさんでクラス。小分類は一覧の区切り＝PO の答え ⑤A） */
  function kids(n) {
    if (!n.ch) return [];
    var all = N(), out = [];
    n.ch.forEach(function (id) {
      var c = all[id]; if (!c) return;
      if (c.lv === 3) (c.ch || []).forEach(function (k) { if (all[k]) out.push({ n: all[k], id: k, g: c.n }); });
      else out.push({ n: c, id: id });
    });
    return out;
  }
  function hasKids(n) { return !!(n.ch && n.ch.length) && n.lv < 4; }
  function kidsReady(n) { return !hasKids(n) || n.ch.every(function (id) { return N()[id]; }); }

  // ── 見方と戻る（場所の移動と見方の変化を、同じ履歴に積む）
  var S = { view: 'home', path: ['S'], m: 'a' };
  var HIST = [];
  function snap() { return JSON.stringify({ view: S.view, path: S.path, m: S.m, c: CUR, y: window.scrollY }); }
  function go(ch, how) { HIST.push(snap()); if (HIST.length > 200) HIST.shift(); for (var k in ch) S[k] = ch[k]; render(how || {}); }
  function back() { if (!HIST.length) return; var o = JSON.parse(HIST.pop()), y = o.y, c = o.c; delete o.y; delete o.c; for (var k in o) S[k] = o[k]; if (c !== CUR) useStore(c); render({ y: y, msg: '← 元の見方に戻りました' }); }

  // ── 描く
  var main = null;
  function render(how) {
    fhReset();
    $$('#lens button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lens === (S.view === 'status' ? 'home' : S.view))); });
    $('#back').disabled = !HIST.length;
    var h = '';
    if (S.view === 'home' || S.view === 'status') h = viewHome();
    else if (S.view === 'guide') h = viewGuide();
    else if (S.view === 'admin') h = viewAdmin();
    else h = viewLens(S.view);
    main.innerHTML = hero() + h + foot();
    pbar();
    land(how);
    fhSchedule();
  }
  function hero() {
    return '<div class="hero"><label for="q1">' + (ME && ME.role === 'store' ? '困りごと・聞きたいことを入れてください' : '探す（困りごと・店・催事・ナレッジ）') + '</label>' +
      '<div class="row"><input id="q1" type="search" autocomplete="off" placeholder="例: 売場が溢れる" aria-controls="r1"></div>' +
      '<div class="chips">' + (ME && ME.role === 'store' ? ['売場が溢れる', 'ロスが多い', '予約が伸びない', '雨の日', '欠品'] : ['予約が伸びない', '見切り', '節分', '進捗', 'ぎゅうにゅう']).map(function (w) { return '<button type="button" data-q="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>' +
      '<div class="res" id="r1" role="listbox"></div></div>';
  }
  function foot() {
    var m = (TREE || SUM) && meta();
    return '<div class="foot">' + (m && m.per ? '数は ' + esc(m.per.sales[0]) + '〜' + esc(m.per.sales[1]) + '（前年比は直近4週 ' + esc(m.per.yoy[0]) + '〜' + esc(m.per.yoy[1]) + '）' : '') + (ME ? '｜' + esc(ME.email) + '（' + esc(roleLabel()) + '）' : '') + '</div>';
  }
  /** ほかの画面への入口（上の帯の「ほかの画面」）。分析レポートと動画は本部・管理者だけに出す（見られる範囲は、それぞれの窓口が呼び出しのたびに決める） */
  function appLinks() {
    var hq = ME && (ME.role === 'hq' || ME.role === 'admin');
    var L = (hq ? [['reports/', '分析レポート', '結果票・売れ方ロス天気（本部だけ）'], ['video/', 'AI教材の動画', '学ぶ（本部のドメイン）']] : []).concat([['classic/', '前の辞書の画面', '話題の棚・教える・テーマ索引・天気の根拠の図']]);
    return L.map(function (x) { return '<a role="menuitem" href="' + x[0] + '">' + esc(x[1]) + ' ▸<small>' + esc(x[2]) + '</small></a>'; }).join('');
  }
  function roleLabel() { return ME.role === 'store' ? '店・' + (ME.label || '') : ME.role === 'hq' ? '本部' : ME.role === 'admin' ? '管理者' : '役目なし'; }
  function pbar() {
    var c = $('#crumb'), m = $('#metric'), up = $('#upbtn');
    var hqPre = ME && (ME.role === 'hq' || ME.role === 'admin') ? '<button type="button" data-view="home-map">全体の地図</button>' + (CUR ? '<span class="sep">›</span>' : '') : '';
    if ((S.view === 'home' || S.view === 'status') && !CUR && hqPre) {
      c.innerHTML = '<span class="cur">全体の地図</span>'; up.style.visibility = 'hidden'; m.style.display = '';
      m.innerHTML = '<span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + MK[k].nm + '</button>'; }).join('');
      return;
    }
    if ((S.view === 'home' || S.view === 'status') && (SUM || TREE)) {
      c.innerHTML = hqPre + S.path.map(function (id, i) { var n = N()[id]; var nm = n ? n.n : '…'; return (i ? '<span class="sep">›</span>' : '') + (i === S.path.length - 1 ? '<span class="cur">' + esc(nm) + '</span>' : '<button type="button" data-crumb="' + i + '">' + esc(nm) + '</button>'); }).join('');
      up.style.visibility = S.path.length > 1 ? 'visible' : 'hidden';
      m.style.display = '';
      m.innerHTML = '<span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + MK[k].nm + '</button>'; }).join('');
    } else {
      c.innerHTML = '<span class="cur">' + esc({ home: 'いまの様子', guide: '店舗運営/MDの辞書利用ガイド', admin: '更新の状態', month: '今月の型', event: '催事ごと', year: '年間の流れ', dept: '部門ごと', wx: '天気と売れ方' }[S.view] || '') + '</span>';
      up.style.visibility = 'hidden'; m.style.display = 'none';
    }
  }

  function viewHome() {
    if (!ME) return '';
    var hq = ME.role === 'hq' || ME.role === 'admin';
    if (CUR && (SUM || TREE)) return viewNode(N()[S.path[S.path.length - 1]] || N().S);
    if (CUR && DATA[CUR] && DATA[CUR].none) return '<h1 class="vt" id="lvtop">' + esc((ME.names && ME.names[CUR]) || ME.label || ('店 ' + CUR)) + '</h1><div class="box"><p style="margin:0">' + esc(DATA[CUR].none) + '</p></div>';   // 作れない店（閉店・POS なし・明細なし など）
    if (CUR) { ensureTree(); return '<h1 class="vt" id="lvtop">' + esc(storeName(CUR)) + '</h1><div class="hint wait"><span class="spin" aria-hidden="true"></span>この店の数を読み込んでいます…</div>'; }
    if (hq) return viewMap();
    return '<h1 class="vt" id="lvtop">いまの様子</h1><div class="box"><p style="margin:0">' + esc(ME.note || 'このアカウントには、店が結ばれていません。辞書の中身は見られます。') + '</p></div>';
  }
  /** 本部: 全体の地図（全社の札 → AI のコメント → 次の一手 → エリアごとの店の札 → くわしく＝店の一覧の表）。店の並びは正の並び（部門損益検討表の順） */
  function mapYo(o, m) { return o.m && o.m[m] ? pct(o.m[m].yo) : NaN; }
  function viewMap() {
    var M = ME.map, m = S.m;
    if (!M) return '<h1 class="vt" id="lvtop">全体の地図<small>' + esc(roleLabel()) + '</small></h1><div class="box"><p style="margin:0">' + esc(ME.note || '全体の地図は、いま準備中です。') + '</p></div>' + (ME.role === 'admin' ? '<div class="nx"><button type="button" data-view="admin">更新の状態を見る ▸</button></div>' : '');
    var stores = []; M.areas.forEach(function (a) { a.stores.forEach(function (s) { stores.push(s); }); });
    var below = stores.filter(function (s) { return mapYo(s, m) < 0; }).length;
    var h = '<h1 class="vt" id="lvtop">全体の地図<small>全社 → エリア → 店｜' + stores.length + '店' + (M.note ? '｜' + esc(M.note) : '') + '</small></h1>';
    var tl = ['a', 'q', 'c', 'u'].map(function (k) { var d = mapYo(M.co, k); return tile({ nm: k === 'c' ? '来客数' : k === 'u' ? '客単価' : MK[k].nm, u: MK[k].u, v: num(M.co.m[k].d, 0), yy: d, g: d, m: k, sel: m === k }); });
    tl.push(tile({ nm: '前年を下回った店', u: '店', v: below + '<small>店</small>', sub: stores.length + '店のうち（' + MK[m].nm + '）' }));
    tl.push(tile({ nm: 'ロス率', u: '%', v: num(M.co.ls, 1) + '<small>%</small>', sub: '売上の重みをつけた計' }));
    h += '<div class="tiles">' + tl.join('') + '</div>';
    if (ME.role === 'admin') h += '<div class="adm"><h3>更新の状態（管理者だけ）</h3><p style="margin:0">中身の年月 ' + esc(M.ym) + '・店 ' + stores.length + '｜<button type="button" class="hbtn" data-view="admin">ファイルと名簿の数を見る ▸</button></p></div>';
    // ほかの店と比べない店（nc）は、いちばん下がった・伸びた店の比べに入れない
    var srt = stores.filter(function (s) { return isFinite(mapYo(s, m)) && !s.nc; }).sort(function (a, b) { return mapYo(a, m) - mapYo(b, m); });
    if (srt.length) {
      var w = srt[0], b = srt[srt.length - 1];
      h += '<div class="ai"><div class="hd">AI のコメント</div><dl><dt>結果</dt><dd>' + esc('全社の' + MK[m].nm + 'は、前年より ' + sg(mapYo(M.co, m)) + '%（直近4週）。前年を下回った店は ' + stores.length + '店のうち ' + below + '店。いちばん下がったのは' + w.nm + '（' + sg(mapYo(w, m)) + '%）、いちばん伸びたのは' + b.nm + '（' + sg(mapYo(b, m)) + '%）。') + '</dd>' +
        '<dt>なぜ</dt><dd>店の差は、記録だけでは見分けられません。考えられるのは、①まわりの様子（住宅地・道路沿い・農村）と客数の動き ②品ぞろえと売場 ③広告の量と効き ④天気（雨の多い週か）。</dd>' +
        '<dt>すること</dt><dd>' + esc('下回った店のうち、' + w.nm + 'から見る（店のステータスの AI のコメントと次の一手）。同じ型でうまくやれている店の売り方と並べ、店の型ごとに次にすることを決める。') + '</dd></dl></div>' +
        '<div class="nx"><b>次の一手</b>: <button type="button" data-store="' + esc(w.c) + '">' + esc(w.nm + 'を開いて、どの部門で下がったかを見る') + ' ▸</button></div>';
    }
    h += '<h2 class="sec" id="dig">全体の地図 — エリアと店</h2><div class="mlg"><span>店の札の色＝' + esc(MK[m].nm) + 'の前年からの増減:</span><span><i style="background:#1d5fbf"></i>+3% より多い</span><span><i style="background:#7aa7e3"></i>0〜+3%</span><span><i style="background:#eba59c"></i>0〜−3%</span><span><i style="background:#c0392b"></i>−3% より少ない</span></div><div class="areas">';
    M.areas.forEach(function (a) {
      h += '<div class="area"><div class="ah">' + esc(a.nm) + ' <span class="zz" style="font-size:13px;font-weight:400">' + a.stores.length + '店</span></div><div class="stores">' + a.stores.map(function (s) {
        var d = mapYo(s, m), c = !isFinite(d) ? '' : d > 3 ? 'u2' : d >= 0 ? 'u1' : d >= -3 ? 'd1' : 'd2';
        return '<button type="button" class="st ' + c + '" data-store="' + esc(s.c) + '" title="押すと、' + esc(s.nm) + 'のステータスが開きます' + (s.nc ? '（ほかの店と比べない店）' : '') + '"><div class="sn">' + esc(s.nm) + (s.nc ? ' <small class="nctag">比べない</small>' : '') + '</div><div class="sv ' + cls(d) + '">' + sg(d) + '%</div><div class="sv zz">' + num(s.m[m] ? s.m[m].d : NaN, m === 'a' ? 1 : 0) + esc(MK[m].u) + '</div></button>';
      }).join('') + '</div></div>';
    });
    h += '</div><div class="hint">店の札を押すと、その店のステータス（店 → 部門 → 中分類 → クラス）が開きます。</div>';
    var rows = stores.map(function (s) { return '<tr><td>' + esc(s.nm) + '</td><td>' + esc(s.ar || '') + '</td><td>' + esc(s.ty || '') + '</td>' + ['a', 'q', 'c', 'u'].map(function (k) { var d = mapYo(s, k); return '<td class="n ' + cls(d) + '">' + sg(d) + '%</td>'; }).join('') + '<td class="n">' + num(s.ls, 1) + '</td><td class="n">' + num(s.adL, 2) + '</td><td class="n">' + sg(s.rain) + '%</td></tr>'; }).join('');
    h += '<details class="det" id="d-list"><summary>店の一覧の表（本部だけ・店の名前つき）</summary><div>' + table(['店', 'エリア', 'まわりの様子', '売上', '販売数', '来客数', '客単価', 'ロス率（%）', '広告の効き（倍）', '強い雨の日の来客'], rows, stores.length > 10) + '</div></details>';
    return h;
  }
  function storeName(code) { return (ME.names && ME.names[code]) || (DATA[code] && (DATA[code].sum || DATA[code].tree) ? (DATA[code].sum || DATA[code].tree).meta.st.nm : '店 ' + code); }
  function viewNode(n) {
    var st = meta().st, h = '', hq = ME.role === 'hq' || ME.role === 'admin';
    h += '<h1 class="vt" id="lvtop">' + esc(n.lv === 0 ? n.n + 'のいま' : n.n) + '<small>' + esc(LVNM[n.lv]) + '｜' + esc(st.ar || '') + '・' + esc(st.ty || '') + (n.lv ? '｜' + esc(st.nm) : '') + '</small>' +
      (hq && n.lv === 0 ? '<button type="button" class="hbtn" data-view="home-map" style="margin-left:auto">← 全体の地図へ</button>' : '') + '</h1>';
    h += tiles(n) + aiBox(n) + drill(n) + details(n);
    return h;
  }
  function ruleTxt(peer, area, rank, cnt, fmt, lowGood) {
    if (nc()) return '';   // ほかの店と比べない店は、物差しの行を出さない
    var f = fmt || function (v) { return sg(v) + '%'; };
    var s = isFinite(peer) ? '同じ型の店の中央 <b>' + esc(f(peer)) + '</b>' : isFinite(area) ? 'エリアの中央 <b>' + esc(f(area)) + '</b>' : '';
    if (rank && cnt) s += '｜エリア' + cnt + '店で<b>' + rank + '番目</b>' + (lowGood ? '（少ない順）' : '');
    return s;
  }
  function gauge(d, md) {
    if (!isFinite(d)) return '';
    var R = 15, x = Math.max(-R, Math.min(R, d)), pos = 50 + x / R * 50;
    var bar = d >= 0 ? 'left:50%;width:' + (pos - 50) + '%;background:#5b8fd6' : 'left:' + pos + '%;width:' + (50 - pos) + '%;background:#e07a6e';
    var mk = isFinite(md) ? '<span class="m" style="left:' + (50 + Math.max(-R, Math.min(R, md)) / R * 50) + '%"></span>' : '';
    return '<div class="gauge" aria-hidden="true"><i style="' + bar + '"></i><span class="z"></span>' + mk + '</div>';
  }
  function tile(o) {
    return '<div class="tile' + (o.sel ? ' sel' : '') + '"' + (o.m ? ' role="button" tabindex="0" data-m="' + o.m + '" title="押すと、見る数が「' + esc(o.nm) + '」に替わります"' : '') + '>' +
      '<div class="nm"><span>' + esc(o.nm) + '</span><span>' + (o.u ? '（' + esc(o.u) + '）' : '') + '</span></div><div class="v">' + o.v + '</div>' +
      (o.yy != null ? '<div class="yy ' + cls(o.yy) + '">前年より ' + sg(o.yy) + '%</div>' : o.sub ? '<div class="yy zz">' + esc(o.sub) + '</div>' : '') +
      (o.g != null ? gauge(o.g, o.gm) : '') + (o.rule ? '<div class="rule">' + o.rule + '</div>' : '') + '</div>';
  }
  function tiles(n) {
    var o = [], ms = n.lv === 0 ? ['a', 'c', 'u'] : ['a', 'q', 'c', 'u'];
    ms.forEach(function (m) {
      var p = mpr(n, m), d = myo(n, m), v = mval(n, m);
      o.push({ nm: mname(m, n), u: MK[m].u, v: num(v, m === 'a' && v < 100 ? 1 : 0), yy: d, g: d, gm: p ? (isFinite(p.peer) ? p.peer : p.area) : NaN, rule: p ? ruleTxt(p.peer, p.area, p.rank, p.n) : '', m: m, sel: S.m === m });
    });
    if (n.ls) o.push({ nm: 'ロス率', u: '%', v: num(n.ls[2], 1) + '<small>%</small>', sub: '見切り ' + n.ls[0] + '%・廃棄 ' + n.ls[1] + '%', rule: ruleTxt(n.lp ? n.lp[0] : NaN, n.lp ? n.lp[1] : NaN, n.lr ? n.lr[0] : 0, n.lr ? n.lr[1] : 0, function (v) { return v.toFixed(1) + '%'; }, true) });
    if (n.lv === 0 && n.ad) o.push({ nm: '広告の効き', u: '倍', v: num(n.ad.L, 2) + '<small>倍</small>', sub: '特売の日の販売数 ÷ ふだん（' + num(n.ad.nc) + '件）' });
    if (n.lv === 0 && n.wxs && n.wxs.c && n.wxs.c[1]) { var w = n.wxs.c[1]; o.push({ nm: '強い雨の日', u: '来客', v: sg(w[0]) + '<small>%</small>', sub: 'ふだんの同じ曜日との差', rule: ruleTxt(w[1], w[2], 0, 0) }); }
    return '<div class="tiles' + (o.length <= 4 ? ' t4' : '') + '">' + o.map(tile).join('') + '</div><div class="hint">札を押すと「見る数」が替わります｜青＝前年より多い・赤＝少ない（「+」「−」も付けています）' + (nc() ? '｜' + esc(NC_NOTE) : '｜紫の点線＝物差し（同じ型の店の中央か、エリアの中央）') + '</div>';
  }
  function aiBox(n) {
    var a = n.ai && n.ai[S.m]; if (!a) return '';
    var nx = (a[3] || []).map(AX).filter(Boolean);
    var first = nx[0];
    return '<div class="ai"><div class="hd">AI のコメント</div><dl><dt>結果</dt><dd>' + esc(TX(a[0])) + '</dd><dt>なぜ</dt><dd>' + esc(TX(a[1])) + '</dd><dt>すること</dt><dd>' + esc(TX(a[2])) + '</dd></dl></div>' +
      (first ? '<div class="nx"><b>次の一手</b>: ' + esc(TX(first[0])) + '<ul style="margin:.2rem 0 0 1.1rem;padding:0">' + first[1].map(function (i) { return '<li>' + esc(TX(i)) + '</li>'; }).join('') + '</ul>' +
        (nx.length > 1 ? '<div class="hint" style="margin-top:4px">ほかの一手: ' + nx.slice(1, 4).map(function (x) { return esc(TX(x[0])); }).join('／') + '</div>' : '') + '</div>' : '');
  }
  function drill(n) {
    if (!hasKids(n)) return '<h2 class="sec" id="dig">掘り下げる</h2><div class="drill"><div class="hint">いちばん下の段（クラス）です。</div></div>';
    if (!kidsReady(n)) { ensureTree(); return '<h2 class="sec" id="dig">掘り下げる</h2><div class="drill"><div class="hint wait"><span class="spin" aria-hidden="true"></span>この店の中の数を読み込んでいます…</div></div>'; }
    var k = kids(n), m = S.m, pd = myo(n, m);
    var vals = k.map(function (x) { return myo(x.n, m); }).filter(isFinite);
    var R = Math.min(30, Math.max(10, Math.ceil(Math.max.apply(null, vals.concat([isFinite(pd) ? pd : 0]).map(Math.abs)) / 5) * 5));
    var pos = function (d) { return 50 + Math.max(-R, Math.min(R, d)) / R * 50; };
    var lastG = null, rows = '';
    k.forEach(function (x) {
      if (x.g && x.g !== lastG) { lastG = x.g; rows += '<div class="grp">' + esc(x.g) + '</div>'; }
      var d = myo(x.n, m), p = pos(d), b = !isFinite(d) ? '' : d >= 0 ? '<i class="u" style="left:50%;width:' + (p - 50) + '%"></i>' : '<i class="d" style="left:' + p + '%;width:' + (50 - p) + '%"></i>';
      var cut = Math.abs(d) > R ? '<span class="cut ' + cls(d) + '" style="' + (d > 0 ? 'right:0' : 'left:0') + '">' + (d > 0 ? '›' : '‹') + '</span>' : '';
      var leaf = !hasKids(x.n);
      rows += '<button type="button" class="drow' + (leaf ? ' leaf' : '') + '" data-drill="' + esc(x.id) + '" title="押すと、' + esc(x.n.n) + 'の中が開きます"><span class="n"><span class="ar">' + (leaf ? '・' : '▶') + '</span><span>' + esc(x.n.n) + '</span></span>' +
        '<span class="val">' + num(mval(x.n, m), m === 'a' ? 1 : 0) + '</span><span class="bar" aria-hidden="true"><span class="zl"></span>' + (isFinite(pd) ? '<span class="pl" style="left:' + pos(pd) + '%"></span>' : '') + b + cut + '</span><span class="pct ' + cls(d) + '">' + sg(d) + '%</span></button>';
    });
    return '<h2 class="sec" id="dig">掘り下げる — ' + esc(KIDNM[n.lv] || 'クラス') + 'ごと</h2><div class="drill"><div class="lg"><span>' + esc(mname(m, k[0].n)) + '（' + esc(MK[m].u) + '）と、前年からの増減</span><span><i style="background:#5b8fd6"></i>前年より多い</span><span><i style="background:#e07a6e"></i>少ない</span><span><i style="border-left:2px dashed #7c3aed;width:0"></i>' + esc(n.n) + '全体（' + sg(pd) + '%）</span><span>目盛りの端 ±' + R + '%</span></div>' + rows + '</div>' +
      '<div class="hint">行を押すと、その中が開きます。戻るときは、上の「1段上へ」か「← ひとつ前に戻る」。</div>';
  }
  function details(n) {
    var h = '';
    if (hasKids(n) && kidsReady(n)) {
      var k = kids(n);
      var head = ['名前', '売上（千円/日）', '前年より', '販売数（点/日）', '前年より', (n.lv >= 0 ? '買った人（人/日）' : '来客数'), '前年より', '1人あたり（円）', '前年より', 'ロス率（%）'];
      var rows = k.map(function (x) { return '<tr><td>' + esc(x.n.n) + '</td>' + ['a', 'q', 'c', 'u'].map(function (m) { var d = myo(x.n, m); return '<td class="n">' + num(mval(x.n, m), m === 'a' ? 1 : 0) + '</td><td class="n ' + cls(d) + '">' + sg(d) + '%</td>'; }).join('') + '<td class="n">' + (x.n.ls ? num(x.n.ls[2], 1) : '―') + '</td></tr>'; }).join('');
      h += '<details class="det" id="d-kids"><summary>' + esc(KIDNM[n.lv] || 'クラス') + 'ごとの表</summary><div>' + table(head, rows, k.length > 10) + '</div></details>';
    }
    var rr = ['a', 'q', 'c', 'u'].map(function (m) { var p = mpr(n, m), d = myo(n, m); return p ? '<tr><td>' + esc(mname(m, n)) + '（前年より）</td><td class="n ' + cls(d) + '">' + sg(d) + '%</td><td class="n">' + sg(p.peer) + '%</td><td class="n">' + sg(p.area) + '%</td><td class="n">' + p.rank + ' / ' + p.n + '</td></tr>' : ''; }).join('');
    if (nc()) rr = '';
    if (n.ls && n.lp && !nc()) rr += '<tr><td>ロス率</td><td class="n">' + num(n.ls[2], 1) + '%</td><td class="n">' + num(n.lp[0], 1) + '%</td><td class="n">' + num(n.lp[1], 1) + '%</td><td class="n">' + (n.lr ? n.lr[0] + ' / ' + n.lr[1] + '（少ない順）' : '―') + '</td></tr>';
    if (n.wxs && n.wxs.c && !nc()) ['ふつうの雨', '強い雨'].forEach(function (t, i) { var w = n.wxs.c[i]; if (w) rr += '<tr><td>' + t + 'の日の来客（ふだんとの差）</td><td class="n ' + cls(w[0]) + '">' + sg(w[0]) + '%</td><td class="n">' + sg(w[1]) + '%</td><td class="n">' + sg(w[2]) + '%</td><td class="n">―</td></tr>'; });
    if (nc()) h += '<p class="hint nc" id="d-cmp-nc">' + esc(NC_NOTE) + '</p>';
    else if (rr) h += '<details class="det" id="d-cmp"><summary>ほかの店と比べる（中央と何番目か）</summary><div><div class="hint">ほかの店の名前と数は出しません（窓口がこの店の分だけを返します）。同じ型の店の中央は、同じ型の店が3店以上のときだけ。</div>' + table(['見る数', 'この店', '同じ型の店の中央', 'エリアの中央', 'エリアで何番目'], rr, false) + '</div></details>';
    h += lazyDet('d-dow', '曜日', 'dow') + lazyDet('d-hour', '時間帯（曜日 × 時刻）', 'hour') + lazyDet('d-wx', '天気（雨の日）', 'wx') + lazyDet('d-loss', 'ロス（見切り・廃棄）', 'loss') + lazyDet('d-ad', '広告（特売の日）', 'ad') + lazyDet('d-md', '52週MD', 'md');
    h += '<details class="det" id="d-read"><summary>数の読み方</summary><div><ul><li>売上・販売数・来客数は1日あたり。前年より＝直近4週を前年の同じ4週と比べた増減。</li><li>部門より下の来客数は「その分類を1つでも買ったレシートの数」（足し算にならない）。単価: 店＝客単価・部門より下＝1人あたり売上。</li><li>AI のコメントは、この段の数を決まった読み方で文にした物です。新しい数は作りません。原因は1つに決めず、考えられる物を並べます。</li></ul></div></details>';
    return h;
  }
  // ── くわしく（はじめ閉じる・開いたときに描く＝閉じた箱の中身を毎回作らない）
  function lazyDet(id, title, kind) { return '<details class="det" id="' + id + '" data-lazy="' + kind + '"><summary>' + esc(title) + '</summary><div class="lz"></div></details>'; }
  var DOWS = ['月', '火', '水', '木', '金', '土', '日'], DOW8 = ['月', '火', '水', '木', '金', '土', '日', '祝'];
  function figt(t) { return '<p class="figt">' + esc(t) + '</p>'; }
  function bars(vals, labs, o) {   // 縦の棒（同じ目盛り・0 か基準の線から）。o: { base, fmt, mark〈比べる相手の値の並び〉, unit }
    var W = Math.max(320, labs.length * 58), H = 190, pad = 34, base = o.base || 0, fin = vals.concat(o.mark || []).filter(isFinite);
    if (!fin.length) return '<p class="hint">数がありません。</p>';
    var lo = Math.min(base, Math.min.apply(null, fin)), hi = Math.max(base, Math.max.apply(null, fin)), rg = (hi - lo) || 1; lo -= rg * 0.08; hi += rg * 0.12;
    var y = function (v) { return 18 + (H - pad - 18) * (1 - (v - lo) / (hi - lo)); }, bw = (W - 40) / labs.length;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.title || '図') + '" data-u="' + esc(o.unit || '') + '"><line x1="30" x2="' + (W - 6) + '" y1="' + y(base) + '" y2="' + y(base) + '" stroke="#334155" stroke-width="1.5"/>';
    vals.forEach(function (v, i) {
      var x = 34 + i * bw, top = Math.min(y(v), y(base)), hgt = Math.abs(y(v) - y(base));
      if (isFinite(v)) s += '<rect x="' + (x + bw * 0.18) + '" y="' + top + '" width="' + (bw * 0.64) + '" height="' + Math.max(1, hgt) + '" rx="3" fill="' + (v >= base ? '#5b8fd6' : '#e07a6e') + '"/><text x="' + (x + bw / 2) + '" y="' + (v >= base ? top - 4 : top + hgt + 13) + '" font-size="12" text-anchor="middle" fill="#1f2933">' + esc(o.fmt(v)) + '</text>';
      if (o.mark && isFinite(o.mark[i])) s += '<line x1="' + (x + bw * 0.1) + '" x2="' + (x + bw * 0.9) + '" y1="' + y(o.mark[i]) + '" y2="' + y(o.mark[i]) + '" stroke="#7c3aed" stroke-width="2" stroke-dasharray="4 3"/>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - 12) + '" font-size="13" text-anchor="middle" fill="#334155">' + esc(labs[i]) + '</text>';
    });
    return '<div class="yr">' + s + '</svg></div>';
  }
  var LAZY = {
    dow: function (n) {
      var m = S.m, v = m === 'a' ? n.dw : (n.dwm && n.dwm[m]);
      if (!v) return '<p class="hint">この段には、曜日の数がありません。</p>';
      return figt('曜日の指数（' + mname(m, n) + '・ふだん＝1.00・倍）') + bars(v, DOWS, { base: 1, fmt: function (x) { return x.toFixed(2); }, mark: m === 'a' ? n.da : null, unit: '倍', title: '曜日の指数' }) +
        '<p class="hint">青＝ふだんより多い曜日・赤＝少ない曜日。' + (m === 'a' && n.da ? '紫の点線＝エリアの同じ段の指数。' : '') + '作る量・発注・人の手当ては、曜日の型に合わせて決める（祝日・行事の日は別に考える）。</p>';
    },
    hour: function (n) {
      var m = S.m === 'u' ? 'a' : S.m, H = n.h && n.h[m];
      if (!H) return '<p class="hint">この段には、時間帯の数がありません。</p>';
      var hrs = meta().hrs || [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], div = m === 'a' ? 1000 : 1, u = m === 'a' ? '千円' : m === 'q' ? '点' : '人';
      var max = 0; H.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
      var rows = H.map(function (r, i) { var pk = r.indexOf(Math.max.apply(null, r)); return '<tr><td>' + DOW8[i] + '</td>' + r.map(function (v, j) { var a = max ? v / max : 0; return '<td class="n" style="background:rgba(29,95,191,' + (a * 0.55).toFixed(2) + ');' + (a > 0.6 ? 'color:#fff;' : '') + (j === pk ? 'font-weight:800;' : '') + '">' + num(v / div, m === 'a' ? 1 : 0) + '</td>'; }).join('') + '</tr>'; }).join('');
      return (S.m === 'u' ? '<p class="hint">単価は時間帯の数がないので、売上で見せています。</p>' : '') + figt('時間帯ごとの' + mname(m, n) + '（1日あたり・' + u + '）') + table(['曜日'].concat(hrs.map(function (x) { return x + '時'; })), rows, false) +
        '<p class="hint">色の濃い所ほど多い。太字＝その曜日でいちばん多い時刻（峰）。峰の前に主力を並べ、峰のあとは作る量を絞る。</p>';
    },
    wx: function (n) {
      var k = S.m === 'u' ? 'u' : S.m, W = n.wxs && n.wxs[k];
      if (!W) return '<p class="hint">この段には、雨の日の数がありません。</p>';
      var rows = ['ふつうの雨（10mm 以上）', '強い雨（30mm 以上）'].map(function (t, i) { var w = W[i]; return w ? '<tr><td>' + t + '</td><td class="n ' + cls(w[0]) + '">' + sg(w[0]) + '%</td>' + (nc() ? '' : '<td class="n">' + sg(w[1]) + '%</td><td class="n">' + sg(w[2]) + '%</td>') + '</tr>' : ''; }).join('');
      return figt('雨の日の' + mname(S.m, n) + '（ふだんの同じ曜日との差・%）') + table(nc() ? ['雨', 'この店'] : ['雨', 'この店', '同じ型の店の中央', 'エリアの中央'], rows, false) + '<p class="hint">差は「ふだんの同じ曜日」と比べた割合です。雨の日の売り方（重い物は後回しにされやすい など）は「天気と売れ方」で見られます。</p>';
    },
    loss: function (n) {
      if (!n.ls) return '<p class="hint">この段には、ロスの記録がありません。</p>';
      var mo = meta().months || [], vals = (n.lm || []).map(function (v) { return v == null ? NaN : v; });
      return '<p>見切り ' + num(n.ls[0], 1) + '%・廃棄 ' + num(n.ls[1], 1) + '%・ロスの計 <b>' + num(n.ls[2], 1) + '%</b>' + (n.ly ? '（1か月あたり 見切り ' + num(n.ly[0]) + '千円・廃棄 ' + num(n.ly[1]) + '千円）' : '') + (n.lp && !nc() ? '｜同じ型の店の中央 ' + num(n.lp[0], 1) + '%・エリアの中央 ' + num(n.lp[1], 1) + '%' : '') + (n.lr && !nc() ? '｜エリア ' + n.lr[1] + '店で ' + n.lr[0] + '番目（少ない順）' : '') + '</p>' +
        (vals.length ? figt('月ごとのロスの計（%）') + bars(vals, mo.slice(-vals.length).map(function (x) { return x.slice(2).replace('-', '/'); }), { base: 0, fmt: function (x) { return x.toFixed(1); }, unit: '%', title: '月ごとのロスの計' }) + '<p class="hint">棒の無い月＝記録の無い月（0 ではありません）。</p>' : '') +
        '<p class="hint">見込み: 作る量・仕入れの量／原料の見切り品を加工に回している／鮮度を厳しく見て早めに値引きしている／値引きの深さ・時刻の決まり。どれかは、記録からは見分けられません（売場で確かめる）。値引きの率や時刻は、量と並べ方を合わせたあとに見直す。</p>';
    },
    ad: function (n) {
      var a = n.ad; if (!a || !isFinite(a.L)) return '<p class="hint">この段には、広告（特売）の数がありません。</p>';
      var rows = (a.top || []).map(function (r) { return '<tr><td>' + esc(r[0]) + (r[4] ? '（深い値下げ）' : '') + '</td><td>' + esc(r[1]) + '</td><td class="n">' + num(r[2], 2) + '</td><td class="n">' + num(r[3] / 1000, 1) + '</td></tr>'; }).join('');
      return '<p>載った ' + num(a.n) + '件（比べられた ' + num(a.nc) + '件）・特売の日の点数は、ふだんの <b>' + num(a.L, 2) + '倍</b>' + (isFinite(a.up) ? '・増えた実売上 ' + num(a.up / 1000) + '千円・値下げの額 ' + num(a.cut / 1000) + '千円' : '') + '</p>' +
        (rows ? figt('この店でよく効いた商品（増えた実売上の多い順）') + table(['商品', '号', '倍率（倍）', '増えた実売上（千円）'], rows, false) : '') +
        '<p class="hint">よく売れても、深い値下げ・数量限定の商品は、原価を割る集客用のことがあります。次も載せるかは、粗利を確かめてから決めます。</p>';
    },
    md: function (n) {
      var m5 = n.m5; if (!m5) return '<p class="hint">この段には、52週MD の計画がありません（部門と区分ごと。クラスの段には出しません）。</p>';
      var KD = { up: '上回った', flat: '計画並み', down: '下回った' };
      var rows = (m5.rows || []).slice(0, 40).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td class="w">' + esc(r[2]) + '</td><td class="n">' + num(r[8]) + '</td><td class="n">' + num(r[9], 1) + '</td><td class="n"><b>' + num(r[3], 2) + '</b></td><td class="' + (r[6] === 'down' ? 'dn' : r[6] === 'up' ? 'up' : '') + '">' + esc(KD[r[6]] || '') + '</td></tr>'; }).join('');
      return '<p>計画と比べられた ' + m5.n + '回: 上回った ' + m5.up + '・並み ' + m5.flat + '・<b class="dn">下回った ' + m5.down + '</b>（この店の点数 ÷ 点数の計画）</p>' + figt('52週MD の回（新しい順・40回まで）') + table(['週', '区分', 'イチオシ品', '点数', '点数の計画', '計画比（倍）', '結果'], rows, (m5.rows || []).length > 10);
    }
  };
  function fillLazy(d) {
    var body = d.querySelector('.lz'), key = CUR + '|' + S.path.join('/') + '|' + S.m;
    if (!body || body.dataset.done === key) return;
    var n = N()[S.path[S.path.length - 1]];
    if (!TREE) { ensureTree(); body.innerHTML = '<div class="hint wait"><span class="spin" aria-hidden="true"></span>読み込んでいます…（届いたら開き直してください）</div>'; return; }
    body.innerHTML = LAZY[d.dataset.lazy](n); body.dataset.done = key; fhSchedule();
  }
  function table(head, rows, tall) { return '<div class="tw' + (tall ? ' tall' : '') + '"><table class="t"><thead><tr>' + head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'; }
  // ── 段4: 何を見たいかの選び（辞書の中身から・往復 0）と、探す（共通の部品 search_norm.js でゆれを吸収）
  var DICT = null, DICT_P = null, SDICT = false, IDX = null;
  var SN = window.SearchNorm || null;
  function loadDict() {
    if (DICT || DICT_P) return DICT_P;
    DICT_P = AUTH.call('load').then(function (r) {
      if (r && r.ok && r.data) { DICT = r.data; IDX = null; if (SN && DICT.terms) { var y = {}; DICT.terms.forEach(function (t) { if (t.name && t.reading && /[一-龥]/.test(t.name)) y[t.name] = t.reading; }); SN.load({ yomi: y }); } if (S.view !== 'home' && S.view !== 'status') render({ keep: true }); }
      else { DICT_P = null; onFail(r); }
    }, function () { DICT_P = null; });
    AUTH.call('statusDict').then(function (r) { if (r && r.ok && r.dict && SN) { SN.load(r.dict); SDICT = true; IDX = null; } }, function () { /* 読みの表が無くても、漢字・カナでは探せる */ });
    return DICT_P;
  }
  function waitDict(title) { loadDict(); return '<h1 class="vt" id="lvtop">' + esc(title) + '</h1><div class="hint wait"><span class="spin" aria-hidden="true"></span>辞書の中身を読み込んでいます…</div>'; }
  var LENS_NM = { month: '今月の型', event: '催事ごと', year: '年間の流れ', dept: '部門ごと', wx: '天気と売れ方' };
  function viewLens(v) {
    if (!LENS_NM[v]) return '';
    if (!DICT) return waitDict(LENS_NM[v]);
    return { month: lensMonth, event: lensEvent, year: lensYear, dept: lensDept, wx: lensWx }[v]();
  }
  function curStoreTop() { return CUR && (SUM || TREE) ? N().S : null; }
  function storeMini() {
    var s = curStoreTop(); if (!s) return '';
    return '<div class="box"><h3>' + esc(s.n) + 'のいま</h3><div class="tiles t4" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      tile({ nm: '売上', u: MK.a.u, v: num(s.sd, 0), yy: myo(s, 'a') }) + tile({ nm: '来客数', u: MK.c.u, v: num(mval(s, 'c')), yy: myo(s, 'c') }) +
      '</div><div class="nx" style="margin-top:8px"><button type="button" data-lens="home">' + esc(s.n) + 'のステータスを開く ▸</button></div></div>';
  }
  function list(arr) { return '<ul style="margin:0;padding-left:1.2em">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
  function lensMonth() {
    var mo = S.month || (new Date().getMonth() + 1), M = DICT.months.filter(function (x) { return x.m === mo; })[0] || {};
    var evs = DICT.events.filter(function (e) { return e.month === mo; });
    var prep = DICT.events.filter(function (e) { var d = ((e.month - mo) % 12 + 12) % 12; return d > 0 && d <= (e.lead || 0); });
    var h = '<h1 class="vt" id="lvtop">今月の型<span class="mon"><button type="button" data-month="-1" aria-label="前の月">◀</button><b>' + mo + '月</b><button type="button" data-month="1" aria-label="次の月">▶</button></span><small>毎年この月にすること</small></h1><div class="grid2"><div>';
    h += '<div class="box"><h3>この月のテーマ</h3><p style="margin:0">' + esc(M.theme || '―') + '</p>' + (M.spot ? '<p class="hint">' + esc(M.spot) + '</p>' : '') + '</div>';
    h += '<div class="box"><h3>催事と準備</h3>' + (evs.length ? '<div class="evs">' + evs.map(evBtn).join('') + '</div>' : '<p class="hint">この月に当日が来る催事はありません。</p>') +
      (prep.length ? '<p class="hint" style="margin-top:8px">準備・予約が動いている催事: ' + prep.map(function (e) { return '<button type="button" class="lk" data-ev="' + esc(e.id) + '">' + esc(e.name) + '（' + e.month + '月）</button>'; }).join('・') + '</p>' : '') + '</div>';
    Object.keys(M.items || {}).forEach(function (k) { var it = M.items[k]; if (it && it.list && it.list.length) h += '<div class="box"><h3>' + esc(it.label || k) + '</h3>' + list(it.list) + '</div>'; });
    if (M.note) h += '<details class="det"><summary>この月の気をつける所</summary><div><p>' + esc(M.note) + '</p></div></details>';
    h += '</div><div>' + storeMini() + '<div class="box"><h3>天気と売れ方</h3><p style="margin:0 0 6px">' + esc((DICT.weather && DICT.weather.calendar && DICT.weather.calendar[0]) || '') + '</p><div class="nx"><button type="button" data-lens="wx">天気と売れ方を開く ▸</button></div></div></div></div>';
    return h;
  }
  function evBtn(e) { return '<button type="button" class="ev" data-ev="' + esc(e.id) + '" aria-pressed="' + (S.ev === e.id) + '"><b>' + esc(e.name) + '</b><small>' + e.month + '月' + (e.day ? '・' + esc(e.day) : '') + (e.lead ? '・準備 ' + e.lead + 'か月前から' : '') + '</small></button>'; }
  function lensEvent() {
    var now = new Date().getMonth() + 1, withD = DICT.events.filter(function (x) { return (x.depts || []).length; });
    var e = DICT.events.filter(function (x) { return x.id === S.ev; })[0] || withD.filter(function (x) { return x.month >= now; })[0] || withD[0] || DICT.events[0];   // はじめは、これから来る催事のうち型のある物
    var h = '<h1 class="vt" id="lvtop">催事ごと<small>' + DICT.events.length + 'の催事・部門ごとの展開の型</small></h1><div class="evs">' + DICT.events.map(evBtn).join('') + '</div>';
    h += '<h2 class="sec" id="dig">' + esc(e.name) + '（' + e.month + '月' + (e.day ? '・' + esc(e.day) : '') + '）</h2>';
    if (e.note) h += '<div class="box"><p style="margin:0">' + esc(e.note) + '</p></div>';
    var rows = (e.depts || []).map(function (d) { return '<tr><td>' + esc(d.dept6 || d.dept) + '</td><td>' + esc(d.area || '') + '</td><td class="w">' + esc(d.schedule || '―') + '</td><td class="w">' + esc(d.caution || '―') + '</td><td class="w">' + esc(d.change || '―') + '</td></tr>'; }).join('');
    h += rows ? '<div class="box"><h3>部門ごとの予定・注意点・変わった所</h3>' + table(['部門', 'エリア', '予定', '注意点', '変わった所・反省'], rows, (e.depts || []).length > 6) + '</div>'
      : '<div class="box"><p style="margin:0">この催事は、部門ごとの型がまだありません（資料に催事固有の指示が無いため）。今月の型と判断カードを見てください。</p></div>';   // 空の表は出さない
    var cn = []; (e.depts || []).forEach(function (d) { (d.corners || []).forEach(function (c) { cn.push('<tr><td>' + esc(d.dept6 || d.dept) + '</td><td>' + esc(c.name) + '</td><td class="w">' + esc(c.items || '') + '</td><td class="w">' + esc(c.how || '') + '</td></tr>'); }); });
    if (cn.length) h += '<details class="det"><summary>展開の型（売場ごと・' + cn.length + '）</summary><div>' + table(['部門', '売場', '品', '展開の仕方'], cn.join(''), cn.length > 10) + '</div></details>';
    h += '<p class="hint">広告の実績から抜き出した候補（本部の確かめの前）は、店の画面には出しません。</p>';
    return h;
  }
  function lensYear() {
    var W = 1180, cw = (W - 60) / 12, lane = {}, maxL = 1;
    DICT.events.forEach(function (e) { lane[e.month] = (lane[e.month] || 0) + 1; maxL = Math.max(maxL, lane[e.month]); });
    var H = 90 + maxL * 46, now = new Date().getMonth() + 1; lane = {};
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="年間の流れの図" data-u="月ごとの催事（図）"><text x="10" y="18" font-size="14" font-weight="700" fill="#1f2933">年間の流れ（月ごとの催事・線＝準備や予約が動き出す月から当日まで）</text>';
    for (var i = 0; i < 12; i++) { var x = 50 + i * cw; s += '<rect x="' + x + '" y="34" width="' + (cw - 4) + '" height="' + (H - 64) + '" rx="8" fill="' + (i + 1 === now ? '#e8f0fb' : '#f8fafc') + '" stroke="#d9e0ea"/><text x="' + (x + cw / 2 - 2) + '" y="56" font-size="15" font-weight="800" text-anchor="middle" fill="#0b3a7e">' + (i + 1) + '月</text>'; }
    DICT.events.forEach(function (e) {
      var k = lane[e.month] = (lane[e.month] || 0) + 1, x = 50 + (e.month - 1) * cw + 8, y = 66 + (k - 1) * 46;
      if (e.lead) { var x0 = 50 + (((e.month - e.lead - 1) % 12 + 12) % 12) * cw + cw / 2; if (x0 < x) s += '<line x1="' + x0 + '" y1="' + (y + 17) + '" x2="' + (x + 2) + '" y2="' + (y + 17) + '" stroke="#b45309" stroke-width="3" stroke-dasharray="6 4"/><circle cx="' + x0 + '" cy="' + (y + 17) + '" r="5" fill="#b45309"/>'; }
      s += '<g data-ev="' + esc(e.id) + '" role="button" tabindex="0" style="cursor:pointer"><rect x="' + x + '" y="' + y + '" width="' + (cw - 20) + '" height="34" rx="7" fill="#fff" stroke="#1f4f8f" stroke-width="1.6"/><text x="' + (x + (cw - 20) / 2) + '" y="' + (y + 22) + '" font-size="12.5" font-weight="700" text-anchor="middle" fill="#1f2933">' + esc(e.name.length > 7 ? e.name.slice(0, 7) + '…' : e.name) + '</text></g>';
    });
    s += '<g font-size="12.5" fill="#52606d"><line x1="60" y1="' + (H - 14) + '" x2="96" y2="' + (H - 14) + '" stroke="#b45309" stroke-width="3" stroke-dasharray="6 4"/><text x="102" y="' + (H - 10) + '">準備・予約が動き出す月から当日まで</text><rect x="380" y="' + (H - 24) + '" width="16" height="14" fill="#e8f0fb" stroke="#d9e0ea"/><text x="402" y="' + (H - 12) + '">いまの月</text></g></svg>';
    return '<h1 class="vt" id="lvtop">年間の流れ<small>' + DICT.events.length + 'の催事</small></h1><div class="box yr"><div class="hint">催事を押すと「催事ごと」が開きます。狭い画面では、図を横に動かせます。</div>' + s + '</div>';
  }
  var DEPT6 = ['農産', '水産', '畜産', '惣菜', '日配', 'グロッサリー'];
  var DEPT_MAP = { '農産': ['青果', '農産', '野菜', '果物'], '水産': ['鮮魚', '水産', '塩干'], '畜産': ['精肉', '畜産', '肉'], '惣菜': ['惣菜'], '日配': ['日配'], 'グロッサリー': ['一般食品', '菓子', '酒', 'グロッサリー', '日用'] };
  function lensDept() {
    var d = DEPT6[S.dept || 0], h = '<h1 class="vt" id="lvtop">部門ごと<small>判断カード・催事の予定</small></h1>';
    h += '<div class="dchips">' + DEPT6.map(function (x, i) { return '<button type="button" data-dept="' + i + '" aria-pressed="' + (i === (S.dept || 0)) + '">' + esc(x) + '</button>'; }).join('') + '</div>';
    var st = curStoreTop();
    if (st) { var mine = (st.ch || []).map(function (id) { return { id: id, n: N()[id] }; }).filter(function (x) { return x.n && DEPT_MAP[d].some(function (w) { return x.n.n.indexOf(w) >= 0; }); });
      if (mine.length) h += '<div class="box"><h3>' + esc(meta().st.nm) + 'の' + esc(d) + '</h3><div class="tiles t4">' + mine.map(function (x) { return tile({ nm: x.n.n, u: MK.a.u, v: num(x.n.sd, 1), yy: myo(x.n, 'a') }); }).join('') + '</div><div class="nx" style="margin-top:8px">' + mine.map(function (x) { return '<button type="button" data-drill="' + esc(x.id) + '">' + esc(x.n.n) + 'を掘り下げる ▸</button>'; }).join('　') + '</div></div>'; }
    var cs = DICT.cards.filter(function (c) { return c.dept === d; }), all = DICT.cards.filter(function (c) { return !c.dept; });
    h += '<h2 class="sec" id="dig">' + esc(d) + 'の判断カード（' + cs.length + '）</h2>' + (cs.length ? '<div class="cards">' + cs.map(cardBtn).join('') + '</div>' : '<p class="hint">この部門だけのカードはありません（全部門のカードを下に）。</p>');
    h += '<details class="det"><summary>全部門の判断カード（' + all.length + '）</summary><div><div class="cards">' + all.map(cardBtn).join('') + '</div></div></details>';
    var rows = []; DICT.events.forEach(function (e) { (e.depts || []).forEach(function (x) { if (x.dept6 === d) rows.push('<tr><td>' + esc(e.name) + '</td><td class="n">' + e.month + '月</td><td class="w">' + esc(x.schedule || '―') + '</td><td class="w">' + esc(x.caution || '―') + '</td></tr>'); }); });
    h += '<details class="det"><summary>' + esc(d) + 'の催事の予定（' + rows.length + '）</summary><div>' + table(['催事', '月', '予定', '注意点'], rows.join(''), rows.length > 10) + '</div></details>';
    return h;
  }
  function cardBtn(c) { return '<button type="button" class="kc" data-card="' + esc(c.id) + '"><span class="kk">判断カード</span><span class="kt">' + esc(c.title) + '</span><span class="ks">いつ: ' + esc(c.when || '') + '<br>すること: ' + esc(c.do || '') + '</span></button>'; }
  function lensWx() {
    var W = DICT.weather || {}, h = '<h1 class="vt" id="lvtop">天気と売れ方<small>' + esc(W.period || '') + '</small></h1>';
    var st = curStoreTop();
    if (st && st.wxs && st.wxs.c && st.wxs.c[1]) { var w = st.wxs.c[1]; h += '<div class="box"><h3>' + esc(meta().st.nm) + 'の強い雨の日</h3><p style="margin:0">来客は、ふだんの同じ曜日より <b class="' + cls(w[0]) + '">' + sg(w[0]) + '%</b>' + (nc() ? '（' + esc(NC_NOTE) + '）' : '（同じ型の店の中央 ' + sg(w[1]) + '%・エリアの中央 ' + sg(w[2]) + '%）') + '。部門・クラスごとは、ステータスの「くわしく」の天気（雨の日）で見られます。</p></div>'; }
    if (W.lead) h += '<p class="hint">' + esc(W.lead) + '</p>';
    h += '<div class="wx">' + (W.groups || []).map(function (g) {
      return '<div class="box"><h3>' + esc(g.short || '') + '<small style="font-weight:400;color:var(--sub)">　' + esc(g.title || '') + '</small></h3>' + (g.rows || []).map(function (r) { return '<div class="wxr" style="grid-template-columns:1fr"><div class="t"><b>' + esc(r.what) + '</b><small>' + esc(r.hitokoto || '') + '</small>' + (r.numbers ? '<details><summary class="hint" style="cursor:pointer">数字を見る</summary><small>' + esc(r.numbers) + '</small></details>' : '') + '</div></div>'; }).join('') + '</div>';
    }).join('') + '</div>';
    if (W.calendar && W.calendar.length) h += '<div class="box"><h3>暦（天気より大きく動く日）</h3>' + list(W.calendar) + '</div>';
    return h + '<p class="hint">「関係ない」も、分かったこととして載せています（思い込みを外すため）。</p>';
  }
  // ── 探す: 鍵は辞書を受け取ったときに1回だけ作る。打つのを少し待ってから探す
  function buildIdx() {
    var a = [], key = function (s) { return SN ? SN.key(s) : String(s).toLowerCase(); };
    function add(k, t, s, extra, go, o) { a.push({ k: k, t: t, s: s || '', key: key(t + ' ' + (s || '') + ' ' + (extra || '')), go: go, o: o }); }
    DICT.cards.forEach(function (c) { add('判断カード', c.title, (c.dept || '全部門') + '・' + (c.when || ''), (c.words || []).join(' ') + ' ' + c.check + ' ' + c.ok + ' ' + c.do, { card: c.id }, 1); });
    if (CUR && (SUM || TREE)) { var all = N(); Object.keys(all).forEach(function (id) { var n = all[id]; if (n.lv >= 1 && n.lv !== 3) add('自店の売場', n.n, LVNM[n.lv], '', { drill: id }, 2); }); }
    if (ME && ME.map) ME.map.areas.forEach(function (ar) { ar.stores.forEach(function (s) { add('店', s.nm, ar.nm + '・' + (s.ty || ''), '', { store: s.c }, 2); }); });
    DICT.events.forEach(function (e) { add('催事', e.name, e.month + '月', e.note, { ev: e.id }, 3); });
    DICT.months.forEach(function (m) { add('今月の型', m.m + '月', m.theme, m.spot, { month: m.m }, 4); });
    ((DICT.weather || {}).groups || []).forEach(function (g) { (g.rows || []).forEach(function (r) { add('天気と売れ方', r.what, r.hitokoto, g.short, { lens: 'wx' }, 5); }); });
    DICT.ope.forEach(function (o) { add('運営の型', o.title, o.kind_ja || '', (o.body || '') + ' ' + (o.items || []).join(' '), { ope: o.id }, 6); });
    DICT.calls.forEach(function (c) { add('ベテランの判断', c.decision, c.situation, c.because, { call: c.id }, 7); });
    DICT.sections.forEach(function (s) { add('教科書', s.title, s.chapter || s.tab || '', (s.text || '').slice(0, 300), { sec: s.id }, 8); });
    DICT.terms.forEach(function (t) { add('用語', t.name, t.short, t.reading, { term: t.name }, 9); });
    IDX = a;
  }
  function mark(t, Q) { if (!SN || !Q) return esc(t); var p = SN.locate(t, Q); return p ? esc(t.slice(0, p[0])) + '<mark>' + esc(t.slice(p[0], p[1])) + '</mark>' + esc(t.slice(p[1])) : esc(t); }
  var stimer = 0;
  function search(inp, box) {
    var raw = inp.value.replace(/\s+/g, ' ').trim();
    if (!raw) { box.classList.remove('on'); box.innerHTML = ''; return; }
    if (!DICT) { loadDict(); box.innerHTML = '<div class="none"><span class="spin" aria-hidden="true"></span> 辞書の中身を読み込んでいます…</div>'; box.classList.add('on'); DICT_P && DICT_P.then(function () { if (inp.value.trim()) search(inp, box); }); return; }
    if (!IDX) buildIdx();
    var Q = SN ? SN.terms(raw) : null, hits = IDX.filter(function (x) { return SN ? SN.hit(x.key, Q) : x.key.indexOf(raw.toLowerCase()) >= 0; }).sort(function (a, b) { return a.o - b.o; });
    if (!hits.length) { box.innerHTML = '<div class="none">「' + esc(raw) + '」は見つかりませんでした。ちがう言い方で探してください（例: 欠品 → 品切れ・ロス → 見切り）。</div>'; box.classList.add('on'); return; }
    var h = '<div class="cnt">' + hits.length + '件' + (hits.length > 50 ? '（上から50件）' : '') + '</div>', g = '';
    hits.slice(0, 50).forEach(function (x, i) { if (x.k !== g) { g = x.k; h += '<div class="grp">' + esc(g) + '</div>'; } h += '<button type="button" role="option" data-hit="' + IDX.indexOf(x) + '"' + (i ? '' : ' class="act"') + '><span class="k">' + esc(x.k) + '</span>' + mark(x.t, Q) + (x.s ? '<span class="s">' + mark(String(x.s).slice(0, 80), Q) + '</span>' : '') + '</button>'; });
    box.innerHTML = h; box.classList.add('on');
  }
  function useHit(i) {
    var x = IDX && IDX[i]; if (!x) return; var g = x.go;
    $$('.res').forEach(function (b) { b.classList.remove('on'); });
    if (g.card) openCard(g.card); else if (g.drill) drillTo(g.drill); else if (g.store) pickStore(g.store);
    else if (g.ev) go({ view: 'event', ev: g.ev }, { top: true }); else if (g.month) go({ view: 'month', month: g.month }, { top: true });
    else if (g.lens) go({ view: g.lens }, { top: true }); else if (g.ope) openOpe(g.ope); else if (g.call) openCall(g.call); else if (g.sec) openSec(g.sec); else if (g.term) openTerm(g.term);
  }
  // ── 重ねて出す（カード・運営の型・ベテランの判断・教科書の節・用語）
  function dlg(html) { $('#dlgin').innerHTML = '<button type="button" class="cl" data-close="1">閉じる（Esc）</button>' + html; $('#dlg').classList.add('on'); $('#dlg .cl').focus(); }
  function closeDlg() { $('#dlg').classList.remove('on'); }
  function byId(arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0]; }
  function openCard(id) {
    var c = byId(DICT.cards, id); if (!c) return;
    var basis = (c.basis || []).map(function (b) { var f = byId(DICT.facts, b), k = byId(DICT.calls, b); return f ? '<li>' + esc(f.metric + ' ' + f.value + (f.unit || '') + '（' + (f.period || '') + '・' + (f.src || '') + '）') + '</li>' : k ? '<li>' + esc(k.decision + '（' + (k.who || '') + '・' + (k.ymd || '') + '・' + (k.verdict || '') + '）') + '</li>' : ''; }).join('');
    var mine = '', st = curStoreTop();
    if (st && c.dept) { var x = (st.ch || []).map(function (i2) { return { id: i2, n: N()[i2] }; }).filter(function (y) { return y.n && (DEPT_MAP[c.dept] || []).some(function (w) { return y.n.n.indexOf(w) >= 0; }); })[0]; if (x) mine = '<div class="nx"><button type="button" data-drill="' + esc(x.id) + '" data-close="1">' + esc(meta().st.nm + 'の' + x.n.n) + 'を見る ▸</button></div>'; }
    dlg('<h3>' + esc(c.title) + '</h3><div><span class="tag hq">判断カード</span><span class="tag ai">' + esc(c.dept || '全部門') + '</span><span class="tag">' + esc(c.status || '') + '</span></div>' +
      '<dl><dt>いつ</dt><dd>' + esc(c.when || '') + '</dd><dt>見る</dt><dd>' + esc(c.check || '') + '</dd><dt>正しい</dt><dd>' + esc(c.ok || '') + '</dd><dt>する</dt><dd>' + esc(c.do || '') + '</dd><dt>外れたら</dt><dd>' + esc(c.ng || '') + '</dd>' +
      '<dt>なぜ</dt><dd>' + (c.why ? esc(c.why) : '<span class="tag gap">本部が書く欄（まだ空）</span>') + '</dd></dl>' + (basis ? '<details><summary class="hint" style="cursor:pointer">根拠を見る</summary><ul>' + basis + '</ul></details>' : '') + mine);
  }
  function openOpe(id) { var o = byId(DICT.ope, id); if (o) dlg('<h3>' + esc(o.title) + '</h3><div><span class="tag hq">運営の型</span><span class="tag">' + esc(o.kind_ja || '') + '</span></div><p>' + esc(o.body || '') + '</p>' + (o.items && o.items.length ? list(o.items) : '')); }
  function openCall(id) { var c = byId(DICT.calls, id); if (c) dlg('<h3>' + esc(c.decision) + '</h3><div><span class="tag hq">ベテランの判断</span><span class="tag">' + esc(c.verdict || '') + '</span></div><dl><dt>場面</dt><dd>' + esc(c.situation || '') + '</dd><dt>なぜ</dt><dd>' + esc(c.because || '') + '</dd><dt>結果</dt><dd>' + esc(c.outcome || '') + '</dd><dt>出どころ</dt><dd>' + esc((c.who || '') + '・' + (c.ymd || '') + '・' + (c.src || '')) + '</dd></dl>'); }
  function openSec(id) {
    var s = byId(DICT.sections, id); if (!s) return;
    var ids = (s.slides || []).map(function (x) { return typeof x === 'string' ? x : (x && x.id) || ''; }).filter(function (x) { return /^[A-Za-z0-9_-]{1,40}$/.test(x); });
    dlg('<h3>' + esc(s.title) + '</h3><div><span class="tag hq">教科書</span><span class="tag">' + esc(s.chapter || s.tab || '') + '</span></div><div class="secb">' + safeHtml(s.html || esc(s.text || '')) + '</div>' +
      (ids.length ? '<div class="nx"><button type="button" data-slides="' + esc(ids.join(',')) + '">スライドを見る（' + ids.length + '枚） ▸</button></div><div id="slbox"></div>' : ''));
  }
  /** スライド: 画面に出す分だけ、数枚ずつ窓口から（いまの辞書と同じ口 slides）。画像の形（data:image/…）だけを使う */
  function showSlides(ids, btn) {
    var box = $('#slbox'); if (!box) return;
    btn.disabled = true; box.innerHTML = '<div class="hint wait"><span class="spin" aria-hidden="true"></span>スライドを受け取っています…</div>';
    AUTH.call('slides', { ids: ids.slice(0, 8) }).then(function (r) {
      btn.disabled = false;
      if (!r || !r.ok) { onFail(r); box.innerHTML = ''; return; }
      box.innerHTML = ids.slice(0, 8).map(function (id) { var v = r.slides && r.slides[id]; return typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(v) ? '<img class="slide" alt="' + esc(id) + '" src="' + v + '">' : ''; }).join('') + (ids.length > 8 ? '<p class="hint">はじめの8枚を出しています。</p>' : '');
    }, function () { btn.disabled = false; box.innerHTML = ''; toast('通信できませんでした。'); });
  }
  function openTerm(nm) { var t = DICT.terms.filter(function (x) { return x.name === nm; })[0]; if (t) dlg('<h3>' + esc(t.name) + '<small style="font-weight:400">（' + esc(t.reading || '') + '）</small></h3><div><span class="tag hq">用語</span></div><p>' + esc(t.short || '') + '</p>' + (t.example ? '<p class="hint">' + esc(t.example) + '</p>' : '')); }

  // ── 利用ガイド・更新の状態（開いたときだけ窓口へ。2回目からは覚えた物）
  var GUIDE = null, ADMIN = null;
  function safeHtml(s) { return String(s).replace(/<\/?(script|iframe|object|embed|link|meta|style)\b[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ''); }
  function viewGuide() {
    if (!GUIDE) { AUTH.call('statusGuide').then(function (r) { if (r && r.ok) { GUIDE = r; if (S.view === 'guide') render({}); } else onFail(r); }); return '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド</h1><div class="hint wait"><span class="spin" aria-hidden="true"></span>読み込んでいます…</div>'; }
    var toc = [], re = /<section\b[^>]*id="([^"]+)"[^>]*>\s*<h3>([^<]*)<\/h3>/g, m;
    while ((m = re.exec(GUIDE.html))) toc.push('<button type="button" data-gsec="' + esc(m[1]) + '">' + m[2] + '</button>');   // 目次は本文の見出しから作る（節を足せば目次も付いてくる）
    return '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド<small>' + esc(roleLabel()) + '向け</small></h1><div class="dchips gtoc" role="navigation" aria-label="利用ガイドの目次">' + toc.join('') + '</div><div class="guide1">' + safeHtml(GUIDE.html) + '</div>';
  }
  function viewAdmin() {
    if (!ADMIN) { AUTH.call('statusAdmin').then(function (r) { if (r && r.ok) { ADMIN = r; if (S.view === 'admin') render({}); } else onFail(r); }); return '<h1 class="vt" id="lvtop">更新の状態</h1><div class="hint wait"><span class="spin" aria-hidden="true"></span>読み込んでいます…</div>'; }
    var rows = ADMIN.files.map(function (f) { return '<tr><td>' + esc(f.name) + '</td><td class="n">' + num(f.size / 1024) + '</td><td>' + esc(f.date) + '</td></tr>'; }).join('');
    return '<h1 class="vt" id="lvtop">更新の状態<small>管理者だけ</small></h1><div class="adm"><h3>スマレコの名簿の数</h3><p style="margin:0">' + (ADMIN.master ? 'アカウント ' + ADMIN.master.accounts + '（本部 ' + ADMIN.master.hq + '・店 ' + ADMIN.master.store + '・所属が2つ以上 ' + ADMIN.master.multiple + '・店の名前が表に無い ' + ADMIN.master.unknownShop + '）' : '名簿の置き場が、まだ決まっていません') + '｜窓口の版 ' + esc(ADMIN.build) + '</p></div>' + table(['ファイル', '大きさ（KB）', '入れた日時'], rows, ADMIN.files.length > 10);
  }

  // ── 店の木を裏で先取り（掘る・戻るは往復 0 にする）。木は 3〜4MB なので、窓口が縮めて（gzip）base64 で送る（0.7〜1.0MB）。この端末で解く
  var CAN_GZ = typeof DecompressionStream === 'function' && typeof Blob === 'function' && typeof Response === 'function';
  function unzipJson(b64) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(JSON.parse);
  }
  // 本部が店を次々に開いても重くならないよう、端末に持つ店の木は新しい3店まで（古い店は、もう一度開いたときに受け取り直す・往復1本）
  var KEPT = [], KEEP_MAX = 3;
  function keepTree(code) {
    KEPT = KEPT.filter(function (c) { return c !== code; }).concat([code]);
    while (KEPT.length > KEEP_MAX) { var old = KEPT.shift(); if (old !== CUR && DATA[old] && DATA[old].tree) DATA[old] = { sum: DATA[old].sum === DATA[old].tree ? null : DATA[old].sum }; }
  }
  function ensureTree() {
    if (TREE || TREE_P || !ME || !CUR) return TREE_P;
    var code = CUR, d = DATA[code];
    TREE_P = d.p = AUTH.call('statusStore', CAN_GZ ? { code: code } : { code: code, plain: true }).then(function (r) {
      if (r && r.ok && r.gz) return unzipJson(r.gz).then(function (t) { r.tree = t; return r; });
      return r;
    }).then(function (r) {
      d.p = null;
      if (r && r.ok && r.tree) { d.tree = r.tree; if (!d.sum) d.sum = r.tree; keepTree(code); if (CUR === code) { useStore(code); render({ keep: true }); } }
      else if (r && r.nodata) { d.none = r.error; if (CUR === code) render({ keep: true }); }
      else { if (CUR === code) TREE_P = null; onFail(r); }
    }).catch(function () { d.p = null; if (CUR === code) TREE_P = null; toast('通信できませんでした。もう一度押してください。'); });
    return TREE_P;
  }
  /** 店を選ぶ（本部が全体の地図から）。その店の木が無ければ受け取る（往復1本・待ちの印）。店の人は、スマレコの名簿の所属の1店だけ */
  function pickStore(code) {
    if (code === CUR) return;
    HIST.push(snap()); if (HIST.length > 200) HIST.shift();
    useStore(code); S.view = 'status'; S.path = ['S'];
    render({ top: true });
    ensureTree();   // 要約で先に描き、木は裏で受け取る（掘る・戻るは往復 0）
  }
  function drillTo(id) {
    if (!N()[id]) { ensureTree(); toast('読み込んでいます…'); return; }
    var p = [], x = id;
    while (x) { p.unshift(x); var n = N()[x]; x = n && n.p; if (x && N()[x] && N()[x].lv === 3) x = N()[x].p; }   // 小分類は段にしない（中分類の一覧の区切り）
    if (!hasKids(N()[id])) { toast(N()[id].n + 'は、いちばん下の段です'); return; }
    go({ view: 'status', path: p }, { land: true });
  }
  function onFail(r) {
    if (r && r.auth) { showGate(r.error || 'ログインの期限が切れました。もう一度ログインしてください。', true, AUTH.login); return; }
    toast((r && r.error) || 'うまく読み込めませんでした。');
  }

  // ── 着地・移動（すっと滑らせて、着いた所を光らせる）
  function stickyH() { return $('#pbar').getBoundingClientRect().bottom; }
  function land(how) {
    if (how.keep) return;
    if (how.y != null) { glide(how.y); if (how.msg) toast(how.msg); return; }
    if (how.land) {
      var top = $('#lvtop'), dig = $('#dig'); if (!top) return;
      var y = window.scrollY + top.getBoundingClientRect().top - stickyH() - 8;
      if (dig) { var dy = window.scrollY + dig.getBoundingClientRect().top; if (dy - y > window.innerHeight - 200) y = dy - (window.innerHeight - 200); }
      glide(y); var tl = $('.tiles'); if (tl) { tl.classList.remove('landed'); void tl.offsetWidth; tl.classList.add('landed'); }
      return;
    }
    if (how.top) glide(0);
  }
  var gl = 0;
  function glide(y) {
    y = Math.max(0, y); cancelAnimationFrame(gl);
    var y0 = window.scrollY, d = y - y0, t0 = performance.now(), dur = Math.max(280, Math.min(650, Math.abs(d) * 0.6));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState === 'hidden' || Math.abs(d) < 2) { window.scrollTo(0, y); return; }
    var stop = false;
    function step(t) { if (stop) return; var k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, y0 + d * e); if (k < 1) gl = requestAnimationFrame(step); }
    gl = requestAnimationFrame(step);
    setTimeout(function () { stop = true; window.scrollTo(0, y); }, dur + 90);
  }
  var tt = 0;
  function toast(s) { var t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1800); }

  // ── 表の見出しの写し（ページを縦に送って本物の見出しが帯の下へ流れた間だけ）。左の列は CSS の sticky
  var FH = null, fhSrc = null, fhT = 0;
  function fhReset() { if (!FH) return; FH.style.display = 'none'; FH.innerHTML = ''; fhSrc = null; }
  function fhSchedule() { if (fhT) return; fhT = requestAnimationFrame(function () { fhT = 0; fhUpdate(); }); setTimeout(function () { if (fhT) { cancelAnimationFrame(fhT); fhT = 0; fhUpdate(); } }, 120); }
  function fhUpdate() {
    if (!main) return;
    var top = stickyH(), pick = null, list = main.querySelectorAll('.tw');
    for (var i = 0; i < list.length; i++) {
      var w = list[i]; if (!w.offsetParent || w.closest('details:not([open])')) continue;
      var th = w.querySelector('thead'); if (!th) continue;
      var r = w.getBoundingClientRect(), hh = th.offsetHeight;
      if (r.top < top - 1 && r.bottom > top + hh + 2) { pick = { w: w, r: r, th: th }; break; }
    }
    if (!pick) { if (FH.style.display !== 'none') FH.style.display = 'none'; return; }
    var w2 = pick.w, tbl = w2.querySelector('table');
    if (fhSrc !== w2) { FH.innerHTML = ''; var t = document.createElement('table'); t.className = tbl.className; t.style.tableLayout = 'fixed'; t.appendChild(pick.th.cloneNode(true)); FH.appendChild(t); fhSrc = w2; }
    var ct = FH.firstChild, src = pick.th.querySelectorAll('th'), dst = ct.querySelectorAll('th');
    ct.style.width = tbl.getBoundingClientRect().width + 'px';
    for (var j = 0; j < src.length; j++) { var wd = src[j].getBoundingClientRect().width + 'px'; dst[j].style.cssText = 'width:' + wd + ';min-width:' + wd + ';max-width:' + wd + ';box-sizing:border-box;position:relative;top:0'; }
    FH.style.display = 'block'; FH.style.top = top + 'px'; FH.style.left = (pick.r.left + w2.clientLeft) + 'px'; FH.style.width = w2.clientWidth + 'px';
    ct.style.transform = 'translateX(' + (-w2.scrollLeft) + 'px)';
    if (dst[0]) { dst[0].style.transform = 'translateX(' + w2.scrollLeft + 'px)'; dst[0].style.zIndex = '2'; }
  }

  // ── 入口の重ね（ログイン・読み込み中）
  function showGate(text, isErr, onBtn) {
    var g = $('#gate'); g.hidden = false; document.body.classList.add('locked');
    $('#gate-msg').textContent = text; $('#gate-msg').classList.toggle('err', !!isErr);
    $('#gate-busy').hidden = true;
    var b = $('#gate-login'); b.hidden = !onBtn; b.onclick = onBtn || null;
  }
  function showBusy(text) { var g = $('#gate'); g.hidden = false; document.body.classList.add('locked'); $('#gate-msg').textContent = text; $('#gate-msg').classList.remove('err'); $('#gate-busy').hidden = false; $('#gate-login').hidden = true; }
  function hideGate() { $('#gate').hidden = true; document.body.classList.remove('locked'); }

  // ── 押す・打つ（聞き耳は document に1つずつ）
  function bind() {
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#acct')) $('#acctmenu').classList.remove('on');
      if (!e.target.closest('#apps')) $('#appsmenu').classList.remove('on');
      if (!e.target.closest('.res') && !e.target.closest('input')) $$('.res').forEach(function (x) { x.classList.remove('on'); });
      if (e.target === $('#dlg')) { closeDlg(); return; }
      var b = e.target.closest('button,[role="button"]'); if (!b) return;
      var ds = b.dataset;
      if (ds.close) closeDlg();
      if (ds.hit != null) { useHit(+ds.hit); return; }
      if (ds.q) { var q1 = $('#q1'); q1.value = ds.q; q1.focus(); search(q1, $('#r1')); return; }
      if (ds.card) { openCard(ds.card); return; }
      if (ds.ev) { go({ view: 'event', ev: ds.ev }, { land: S.view === 'event', top: S.view !== 'event' }); return; }
      if (ds.month) { go({ month: (((S.month || (new Date().getMonth() + 1)) - 1 + +ds.month) % 12 + 12) % 12 + 1 }, { keep: true }); return; }
      if (ds.dept != null) { go({ dept: +ds.dept }, { keep: true }); return; }
      if (ds.gsec) { var sec = document.getElementById(ds.gsec); if (sec) { HIST.push(snap()); $('#back').disabled = false; glide(window.scrollY + sec.getBoundingClientRect().top - stickyH() - 10); sec.classList.remove('landed'); void sec.offsetWidth; sec.classList.add('landed'); } return; }
      if (ds.slides) { showSlides(ds.slides.split(','), b); return; }
      if (b.id === 'back') return back();
      if (b.id === 'totop') { HIST.push(snap()); $('#back').disabled = false; glide(0); toast('↑ いちばん上へ'); return; }
      if (b.id === 'upbtn') { if (S.path.length > 1) go({ view: 'status', path: S.path.slice(0, -1) }, { land: true }); return; }
      if (b.id === 'acctbtn') { $('#acctmenu').classList.toggle('on'); return; }
      if (b.id === 'appsbtn') { $('#appsmenu').classList.toggle('on'); return; }
      if (b.id === 'logout') { AUTH.logout(); return; }
      if (ds.lens) { if (ds.lens === 'home') go({ view: 'home', path: ['S'] }, { top: true }); else go({ view: ds.lens }, { top: true }); return; }
      if (ds.view === 'home-map') { HIST.push(snap()); useStore(''); S.view = 'home'; S.path = ['S']; render({ top: true }); return; }
      if (ds.view) { go({ view: ds.view }, { top: true }); return; }
      if (ds.store) { pickStore(ds.store); return; }
      if (ds.act === 'guide') { go({ view: 'guide' }, { top: true }); return; }
      if (ds.crumb != null) { go({ view: 'status', path: S.path.slice(0, +ds.crumb + 1) }, { land: true }); return; }
      if (ds.m) { go({ m: ds.m }, { keep: true }); return; }
      if (ds.drill) { drillTo(ds.drill); return; }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button') { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }   // 図の中の催事（svg）にも効く
      if (e.key === 'Escape') { $('#acctmenu').classList.remove('on'); $('#appsmenu').classList.remove('on'); closeDlg(); $$('.res').forEach(function (x) { x.classList.remove('on'); }); return; }
      if (t.id === 'q1') {
        var box = $('#r1'), items = $$('button[data-hit]', box), cur = items.findIndex(function (x) { return x.classList.contains('act'); });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; var nx = e.key === 'ArrowDown' ? Math.min(items.length - 1, cur + 1) : Math.max(0, cur - 1); items.forEach(function (x, i) { x.classList.toggle('act', i === nx); }); items[nx].scrollIntoView({ block: 'nearest' }); }
        if (e.key === 'Enter') { e.preventDefault(); if (cur >= 0) useHit(+items[cur].dataset.hit); }
      }
    });
    document.addEventListener('input', function (e) { var t = e.target; if (t.id !== 'q1') return; clearTimeout(stimer); stimer = setTimeout(function () { search(t, $('#r1')); }, 120); });
    window.addEventListener('scroll', fhSchedule, { passive: true });
    document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('tw')) fhSchedule(); }, true);
    window.addEventListener('resize', function () { document.documentElement.style.setProperty('--hdr', $('#hdr').offsetHeight + 'px'); fhSchedule(); });
    document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-lazy]') && d.open) fillLazy(d); fhSchedule(); }, true);
  }

  // ── はじめ: ログイン → statusStart（往復1本）→ 描く → 店の木を裏で先取り
  function onReady(email) {
    showBusy('読み込んでいます…');
    var t0 = performance.now();
    AUTH.call('statusStart').then(function (r) {
      if (!r || !r.ok) { if (r && r.auth) showGate(r.error, true, AUTH.login); else showGate((r && r.error) || '読み込めませんでした。', true, function () { onReady(email); }); return; }
      ME = r; DATA = {};
      if (r.role === 'store') { (r.stores || []).forEach(function (c) { DATA[c] = { sum: (r.summaries && r.summaries[c]) || null, none: r.nodata ? r.note : null }; }); useStore(r.stores[0]); }
      else useStore('');
      $('#acctbtn').innerHTML = '<span class="al">' + esc(r.email) + '（' + esc(roleLabel()) + '）</span>▾';
      $('#appsmenu').innerHTML = appLinks();
      $('#builds').textContent = '画面 ' + ((window.STOREOPS_CONFIG || {}).build || '作業用') + '／窓口 ' + (r.build || '―');   // 公開の確かめ（どの版が出ているか）
      hideGate();
      try { render({}); } catch (e) { showGate('画面を描けませんでした（' + String(e && e.message || e).slice(0, 80) + '）。開き直してください。', true, function () { location.reload(); }); throw e; }
      window.__statusT = { start: performance.now() - t0 };
      if (CUR) ensureTree();
      loadDict();   // 辞書の中身と探す欄の読みの表を、裏で受け取る（型の選び・探すは、そのあと往復 0）
    }, function () { showGate('通信できませんでした。通信の状態を確かめて、もう一度お試しください。', true, function () { onReady(email); }); });   // 通信の失敗と、描く所の失敗を分けて知らせる
  }
  document.addEventListener('DOMContentLoaded', function () {
    main = $('#main'); FH = $('#fh');
    document.documentElement.style.setProperty('--hdr', $('#hdr').offsetHeight + 'px');
    bind();
    AUTH.start(onReady, { gate: showGate, busy: showBusy });
  });
  window.STATUS_APP = { go: go, back: back, drillTo: drillTo, state: S, fhUpdate: fhUpdate, openSec: function (id) { openSec(id); }, tree: function () { return TREE; }, me: function () { return ME; }, kept: function () { return Object.keys(DATA).filter(function (c) { return DATA[c] && DATA[c].tree; }).length; }, dict: function () { return DICT; },
    find: function (q) { var i = $('#q1'); i.value = q; search(i, $('#r1')); return $$('#r1 button[data-hit]').map(function (b) { return b.textContent; }); } };
})();
