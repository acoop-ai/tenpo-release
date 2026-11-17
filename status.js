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
  function kids(n) { return kidsT(n, N()); }
  /** 下の段（木を選んで）: 本部の地図で、いま開いている店とは別の店の木を掘るときにも使う（11/17d） */
  function kidsT(n, all) {
    if (!n || !n.ch) return [];
    var out = [];
    n.ch.forEach(function (id) {
      var c = all[id]; if (!c) return;
      if (c.lv === 3) (c.ch || []).forEach(function (k) { if (all[k]) out.push({ n: all[k], id: k, g: c.n, gi: id }); });
      else out.push({ n: c, id: id });
    });
    if (n.lv === 0) out.sort(function (a, b) { return deptRank(a.n.n) - deptRank(b.n.n); });   // 店の下（部門）は、正の部門の並び
    return out;
  }
  function hasKids(n) { return !!(n.ch && n.ch.length) && n.lv < 4; }
  function kidsReady(n) { return !hasKids(n) || n.ch.every(function (id) { return N()[id]; }); }

  // ── 見方と戻る（場所の移動と見方の変化を、同じ履歴に積む）
  // an＝見る分析（2026-11-15 PO: 店の最初の画面は2つの分析の中身から。札で選び、部門 → 中分類 → クラスへ同じ分析のまま掘る）。wl＝雨の強さ（0＝雨 10mm〜・1＝強い雨 30mm〜）
  // open＝掘り下げで、その場で開いた行（PO 11/16「部門を選ぶと別画面に飛ばされて、今どこにいるかわからなくなる」→ 押した行のすぐ下に中を開く）。段（path）が替われば閉じる
  // mo＝本部の地図の店の比較で開いた行（店のコード、または「店のコード:分類の番号」＝店 → 部門 → 中分類 → クラスをその場で・11/17d）。mmo＝今月の型の掘り下げで開いた行。eo＝催事の掘り下げで開いた行（催事|部門|区分）。dept＝部門ごとの POS の部門の名前
  var S = { view: 'home', path: ['S'], m: 'a', an: 'yo', wl: 0, from: 0, open: [], wo: [], wm: 0, mo: [], yo: [], mmo: [], eo: [], mdp: (function () { try { return localStorage.getItem('storeops_mdp_v1') || ''; } catch (e) { return ''; } })() };   // mdp＝本部の地図の見る範囲（部門のコード・空＝全社）。この端末に覚える
  var HIST = [];
  function snap() { return JSON.stringify({ view: S.view, path: S.path, m: S.m, an: S.an, wl: S.wl, open: S.open, wo: S.wo, wm: S.wm, mo: S.mo, yo: S.yo, mmo: S.mmo, eo: S.eo, month: S.month, ev: S.ev, dept: S.dept, mdp: S.mdp, from: S.from || 0, c: CUR, y: window.scrollY }); }
  // ── 来た所（11/17e PO 問3 A・T2）: 中の釦（大きく開く・〇〇を見る・催事ごとで大きく見る など）で上の帯のタブが替わったら、その下の帯の左に「← 〇〇に戻る」。
  //   S.from＝来た所の番号（FROMS の鍵）。来た所の見方（snap）を覚え、押すとそこへ（位置も）。上の帯のタブ・利用ガイドの「この画面へ」で移ったら消す。「← ひとつ前に戻る」は覚えた見方ごと戻すので、札も元どおり
  var FROMS = {}, FROM_N = 0, NAV0 = null, LAST = { ev: '', dept: '' };
  function lensKey(v) { return v === 'status' ? 'home' : v; }
  /** 履歴に積む（見方が替わる前に1回）。kind: ''＝中の釦（タブが替われば来た所を覚える）／'tab'＝上の帯のタブ（来た所を消す）／'keep'＝来た所はそのまま／'scroll'＝位置だけ */
  function pushHist(kind) { var s = snap(); HIST.push(s); if (HIST.length > 200) HIST.shift(); NAV0 = kind === 'scroll' ? null : { k: lensKey(S.view), nm: placeName(), s: s, kind: kind || '' }; }
  function fromSettle() {
    var n = NAV0; NAV0 = null; if (!n || n.kind === 'keep') return;
    if (n.kind === 'tab') { S.from = 0; return; }
    if (lensKey(S.view) === n.k || !n.nm) return;
    FROMS[++FROM_N] = { nm: n.nm, s: n.s }; S.from = FROM_N;
    if (FROM_N > 200) delete FROMS[FROM_N - 200];   // 覚えるのは 200 まで（履歴と同じ）
  }
  /** いまの場所の名前（来た所の札・利用ガイドの「いまここ」） */
  function placeName() {
    var v = S.view, hq = ME && (ME.role === 'hq' || ME.role === 'admin');
    if (v === 'home' || v === 'status') {
      if (!CUR) return hq ? '全店のいま' : 'いまの様子';
      var n = (SUM || TREE) && S.path.length > 1 ? N()[S.path[S.path.length - 1]] : null;
      return storeName(CUR) + 'のいま' + (n ? '（' + n.n + '）' : '');
    }
    if (v === 'month') return '今月の型（' + (S.month || (new Date().getMonth() + 1)) + '月）';
    if (v === 'event') return '催事ごと' + (LAST.ev ? '（' + LAST.ev + '）' : '');
    if (v === 'dept') return '部門ごと' + (LAST.dept ? '（' + LAST.dept + '）' : '');
    return { year: '年間の流れ', wx: '天気と売れ方', admin: '更新の状態', guide: '利用ガイド' }[v] || '';
  }
  // how.part＝描き直す塊（行を押してその場で開く・閉じるときは、その塊だけを入れ替える。PO 11/17「1つ押すたびに全部を描き直さない」）。how.nav＝pushHist の kind
  function go(ch, how) { pushHist(how && how.nav); for (var k in ch) S[k] = ch[k]; if ('path' in ch && !('open' in ch)) S.open = []; if (how && how.part && redraw(how.part)) { NAV0 = null; return; } render(how || {}); }
  // ── 描き直す塊: 全体を描くときに、塊ごとに「その塊を作る関数」を覚える（全体を描くたびに作り直す＝前の画面の関数は持ち続けない）
  var PART = {};
  function blk(id, fn) { PART[id] = fn; return '<div class="blk" id="' + id + '">' + fn() + '</div>'; }
  // 閉じた「くわしく」の中身は、開いたときに描く（11/17d: 催事ごとの閉じた表2つで、開くのが CPU 4倍で約 0.05 秒重くなっていた）。印刷の前には全部描く
  var LZF = {};
  function lazyBox(id, title, fn) { LZF[id] = fn; return '<details class="det" id="' + id + '" data-lzf="1"><summary>' + esc(title) + '</summary><div class="lz"></div></details>'; }
  function fillLzf(d) { var b = d.querySelector('.lz'), fn = LZF[d.id]; if (b && fn && !b.dataset.done) { b.innerHTML = fn(); b.dataset.done = '1'; } }
  var FOCUS_KEYS = ['tog', 'mtog', 'mmo', 'eo', 'yev', 'w32', 'wl', 'wm'];
  function redraw(id) {
    var el = document.getElementById(id), fn = PART[id]; if (!el || !fn) return false;
    var a = document.activeElement, fk = '';
    if (a && a !== document.body && el.contains(a) && a.dataset) for (var i = 0; i < FOCUS_KEYS.length; i++) if (a.dataset[FOCUS_KEYS[i]] != null) { fk = '[data-' + FOCUS_KEYS[i] + '="' + String(a.dataset[FOCUS_KEYS[i]]).replace(/["\\]/g, '\\$&') + '"]'; break; }
    fhReset(); el.innerHTML = fn();
    if (fk) { var f = el.querySelector(fk); if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* 古いブラウザ */ } } }   // 押した行に、キーボードの位置を戻す
    setBack(); fhSchedule();
    return true;
  }
  function restoreSnap(str, msg) {
    NAV0 = null; var o = JSON.parse(str), y = o.y, c = o.c, same = o.view === 'guide' && S.view === 'guide'; delete o.y; delete o.c;
    for (var k in o) S[k] = o[k]; if (!o.open) S.open = []; if (c !== CUR) useStore(c);
    if (same) { setBack(); pbar(); SPY.pin = ''; glide(y); if (msg) toast(msg); return; }   // ガイドの中で戻る: 描き直さずに位置だけ
    render({ y: y, msg: msg });
  }
  function back() { if (!HIST.length) return; restoreSnap(HIST.pop(), '← 元の見方に戻りました'); }
  /** 「← 〇〇に戻る」: 来た所の見方（位置も）へ。いまの見方は履歴に積む（「← ひとつ前に戻る」で、また移った先へ） */
  function fromBack() { var f = S.from && FROMS[S.from]; if (!f) return; pushHist('keep'); restoreSnap(f.s, '← ' + f.nm + 'に戻りました'); }
  // 部門の色（行の地の淡い色＋左の帯）。🔴 正は作業フォルダの `_共通\部門の色\dept_colors.json`（ヒッスルの部門の名前とも対）。ここは写し・手で直さない（試験が正と照らす）
  // >>> 部門の色 写しここから
  var DEPT_COL = { '青果': ['#ecf6ee', '#2f855a'], '精肉': ['#fbefe8', '#a8552e'], '水産': ['#e6f3f4', '#0e7c86'], '惣菜': ['#fdf2df', '#b7650b'], '日配': ['#f0edfa', '#6a4fb6'], '一般食品': ['#f3f2e0', '#77701d'], '菓子': ['#fbecf3', '#b03a74'], '日雑': ['#eef1f5', '#566377'] };
  // <<< 部門の色 写しここまで
  // 部門の並び＝DEPT_COL の並び（正の表の並び＝ヒッスルの部門の並びが基準・PO 11/16「タブやグラフの部門の並び順は、ヒッスルを基準に統一」）。表に無い部門は後ろ（元の順のまま）
  var DEPT_ORDER = Object.keys(DEPT_COL);
  function deptBase(nm) { return String(nm || '').replace(/（.*$/, ''); }   // 「惣菜（ベーカリー除く）」→「惣菜」（別の切り方は元の部門の並びと色）
  function deptRank(nm) { var b = deptBase(nm), i = DEPT_ORDER.indexOf(b); return i < 0 ? 99 : i + (b !== nm ? 0.5 : 0); }
  function deptCol(nm) { return DEPT_COL[nm] || DEPT_COL[deptBase(nm)] || null; }
  function deptOf(n) { return deptOfT(n, N()); }
  function deptOfT(n, all) { var x = n, g = 0; while (x && x.lv > 1 && g++ < 8) x = all[x.p]; return x && x.lv === 1 ? x : null; }
  function dcStyleT(n, all, dep) { var d = deptOfT(n, all), c = d ? deptCol(d.n) : null; return (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + (dep ? '--dep:' + dep + ';' : ''); }
  function dcOf(n) { var d = deptOf(n); return d ? deptCol(d.n) : null; }
  function dcStyle(n, dep) { var c = dcOf(n); return (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + (dep ? '--dep:' + dep + ';' : ''); }

  // ── 描く
  var main = null;
  function render(how) {
    fhReset(); PART = {}; LZF = {}; fromSettle(); c3TipHide();
    setBack();
    var h = '';
    if (S.view === 'home' || S.view === 'status') h = viewHome();
    else if (S.view === 'admin') h = viewAdmin();
    else if (S.view === 'guide') h = viewGuide();
    else h = viewLens(S.view);
    main.innerHTML = h + (S.view === 'guide' ? '' : foot());
    pbar();
    if (S.view === 'guide') gdAfter();
    var es = main.querySelector('.evstrip [aria-pressed="true"]');   // 催事の選び（1行の横送り）: 選んでいる催事が見える所まで送る
    if (es) { var ep = es.parentNode, dx = es.getBoundingClientRect().left - ep.getBoundingClientRect().left; if (dx < 0 || dx + es.offsetWidth > ep.clientWidth) ep.scrollLeft += dx - 12; }
    sideNav();
    land(how);
    fhSchedule();
  }
  /** 幅のある PC（1480〜）で、札と掘り下げを左・AI のコメントと次の一手を右に並べる包み（PO 11/17e「図と AI のコメントを左右に」）。細い画面では上から 札 → AI → 掘り下げ のまま */
  function duo(tl, ai, dig) { return ai ? '<div class="duo"><div class="du-tl">' + tl + '</div><div class="du-ai">' + ai + '</div><div class="du-dig">' + dig + '</div></div>' : tl + dig; }
  function setBack() { var d = !HIST.length; $$('[data-nav="back"]').forEach(function (b) { b.disabled = d; }); }
  /** 探す欄（上の帯の中・11/17e PO「検索窓もわざわざ行を使わず、ヘッダに入れ込んでね」）: 空のまま押すと、困りごとの言葉の例を欄のすぐ下に */
  function qExamples() {
    var w = ME && ME.role === 'store' ? ['売場が溢れる', 'ロスが多い', '予約が伸びない', '雨の日', '欠品'] : ['予約が伸びない', '見切り', '節分', '進捗', 'ぎゅうにゅう'];
    return '<div class="eg"><div class="lb">例（押すと探します）。ひらがな・カタカナ・ローマ字のどれでも当たります</div><div class="chips">' + w.map(function (x) { return '<button type="button" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
  }

  // ── 左のサイド（11/17e PO「ヘッダよりもサイドに目次や地図を設置しないと、今自分がどこにいるのか分かりづらい」）
  //   画面の木（いまの画面に色の面と「いまここ」）・その下に、いまの画面の中の段（本文と連動して光る）。段の要素は持たず、id だけを持つ（描くたびに作り直す）
  var SPY = { pin: '', raf: 0 };
  function curScr() { var v = S.view; if (v === 'home' || v === 'status') return CUR ? 'home' : (ME && (ME.role === 'hq' || ME.role === 'admin') ? 'map' : 'home'); return v; }
  function secLabel(el) {
    if (el.matches('.ai')) return 'AI のコメント';
    if (el.matches('details')) return 'くわしく';
    if (el.matches('.tiles')) return '札';
    var t = el.textContent, sm = el.querySelector('small'); if (sm) t = t.replace(sm.textContent, '');
    t = t.split(' — ')[0].replace(/（.*$/, '').trim();
    if (/の分析の結果$/.test(t)) return '分析の札';
    return t.length > 18 ? t.slice(0, 17) + '…' : t;
  }
  function sideItems(v) {
    var out = '', hq = ME && (ME.role === 'hq' || ME.role === 'admin'), n = 0, seenDet = false;
    if (v === 'home' && hq) {
      out += '<button type="button" class="si pl' + (CUR ? '' : ' cur') + '" data-view="home-map">全店のいま</button>';
      if (CUR) out += '<button type="button" class="si pl cur" data-sx="lvtop">' + esc(storeName(CUR)) + 'のいま</button>';
    }
    if (v === 'guide') {
      var g = -1;
      // 段の位置は、見出しを包む箱（画面の外では中を描かない箱）で測る（見出しそのものを測ると、画面の外の中身まで並べ直させる＝開くのが遅くなる）
      $$('.guide2 h2[id], .guide2 h3[id]', main).forEach(function (h) { if (h.tagName === 'H2') g++; var box = h.parentElement && h.parentElement.firstElementChild === h && h.parentElement.id ? h.parentElement : h; out += '<button type="button" class="si' + (h.tagName === 'H3' ? ' h3 fold' : '') + '" data-sx="' + esc(box.id) + '" data-g="' + g + '">' + esc(h.textContent) + '</button>'; });
      return out;
    }
    var list = $$('h2.sec, .ai, h3.mh, details.det, .tiles', main).filter(function (el) {
      if (el.closest('.drill,.yopen,.eopen,.mleaf,details:not(.det)')) return false;
      if (el.matches('.tiles') && $('#ancards', main)) return false;
      if (el.matches('.tiles') && el.previousElementSibling && el.previousElementSibling.matches('.tiles')) return false;
      if (el.matches('details')) { if (seenDet || el.parentElement.closest('details')) return false; seenDet = true; }
      return true;
    }).slice(0, 14);
    list.forEach(function (el) { if (!el.id) el.id = 'sx' + (++n); out += '<button type="button" class="si" data-sx="' + esc(el.id) + '">' + esc(secLabel(el)) + '</button>'; });
    return out;
  }
  function sideNav() {
    var v = S.view === 'status' ? 'home' : S.view;
    $$('#side [data-lens]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lens === v)); });
    var ad = $('#side [data-lens="admin"]'); if (ad) ad.hidden = !(ME && ME.role === 'admin');
    var gb = $('#guidebtn'); if (gb) gb.setAttribute('aria-pressed', String(v === 'guide'));
    var items = sideItems(v);
    $$('#side .sub').forEach(function (s) { var on = s.dataset.sub === v; s.classList.toggle('on', on); s.innerHTML = on ? items : ''; });
    SPY.pin = ''; sideSpySoon();   // 光らせるのは次のコマで（描いた直後に位置を読んで、並べ直しを何度も起こさない）
  }
  /** 本文と連動して、いま読んでいる段を光らせる（いちばん下では、見えている最後の段） */
  function sideSpy() {
    var sub = $('#side .sub.on'); if (!sub) return;
    var ls = $$('.si[data-sx]', sub); if (!ls.length) return;
    var lim = stickyH() + 48, at = null, bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    ls.forEach(function (l) { var e = document.getElementById(l.dataset.sx); if (!e) return; var t = e.getBoundingClientRect().top; if (t <= lim || (bottom && t < window.innerHeight)) at = l; });
    if (SPY.pin) { var p = ls.filter(function (l) { return l.dataset.sx === SPY.pin; })[0]; if (p) at = p; }
    if (!at) at = ls[0];
    ls.forEach(function (l) { l.classList.toggle('on', l === at); });
    if (S.view === 'guide') { var g = at.dataset.g; ls.forEach(function (l) { if (l.classList.contains('h3')) l.classList.toggle('fold', l.dataset.g !== g); }); }
    var side = $('#side'), r = at.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (side.scrollHeight > side.clientHeight && (r.top < s.top + 20 || r.bottom > s.bottom - 10)) side.scrollTop += r.top - s.top - s.height / 3;
  }
  function sideSpySoon() { if (SPY.raf) return; SPY.raf = requestAnimationFrame(function () { SPY.raf = 0; sideSpy(); }); }
  function sideGo(id) {
    var el = document.getElementById(id); if (!el) return;
    pushHist('scroll'); setBack(); SPY.pin = id;
    glide(window.scrollY + el.getBoundingClientRect().top - stickyH() - 8);
    el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed');
    sideSpy();
  }
  function narrowNav() { return window.innerWidth <= 900; }
  function sideOpen(on) { var s = $('#side'); s.classList.toggle('on', !!on); $('#menubtn').setAttribute('aria-expanded', String(!!on)); }

  // ── 利用ガイド（11/17e）: 右上の「？ 利用ガイド」で、本文の画面として開く（サイドにガイドの節・本文と連動）。中身は窓口の Guide.html（ログインした役目の1節だけが届く）。
  //   最初の画面のあと裏で1回受け取る（押したときの往復 0）。開く前の画面に「いまここ」・「この画面へ ▸」でその画面へ・来た所の札で元の画面へ
  var GD = { html: null, p: null, cache: '', role: '', here: null };
  function gdFetch() {
    if (GD.html || GD.p || !ME) return GD.p;
    GD.p = AUTH.call('statusGuide').then(function (r) {
      GD.p = null;
      if (r && r.ok && r.html) { GD.html = r.html; if (S.view === 'guide') render({ keep: true }); else gdWarmSoon(); }
      else if (S.view === 'guide') { onFail(r); main.innerHTML = '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド</h1><div class="box"><p style="margin:0">利用ガイドを読み込めませんでした。左の「利用ガイド」を、もう一度押してください。</p></div>'; }
    }, function () { GD.p = null; if (S.view === 'guide') { toast('通信できませんでした。'); main.innerHTML = '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド</h1><div class="box"><p style="margin:0">通信できませんでした。左の「利用ガイド」を、もう一度押してください。</p></div>'; } });
    return GD.p;
  }
  /** 初めて開くときの字の並べ（はじめての字の形を作る・CPU 4倍で約1秒）を、手の空いたときに先に済ませる: 画面の地図の段だけを、画面の外で1回並べて捨てる */
  function gdWarmSoon() { var f = function () { gdWarm(); }; if (window.requestIdleCallback) requestIdleCallback(f, { timeout: 5000 }); else setTimeout(f, 1500); }
  function gdWarm() {
    if (!GD.html || S.view === 'guide' || !main) return;
    var src = document.createElement('div'); src.innerHTML = gdPrepared();
    var mp = src.querySelector('#g-map'); if (!mp) return;
    mp.removeAttribute('id'); $$('[id]', mp).forEach(function (x) { x.removeAttribute('id'); });   // 本物と同じ id を2つ置かない
    var d = document.createElement('div'); d.className = 'guide2'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;width:' + main.clientWidth + 'px';
    d.appendChild(mp); main.appendChild(d); void d.offsetHeight; d.remove();
  }
  /** ガイドの本文（1回だけ作って覚える）: 狭い画面のために、番号の説明を模式図のかたまりの中にも入れる（広い画面では隠れている） */
  function gdPrepared() {
    if (GD.cache) return GD.cache;
    var d = document.createElement('div'); d.innerHTML = safeHtml(GD.html);
    var sec = d.querySelector('section[data-role-nm]'); GD.role = sec ? sec.getAttribute('data-role-nm') : '';
    $$('.scr', d).forEach(function (sc) {
      var mk = $('.mock', sc), ol = $('ol.co', sc); if (!mk || !ol) return;
      var lis = $$('li', ol); if (!lis.every(function (li) { return !!$('.mk-blk[data-n="' + li.getAttribute('data-n') + '"]', mk); })) return;
      lis.forEach(function (li) { var b = $('.mk-blk[data-n="' + li.getAttribute('data-n') + '"] .mk-in', mk), c = document.createElement('span'); c.className = 'cap'; c.innerHTML = li.innerHTML; b.appendChild(c); });
      sc.classList.add('capped');
    });
    GD.cache = d.innerHTML;
    return GD.cache;
  }
  function viewGuide() {
    if (!GD.html) { gdFetch(); return '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド</h1><div class="hint wait"><span class="spin" aria-hidden="true"></span>利用ガイドを読み込んでいます…</div>'; }
    var body = gdPrepared();
    return '<h1 class="vt" id="lvtop">店舗運営/MDの辞書利用ガイド' + (GD.role ? '<small>' + esc(GD.role) + '</small>' : '') + '</h1><div class="guide2">' + body + '</div>';
  }
  /** ガイドを描いたあと: 画面の地図の「いまここ」（ガイドを開く前の画面）・狭い画面ではつながりの箱を閉じる・いまここの見つけ方の最初の例 */
  function gdAfter() {
    var root = $('#smap', main); if (!root) return;
    var h = GD.here || { scr: 'home', nm: '' };
    $$('.here', root).forEach(function (x) { x.classList.remove('here'); });
    var all = $$('.sbox[data-scr="' + h.scr + '"]', root), b = root.classList.contains('open') ? all[0] : all.filter(function (x) { return !x.closest('.steps'); })[0];   // 位置を読まずに決める（段をたたんでいるときは、段の中の箱は見えない）
    if (!b && all[0] && all[0].closest('.scol')) b = $('.sbox.head', all[0].closest('.scol'));
    if (!b) b = $('.sbox.head[data-scr="' + (h.scr === 'map' ? 'home' : h.scr) + '"]', root);
    if (b) b.classList.add('here');
    var nm = $('#gnow', main); if (nm) nm.textContent = h.nm || '―';
    if (window.innerWidth <= 760) $$('details.conn', main).forEach(function (x) { x.open = false; });
    var first = $('.hx', main); if (first) gdSetHere(first);
  }
  function openGuide() {
    if (S.view === 'guide') { if (S.from && FROMS[S.from]) fromBack(); return; }   // ガイドの中でもう一度押すと、来た所へ
    GD.here = { scr: curScr(), nm: placeName() };
    go({ view: 'guide' }, { top: true });   // 来た所の札（← 〇〇に戻る）が出る
  }
  function gdSetHere(btn) {
    $$('.hx', main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
    var m = $('#hmock', main); if (!m) return;
    var tab = btn.getAttribute('data-tab'), ch = btn.getAttribute('data-chip');
    $$('.ms', m).forEach(function (t) { t.classList.toggle('on', t.textContent === tab); });
    $('.mk-crumb', m).textContent = btn.getAttribute('data-crumb');
    var cb = $('.mk-chipb', m); if (cb) { cb.textContent = ch ? '← ' + ch + 'に戻る' : ''; cb.hidden = !ch; }
    var h1 = $('#hm-h1', m); h1.textContent = btn.getAttribute('data-h1') + ' '; var sm = document.createElement('small'); sm.textContent = btn.getAttribute('data-h1s'); h1.appendChild(sm);
    var mp = $('#hm-map', main); if (mp) mp.textContent = btn.getAttribute('data-mapnm');
  }
  /** ガイドの中を押した: 地図の箱・見たいこと・リンク＝ガイドの中で移る（光らせる）／「この画面へ ▸」＝その画面へ */
  function gdClick(e) {
    var t = e.target, op = t.closest('[data-open]');
    if (op) { e.preventDefault(); gdOpenScreen(op.getAttribute('data-open')); return true; }
    var more = t.closest('.sm-more');
    if (more) { var root = more.closest('.smap'), o = !root.classList.contains('open'); root.classList.toggle('open', o); more.setAttribute('aria-expanded', String(o)); more.textContent = o ? '画面の中の段をたたむ ▴' : '画面の中の段も見る ▾'; gdAfter(); return true; }
    var hx = t.closest('.hx'); if (hx) { gdSetHere(hx); return true; }
    var a = t.closest('[data-go]');
    if (a) { e.preventDefault(); gdGo(a.getAttribute('data-go'), a.getAttribute('data-co')); return true; }
    return false;
  }
  function gdGo(id, co) {
    var el = document.getElementById(id); if (!el || !el.getClientRects().length) { toast('その説明は、このガイドにはありません'); return; }
    var tgt = el, off = 10;
    if (co) { var b = $$('.mk-blk[data-n="' + co + '"]', el).filter(function (x) { return x.getClientRects().length; })[0] || $$('ol.co li[data-n="' + co + '"]', el).filter(function (x) { return x.getClientRects().length; })[0]; if (b) { tgt = b; off = Math.min(140, window.innerHeight * 0.2); } }
    pushHist('scroll'); setBack();
    var hh = el.matches('h2,h3') ? el : el.querySelector('h2,h3'); SPY.pin = hh && hh.id ? hh.id : '';
    glide(window.scrollY + tgt.getBoundingClientRect().top - stickyH() - off);
    setTimeout(function () {
      if (co) $$('.mk-blk[data-n="' + co + '"],ol.co li[data-n="' + co + '"]', el).filter(function (x) { return x.getClientRects().length; }).forEach(function (x) { x.classList.remove('pulse'); void x.offsetWidth; x.classList.add('pulse'); });
      else { var f = el.closest('.scrsec') || el; f.classList.remove('landed'); void f.offsetWidth; f.classList.add('landed'); }
    }, 300);
    sideSpy();
  }
  function gdOpenScreen(s) {
    var nm = { home: 'いまの様子', map: '全店のいま', month: '今月の型', event: '催事ごと', year: '年間の流れ', dept: '部門ごと', wx: '天気と売れ方', admin: '更新の状態' }[s];
    if (!nm) return;
    if (s === 'map') { pushHist('tab'); useStore(''); S.view = 'home'; S.path = ['S']; S.open = []; render({ top: true }); }
    else if (s === 'home') go({ view: 'home', path: ['S'] }, { top: true, nav: 'tab' });
    else go({ view: s }, { top: true, nav: 'tab' });
    toast('「' + nm + '」を開きました');
  }
  function foot() {
    var m = (TREE || SUM) && meta();
    return '<div class="foot">' + (m && m.per ? '数は ' + esc(m.per.sales[0]) + '〜' + esc(m.per.sales[1]) + '（前年比は直近4週 ' + esc(m.per.yoy[0]) + '〜' + esc(m.per.yoy[1]) + '）' : '') + (ME ? '｜' + esc(ME.email) + '（' + esc(roleLabel()) + '）' : '') + '</div>';
  }
  /** 別のページへ出る印（11/17e PO 問4 A: 別のページは新しいタブで開く。日本語の書体に「↗」が無い端末があるので、その場の絵で） */
  var EXT = '<svg class="ext" viewBox="0 0 12 12" aria-label="新しいタブで開きます" role="img"><path d="M5 2h5v5M10 2L3.5 8.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 8.5V10H2V4h1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  function extA(href, inner, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + href + '" target="_blank" rel="noopener" title="新しいタブで開きます（この画面はそのまま）">' + inner + EXT + '</a>'; }
  /** ほかの画面への入口（上の帯の「ほかの画面」）。分析レポートと動画は本部・管理者だけに出す（見られる範囲は、それぞれの窓口が呼び出しのたびに決める）。新しいタブで開く */
  function appLinks() {
    var hq = ME && (ME.role === 'hq' || ME.role === 'admin');
    var L = (hq ? [['reports/', '分析レポート', '結果票・売れ方ロス天気（本部だけ）'], ['video/', 'AI教材の動画', '学ぶ（本部のドメイン）']] : []).concat([['classic/', '前の辞書の画面', '話題の棚・教える・テーマ索引・天気の根拠の図']]);
    return L.map(function (x) { return '<a href="' + x[0] + '" target="_blank" rel="noopener" title="' + esc(x[1]) + '（新しいタブで開きます・この画面はそのまま）">' + esc(x[1]) + EXT + '<small>' + esc(x[2]) + '</small></a>'; }).join('');
  }
  function roleLabel() { return ME.role === 'store' ? '店・' + (ME.label || '') : ME.role === 'hq' ? '本部' : ME.role === 'admin' ? '管理者' : '役目なし'; }
  /** 来た所の札（その下の帯の左）。字は「← 部門ごと（惣菜）に戻る」。スマホでは（ ）の中を隠す */
  function fromChip() {
    var f = S.from && FROMS[S.from], w = $('#fromwrap'); if (!w) return;
    var nm = f ? f.nm : '';
    if (w.dataset.nm === nm) return;   // 同じ札なら作り直さない
    w.dataset.nm = nm;
    if (!f) { w.innerHTML = ''; return; }
    var i = nm.indexOf('（'), base = i > 0 ? nm.slice(0, i) : nm, det = i > 0 ? nm.slice(i) : '';
    w.innerHTML = '<button type="button" id="fromchip" title="来た所（' + esc(nm) + '）の、見ていた位置へ戻ります"><span aria-hidden="true">←&nbsp;</span><span>' + esc(base) + '</span><span class="fd">' + esc(det) + '</span><span>に戻る</span></button>';
  }
  function pbar() {
    var c = $('#crumb'), m = $('#metric'), up = $('#upbtn');
    fromChip();
    var hqPre = ME && (ME.role === 'hq' || ME.role === 'admin') ? '<button type="button" data-view="home-map">全店のいま</button>' + (CUR ? '<span class="sep">›</span>' : '') : '';
    if ((S.view === 'home' || S.view === 'status') && !CUR && hqPre) {
      c.innerHTML = '<span class="cur">全店のいま</span>'; up.style.visibility = 'hidden'; m.style.display = '';
      m.innerHTML = '<span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + MK[k].nm + '</button>'; }).join('');
      return;
    }
    if ((S.view === 'home' || S.view === 'status') && (SUM || TREE)) {
      c.innerHTML = hqPre + S.path.map(function (id, i) { var n = N()[id]; var nm = n ? n.n : '…'; return (i ? '<span class="sep">›</span>' : '') + (i === S.path.length - 1 ? '<span class="cur">' + esc(nm) + '</span>' : '<button type="button" data-crumb="' + i + '">' + esc(nm) + '</button>'); }).join('');
      up.style.visibility = S.path.length > 1 ? 'visible' : 'hidden';
      m.style.display = AN_M[S.an] ? '' : 'none';   // 見る数（売上・販売数・来客数・単価）で替わる分析だけに出す
      m.innerHTML = '<span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + MK[k].nm + '</button>'; }).join('');
    } else {
      c.innerHTML = '<span class="cur">' + esc({ home: 'いまの様子', admin: '更新の状態', guide: '店舗運営/MDの辞書利用ガイド', month: '今月の型', event: '催事ごと', year: '年間の流れ', dept: '部門ごと', wx: '天気と売れ方' }[S.view] || '') + '</span>';
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
  /** 本部: 全体の地図（全社の札 → AI のコメント → 次の一手 → エリアごとの店の札 → くわしく＝店の一覧の表）。店の並びは正の並び（部門損益検討表の順）
   *  見る範囲（PO 11/16 夜「本部の冒頭もバイヤーが見るので、部門で選んでデータを切り替えられることが重要。全体を見る課長クラス以上と、部門ごとに全体や各店舗を見るバイヤー目線の、どちらも見やすく」）:
   *  「全社（全部門）」か部門を選ぶと、札・AI のコメント・次の一手・店の札・一覧の表が、その部門の数に替わる。店の札を押すと、その店の、その部門が開く。選んだ範囲は、この端末に覚える */
  function nz(v) { return v === null || v === undefined ? NaN : v; }
  function mapDl(M) { return (M.dl || []).slice().sort(function (a, b) { return deptRank(a.n) - deptRank(b.n); }); }
  function mapDep(M) { var d = S.mdp; return d && (M.dl || []).some(function (x) { return x.id === d; }) ? d : ''; }
  function mapPick(o, d) { return d ? (o.dp && o.dp[d]) || null : o; }
  function mapYo(o, m, d) { var x = mapPick(o, d); return x && x.m && x.m[m] && isFinite(x.m[m].yo) && x.m[m].yo !== null ? pct(x.m[m].yo) : NaN; }
  function mapVal(o, m, d) { var x = mapPick(o, d); return x && x.m && x.m[m] && x.m[m].d !== null ? x.m[m].d : NaN; }
  function mapDeptBar(M, d) {
    var dl = mapDl(M); if (!dl.length) return '';
    var b = function (id, nm, c) { return '<button type="button" data-mdp="' + esc(id) + '" aria-pressed="' + (id === d) + '"' + (c ? ' style="--dbg:' + c[0] + ';--dac:' + c[1] + '"' : '') + '>' + (c ? '<i aria-hidden="true"></i>' : '') + esc(nm) + '</button>'; };
    return '<div class="dsel" role="group" aria-label="見る範囲（部門）"><span class="lb">見る範囲</span>' + b('', '全社（全部門）', null) + dl.map(function (x) { return b(x.id, x.n, deptCol(x.n)); }).join('') + '</div>';
  }
  /** 本部の冒頭（PO 11/16 夜「本部で入ったときに、全体俯瞰の結果が冒頭に無い。エリア別・店舗別の比較を見てから店へドリルダウンする。
   *  普段の動き・天気・広告など、常に全体俯瞰から降りられる＋見やすい図解やグラフ」）:
   *  全社の分析の札（6つ・店のステータスと同じ）→ AI のコメント → 次の一手 → 比べる図（エリア → 店。同じ目盛り。店の行を押すと、その店の・その部門の・その分析が開く）
   *  → エリアごとの店の札（たたむ）→ 店の一覧の表。見る範囲（全社／部門）・見る数は、どの図にも効く */
  var MAP_HRS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  function mapNum(v) { return v === null || v === undefined ? NaN : v; }
  function median(a) { var b = a.filter(isFinite).slice().sort(function (p, q) { return p - q; }); if (!b.length) return NaN; var h = b.length >> 1; return b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2; }
  /** 1つの店（か店の部門）の、選んだ分析の値。d＝並べる値・t＝主の数（名前のすぐ右）・t2＝比べる用の添え（棒の右・かっこ付き） */
  function mapLens(x, an, m) {
    if (!x) return null;
    var ov = x.ov || {};
    if (an === 'yo') { var mm = x.m && x.m[m], yy = mm ? mapNum(mm.yo) : NaN; return isFinite(yy) && yy > 0 ? { d: pct(yy), t: sg(pct(yy)) + '%', t2: num(mapNum(mm.d), m === 'a' ? 1 : 0) + MK[m].u } : null; }
    if (an === 'wx') { var w = ov.wx && ov.wx[m === 'q' ? 'a' : m], v = w ? mapNum(w[S.wl]) : NaN, o = w ? mapNum(w[1 - S.wl]) : NaN; return isFinite(v) ? { d: v, t: sg(v) + '%', t2: isFinite(o) ? (S.wl ? '雨 ' : '強い雨 ') + sg(o) + '%' : '' } : null; }
    if (an === 'ad') { var a = ov.ad; return a && isFinite(mapNum(a.L)) ? { d: a.L, t: num(a.L, 2) + '倍', t2: '比べた ' + num(a.nc) + '件' } : null; }
    if (an === 'ls') { var l = mapNum(x.ls); return isFinite(l) ? { d: l, t: num(l, 1) + '%', t2: '' } : null; }
    if (an === 'md') { var f = ov.md; return f && f.n ? { d: f.down / f.n * 100, f: f, t: f.down + '/' + f.n + '回', t2: '上回った ' + f.up + '回' } : null; }
    if (an === 'tm') {
      var dw = ov.dw && (ov.dw[m] || ov.dw.a), hp = ov.hp; if (!dw) return null;
      var hi = maxAt(dw), lo = minAt(dw), ph = maxAt(hp || []);
      return { d: hi >= 0 ? dw[hi] : NaN, dw: dw, hi: hi, lo: lo, ph: ph, t: hi >= 0 ? dayNm(hi) : '―', t2: ph >= 0 ? '峰 ' + MAP_HRS[ph] + '時' : '' };
    }
    return null;
  }
  /** 店の木の1つの分類の、選んだ分析の値（地図の mapLens と同じ形・同じ数の選び方）。本部の地図で、部門より下をその場で開くとき（11/17d） */
  function treeLens(n, an, m) {
    if (!n) return null;
    if (an === 'yo') { var yy = m === 'a' ? n.yo : (n.mt && n.mt[m] ? n.mt[m].yo : NaN); if (!(isFinite(yy) && yy > 0)) return null; var vv = mval(n, m); return { d: pct(yy), t: sg(pct(yy)) + '%', t2: isFinite(vv) ? num(vv, m === 'a' ? 1 : 0) + MK[m].u : '' }; }
    if (an === 'wx') { var W = n.wxs && n.wxs[m === 'q' ? 'a' : m], w = W && W[S.wl], o = W && W[1 - S.wl]; return w && isFinite(w[0]) ? { d: w[0], t: sg(w[0]) + '%', t2: o && isFinite(o[0]) ? (S.wl ? '雨 ' : '強い雨 ') + sg(o[0]) + '%' : '' } : null; }
    if (an === 'ad') { var a = n.ad; return a && isFinite(a.L) ? { d: a.L, t: num(a.L, 2) + '倍', t2: '比べた ' + num(a.nc) + '件' } : null; }
    if (an === 'ls') return n.ls && isFinite(n.ls[2]) ? { d: n.ls[2], t: num(n.ls[2], 1) + '%', t2: '' } : null;
    if (an === 'md') { var f = n.m5; return f && f.n ? { d: f.down / f.n * 100, f: f, t: f.down + '/' + f.n + '回', t2: '上回った ' + f.up + '回' } : null; }
    if (an === 'tm') {
      var dw = (m === 'a' ? n.dw : (n.dwm && n.dwm[m])) || n.dw; if (!dw) return null;
      var H = n.h && (n.h[m === 'u' ? 'a' : m] || n.h.a), tot = [];
      if (H) H.forEach(function (r) { (r || []).forEach(function (v, j) { if (isFinite(v)) tot[j] = (tot[j] || 0) + v; }); });
      var hi = maxAt(dw), ph = maxAt(tot);
      return { d: hi >= 0 ? dw[hi] : NaN, dw: dw, hi: hi, lo: minAt(dw), ph: ph, t: hi >= 0 ? dayNm(hi) : '―', t2: ph >= 0 ? '峰 ' + MAP_HRS[ph] + '時' : '' };
    }
    return null;
  }
  /** 店の集まり（全社・エリア）の、選んだ分析の値。前年比・ロス率・52週MD は足し算から（重みつき・全店）、ほかは店の中央（ほかの店と比べない店〈nc〉は入れない） */
  function mapAgg(list, an, m, d) {
    // 足し算の値（前年比・ロス・52週MD）は、比べない店も入れた計（全社の札と同じ値）。比べない店を外すのは、店を並べた中央の値だけ（PO 11/14・11/16 夜）
    var sumAn = an === 'yo' || an === 'ls' || an === 'md';
    var xs = list.filter(function (s) { return sumAn || !s.nc; }).map(function (s) { return mapPick(s, d); }).filter(Boolean);
    if (!xs.length) return null;
    if (an === 'yo') {
      var sum = function (k) { var c = 0, p = 0; xs.forEach(function (x) { var mm = x.m && x.m[k], dd = mm ? mapNum(mm.d) : NaN, yy = mm ? mapNum(mm.yo) : NaN; if (isFinite(dd) && isFinite(yy) && yy > 0) { c += dd; p += dd / yy; } }); return [c, p]; };
      var r = m === 'u' ? (function () { var A = sum('a'), C = sum('c'); return C[0] && C[1] && A[1] ? [A[0] / C[0], A[1] / C[1]] : [NaN, NaN]; })() : sum(m);
      return r[1] ? { d: pct(r[0] / r[1]), t: sg(pct(r[0] / r[1])) + '%' } : null;
    }
    if (an === 'ls') {
      var lw = 0, ww = 0; xs.forEach(function (x) { var l = mapNum(x.ls), a = x.m && x.m.a ? mapNum(x.m.a.d) : NaN; if (isFinite(l) && isFinite(a)) { lw += l * a; ww += a; } });
      return ww ? { d: lw / ww, t: num(lw / ww, 1) + '%' } : null;
    }
    if (an === 'md') {
      var f = { n: 0, up: 0, flat: 0, down: 0 }; xs.forEach(function (x) { var g = x.ov && x.ov.md; if (g && g.n) ['n', 'up', 'flat', 'down'].forEach(function (k) { f[k] += g[k] || 0; }); });
      return f.n ? { d: f.down / f.n * 100, f: f, t: f.down + '/' + f.n + '回' } : null;
    }
    if (an === 'tm') {
      var L = xs.map(function (x) { return mapLens(x, 'tm', m); }).filter(Boolean); if (!L.length) return null;
      var dw = L[0].dw.map(function (_, i) { return median(L.map(function (o) { return o.dw[i]; })); });
      var hps = xs.map(function (x) { return x.ov && x.ov.hp; }).filter(Boolean), hp = hps.length ? hps[0].map(function (_, j) { return median(hps.map(function (h) { return h[j]; })); }) : null;
      var hi = maxAt(dw), ph = maxAt(hp || []);
      return { d: hi >= 0 ? dw[hi] : NaN, dw: dw, hi: hi, lo: minAt(dw), ph: ph, t: hi >= 0 ? dayNm(hi) : '―', t2: ph >= 0 ? '峰 ' + MAP_HRS[ph] + '時' : '' };
    }
    var md = median(xs.map(function (x) { var o = mapLens(x, an, m); return o ? o.d : NaN; }));
    return isFinite(md) ? { d: md, t: an === 'ad' ? num(md, 2) + '倍' : sg(md) + '%' } : null;
  }
  /** 曜日の形の小さな棒（ふだん＝1.00 の線から上下・どの行も同じ目盛り mt） */
  function dwProf(dw, mt) {
    var BW = 15, GP = 6, n = dw.length, PW = n * (BW + GP) - GP + 4, PH = 44, MID = 22, o = '<svg class="dwp" width="100%" height="' + PH + '" viewBox="0 0 ' + PW + ' ' + PH + '" preserveAspectRatio="none" style="max-width:460px" aria-hidden="true">';
    for (var i = 5; i < n; i++) o += '<rect x="' + (i * (BW + GP) - 2) + '" y="0" width="' + (BW + 4) + '" height="' + PH + '" fill="rgba(234,138,40,.10)"/>';
    o += '<line x1="0" x2="' + PW + '" y1="' + MID + '" y2="' + MID + '" stroke="#64748b" stroke-width="1"/>';
    dw.forEach(function (v, i) { if (!isFinite(v)) return; var h = Math.max(1.5, Math.min(1, Math.abs(v - 1) / mt) * (MID - 3)), up = v >= 1; o += '<rect x="' + i * (BW + GP) + '" y="' + (up ? MID - h : MID).toFixed(1) + '" width="' + BW + '" height="' + h.toFixed(1) + '" fill="' + (up ? '#5b8fd6' : '#e07a6e') + '"/>'; });
    return o + '</svg>';
  }
  function mapTiles(M, d, m, mn, stores, has) {
    var co = mapPick(M.co, d) || { m: {} }, an = S.an, o = [];
    var dy = mapYo(M.co, m, d), below = has.filter(function (s) { return mapYo(s, m, d) < 0; }).length;
    o.push({ an: 'yo', nm: mn(m) + 'の前年比', u: MK[m].u, v: num(mapVal(M.co, m, d), 0), yy: dy, g: dy, sub2: ['a', 'c', 'u'].filter(function (k) { return k !== m; }).map(function (k) { return mn(k) + ' ' + sg(mapYo(M.co, k, d)) + '%'; }).join('・'), rule: '前年を下回った店 <b>' + below + '</b>／' + has.length + '店', sel: an === 'yo' });
    var w1 = (function () { var k = S.wl; S.wl = 1; var r = mapAgg(stores, 'wx', m, d); S.wl = 0; var r0 = mapAgg(stores, 'wx', m, d); S.wl = k; return [r0, r]; })();
    o.push({ an: 'wx', nm: '雨の日の効き', u: mn(m === 'q' ? 'a' : m), v: w1[1] ? sg(w1[1].d) + '<small>%</small>' : '―', sub: w1[1] ? '強い雨の日・ふだんの同じ曜日との差（店の中央）' : '雨の日の数がありません', sub2: w1[0] ? '雨（10mm〜）の日 ' + sg(w1[0].d) + '%' : '', g: w1[1] ? w1[1].d : null, sel: an === 'wx' });
    var a = mapAgg(stores, 'ad', m, d);
    o.push({ an: 'ad', nm: '広告の効き', u: '倍', v: a ? num(a.d, 2) + '<small>倍</small>' : '―', sub: a ? '特売の日の販売数 ÷ ふだん（店の中央）' : '広告の数がありません', sel: an === 'ad' });
    var f = mapAgg(stores, 'md', m, d);
    o.push({ an: 'md', nm: '52週MD', u: '回', v: f ? '下回り ' + f.f.down + '<small>回</small>' : '―', sub: f ? f.f.n + '回のうち（上回り ' + f.f.up + '・並み ' + f.f.flat + '）' : '計画は部門・中分類ごと', sel: an === 'md' });
    o.push({ an: 'ls', nm: 'ロス率', u: '%', v: isFinite(mapNum(co.ls)) ? num(co.ls, 1) + '<small>%</small>' : '―', sub: '売上の重みをつけた計', sel: an === 'ls' });
    var t = mapAgg(stores, 'tm', m, d);
    o.push({ an: 'tm', nm: '曜日・時間帯', u: '', v: t && t.hi >= 0 ? dayNm(t.hi) + '<small>がいちばん多い</small>' : '―', sub: t && t.hi >= 0 ? 'ふだんの ' + t.d.toFixed(2) + '倍（店の中央・' + mn(m) + '）' : '曜日の数がありません', sub2: t && t.ph >= 0 ? '峰の時刻 ' + MAP_HRS[t.ph] + '時（店の中央）' : '', sel: an === 'tm' });
    return o;
  }
  /** 全社の AI のコメント（選んだ分析・決まった読み方で文にした物。新しい数は作らない・原因は1つに決めない） */
  function mapText(M, d, dn, m, mn, stores, rows) {
    var an = S.an, whole = '全社' + (dn ? 'の' + dn : ''), ok = rows.filter(function (r) { return r.v && !r.s.nc; });
    var ar = M.areas.map(function (a) { var g = mapAgg(a.stores, an, m, d); return g ? a.nm + ' ' + g.t : ''; }).filter(Boolean).join('・');
    var lo = ok.slice().sort(function (p, q) { return p.v.d - q.v.d; }), w = lo[0], b = lo[lo.length - 1];
    if (!ok.length) return null;
    if (an === 'yo') {
      var below = ok.filter(function (r) { return r.v.d < 0; }).length;
      return { r: whole + 'の' + mn(m) + 'は、前年より ' + sg(mapYo(M.co, m, d)) + '%（直近4週）。エリアでは ' + ar + '。前年を下回った店は ' + ok.length + '店のうち ' + below + '店。いちばん下がったのは' + w.s.nm + '（' + w.v.t + '）、いちばん伸びたのは' + b.s.nm + '（' + b.v.t + '）。',
        y: '店の差は、記録だけでは見分けられません。考えられるのは、①まわりの様子（住宅地・道路沿い・農村）と客数の動き ②品ぞろえと売場 ③広告の量と効き ④天気（雨の多い週か）。',
        s: '下回った店のうち、' + w.s.nm + (dn ? 'の' + dn : '') + 'から見る（店を押すと、その店の' + (dn ? dn + 'の中分類' : '部門') + 'まで掘れる）。同じ型でうまくやれている店の売り方と並べ、店の型ごとに次にすることを決める。', w: w };
    }
    if (an === 'wx') {
      return { r: WL[S.wl] + 'の日の' + mn(m === 'q' ? 'a' : m) + 'は、店の中央で、ふだんの同じ曜日より ' + (mapAgg(stores, 'wx', m, d) || { t: '―' }).t + '。エリアでは ' + ar + '（店の中央）。いちばん落ちるのは' + w.s.nm + '（' + w.v.t + '）、落ちにくいのは' + b.s.nm + '（' + b.v.t + '）。',
        y: '全店の分析では、雨の日は重い物・かさばる物・急がない物が後回しにされやすい。店の差は、まわりの様子（車で来る店か、歩き・自転車で来る店か）でも変わる。どれかは、記録だけでは見分けられない。',
        s: '落ちの大きい店から、雨の予報の日の作る量・発注・並べ方を見直す（店を押すと、その店の雨の日の効きを、部門・中分類まで掘れる）。どこまで減らすかは、売場で確かめてから決める。', w: w };
    }
    if (an === 'ad') {
      return { r: '特売の日の販売数は、店の中央で、ふだんの ' + (mapAgg(stores, 'ad', m, d) || { t: '―' }).t + '。エリアでは ' + ar + '。よく効くのは' + b.s.nm + '（' + b.v.t + '）、効きにくいのは' + w.s.nm + '（' + w.v.t + '）。',
        y: '効きは、値下げの深さ・品・並べ方・載せた号で変わる。よく売れても、深い値下げ・数量限定の品は、原価を割る集客用のことがある。',
        s: '効きにくい店から、載った品の売場と量を確かめる（店を押すと、その店でよく効いた品が見られる）。次も載せるかは、粗利を確かめてから決める。', w: w };
    }
    if (an === 'ls') {
      var hi = ok.slice().sort(function (p, q) { return q.v.d - p.v.d; });
      return { r: whole + 'のロス率は ' + num(mapNum((mapPick(M.co, d) || {}).ls), 1) + '%（売上の重みをつけた計）。エリアでは ' + ar + '。いちばん高いのは' + hi[0].s.nm + '（' + hi[0].v.t + '）、低いのは' + hi[hi.length - 1].s.nm + '（' + hi[hi.length - 1].v.t + '）。',
        y: '見込み: 作る量・仕入れの量／原料の見切り品を加工に回している／鮮度を厳しく見て早めに値引きしている／値引きの深さ・時刻の決まり。どれかは、記録からは見分けられない（売場で確かめる）。',
        s: hi[0].s.nm + 'から、作る量・並べ方を先に見直す（店を押すと、部門・中分類のロスまで掘れる）。値引きの率や時刻は、そのあとに見直す。', w: hi[0] };
    }
    if (an === 'md') {
      var g = (mapAgg(stores, 'md', m, d) || { f: { n: 0, up: 0, flat: 0, down: 0 } }).f, dn2 = ok.slice().sort(function (p, q) { return q.v.d - p.v.d; });
      return { r: '52週MD の計画と比べた ' + g.n + '回のうち、上回った ' + g.up + '・並み ' + g.flat + '・下回った ' + g.down + '。下回りの割合がいちばん大きいのは' + dn2[0].s.nm + '（' + Math.round(dn2[0].v.d) + '%）。',
        y: '計画との差は、売場の位置・量・時期のずれのほか、天気・広告の重なりでも出る。どれかは、記録だけでは見分けられない。',
        s: dn2[0].s.nm + 'から、イチオシ品の売場と量を計画どおりにできたかを、回ごとに確かめる（店を押すと、回ごとの表が見られる）。', w: dn2[0] };
    }
    if (an === 'tm') {
      var t = mapAgg(stores, 'tm', m, d); if (!t || t.hi < 0) return null;
      var areas = M.areas.map(function (a) { var g2 = mapAgg(a.stores, 'tm', m, d); return g2 && g2.hi >= 0 ? a.nm + ' ' + dayNm(g2.hi) + (g2.ph >= 0 ? '・峰 ' + MAP_HRS[g2.ph] + '時' : '') : ''; }).filter(Boolean).join('／');
      return { r: '店の中央では、いちばん多い曜日は' + dayNm(t.hi) + '（ふだんの ' + t.d.toFixed(2) + '倍）、少ないのは' + dayNm(t.lo) + '。' + (t.ph >= 0 ? '峰の時刻は ' + MAP_HRS[t.ph] + '時。' : '') + 'エリアでは ' + areas + '。',
        y: '曜日と時刻の型は、まわりの様子と、来るお客様の暮らし方で決まる。祝日・行事の日は別に考える。',
        s: '曜日の形が全社の中央と違う店から見る（店を押すと、その店の曜日 × 時間帯の立体の棒が見られる）。峰の前に主力を並べ、峰のあとは作る量を絞る。', w: null };
    }
    return null;
  }
  function viewMap() {
    var M = ME.map, m = S.m;
    if (!M) return '<h1 class="vt" id="lvtop">全店のいま<small>' + esc(roleLabel()) + '</small></h1><div class="box"><p style="margin:0">' + esc(String(ME.note || '全店の数は、いま準備中です。').replace('全体の地図', '全店の数')) + '</p></div>' + (ME.role === 'admin' ? '<div class="nx"><button type="button" data-view="admin">更新の状態を見る ▸</button></div>' : '');
    var d = mapDep(M), dn = d ? (mapDl(M).filter(function (x) { return x.id === d; })[0] || {}).n || '' : '', lvn = { lv: d ? 1 : 0 }, an = S.an;
    var mn = function (k) { return mname(k, lvn); };
    var stores = []; M.areas.forEach(function (a) { a.stores.forEach(function (s) { stores.push(s); }); });
    var has = stores.filter(function (s) { return !!mapPick(s, d); });
    var h = '<h1 class="vt" id="lvtop">全店のいま<small>全社 → エリア → 店｜' + stores.length + '店' + (dn ? '｜見る範囲: ' + esc(dn) : '') + (M.note ? '｜' + esc(M.note) : '') + '</small></h1>';
    h += '<div class="ctl">' + mapDeptBar(M, d) +
      (AN_M[an] ? '<div class="msel" role="group" aria-label="見る数"><span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (m === k) + '">' + esc(mn(k)) + '</button>'; }).join('') +
        '<span class="hint" style="margin:0">札・AI のコメント・比べる図が、' + (dn ? esc(dn) + 'の' : '') + 'この数に替わります</span></div>' : '<div class="msel"><span class="lb">見る数</span><span class="hint" style="margin:0">「' + esc(AN[an]) + '」は、決まった数で見ます</span></div>') + '</div>';
    // 1. 全社の分析の札（店のステータスと同じ6つ）
    var tl0 = '<h2 class="sec" id="ancards">' + esc('全社' + (dn ? 'の' + dn : '')) + 'の分析の結果<small>札を押すと、下の AI のコメントと比べる図が、その分析に替わります</small></h2><div class="tiles an6">' + mapTiles(M, d, m, mn, stores, has).map(tile).join('') + '</div>' +
      '<div class="hint">青＝多い・赤＝少ない（「+」「−」も付けています）｜「店の中央」＝店を並べた真ん中の店の値（ほかの店と比べない店は入れない）</div>';
    if (ME.role === 'admin') tl0 += '<div class="adm"><h3>更新の状態（管理者だけ）</h3><p style="margin:0">中身の年月 ' + esc(M.ym) + '・店 ' + stores.length + '｜<button type="button" class="hbtn" data-view="admin">ファイルと名簿の数を見る ▸</button></p></div>';
    // 2. 店ごとの値（比べる図・AI のコメントの元）
    var rows = stores.map(function (s) { var x = mapPick(s, d); return { s: s, x: x, v: mapLens(x, an, m) }; });
    var cmp = mapCompare(M, d, dn, m, mn, stores, rows), ai0 = '';
    var t = mapText(M, d, dn, m, mn, stores, rows);
    if (t) {
      ai0 += '<div class="ai"><div class="hd">AI のコメント（' + esc(AN[an]) + (dn ? '・' + esc(dn) : '') + '）</div><dl><dt>結果</dt><dd>' + esc(t.r) + '</dd><dt>なぜ</dt><dd>' + esc(t.y) + '</dd><dt>すること</dt><dd>' + esc(t.s) + '</dd></dl></div>';
      if (t.w) { var wx2 = t.w.x, sd = d ? (wx2 && wx2.same) || d : ''; ai0 += '<div class="nx"><b>次の一手</b>: <button type="button" data-store="' + esc(t.w.s.c) + '"' + (sd ? ' data-sdep="' + esc(sd) + '"' : '') + '>' + esc(t.w.s.nm + (dn ? 'の' + dn : '') + 'を開いて、' + AN[an] + 'を' + (dn ? '中分類' : '部門') + 'ごとに見る') + ' ▸</button></div>'; }
    }
    // 3. 店の比較（エリアごと）。店 → 部門 → 中分類 → クラスをその場で開く（行を押すと、この塊だけを描き直す）
    var low0 = cmp.low;
    h += duo(tl0 + cmp.top, ai0, blk('blk-mcmp', function () { if (low0 !== null) { var x = low0; low0 = null; return x; } return mapCompare(M, d, dn, m, mn, stores, rows).low; }));
    // 4. エリアごとの店の札（前の形・たたむ）と、店の一覧の表
    var cards = '<div class="mlg"><span>店の札の色＝' + esc((dn ? dn + 'の' : '') + mn(m)) + 'の前年からの増減:</span><span><i style="background:#1d5fbf"></i>+3% より多い</span><span><i style="background:#7aa7e3"></i>0〜+3%</span><span><i style="background:#eba59c"></i>0〜−3%</span><span><i style="background:#c0392b"></i>−3% より少ない</span></div><div class="areas">';
    M.areas.forEach(function (a) {
      cards += '<div class="area"><div class="ah">' + esc(a.nm) + ' <span class="zz" style="font-size:13px;font-weight:400">' + a.stores.length + '店</span></div><div class="stores">' + a.stores.map(function (s) {
        var x = mapPick(s, d), dd = mapYo(s, m, d), c = !isFinite(dd) ? '' : dd > 3 ? 'u2' : dd >= 0 ? 'u1' : dd >= -3 ? 'd1' : 'd2', sd = d && x ? x.same || d : '';
        return '<button type="button" class="st ' + c + (x ? '' : ' nodp') + '" data-store="' + esc(s.c) + '"' + (sd ? ' data-sdep="' + esc(sd) + '"' : '') + ' title="押すと、' + esc(s.nm) + (dn && x ? 'の' + dn : '') + 'のステータスが開きます' + (s.nc ? '（ほかの店と比べない店）' : '') + '"><div class="sn">' + esc(s.nm) + (s.nc ? ' <small class="nctag">比べない</small>' : '') + '</div>' +
          (x ? '<div class="sv ' + cls(dd) + '">' + sg(dd) + '%</div><div class="sv zz">' + num(mapVal(s, m, d), m === 'a' ? 1 : 0) + esc(MK[m].u) + '</div>' : '<div class="sv zz">この部門の数なし</div>') + '</button>';
      }).join('') + '</div></div>';
    });
    cards += '</div>';
    h += '<details class="det" id="d-cards"><summary>エリアごとの店の札（前年比の色・押すと店へ）</summary><div>' + cards + '</div></details>';
    var trs = stores.map(function (s) {
      var x = mapPick(s, d);
      return '<tr><td>' + esc(s.nm) + '</td><td>' + esc(s.ar || '') + '</td><td>' + esc(s.ty || '') + '</td>' + ['a', 'q', 'c', 'u'].map(function (k) { var dd = mapYo(s, k, d); return '<td class="n ' + cls(dd) + '">' + sg(dd) + '%</td>'; }).join('') +
        '<td class="n">' + num(x ? nz(x.ls) : NaN, 1) + '</td><td class="n">' + num(x ? nz(x.adL) : NaN, 2) + '</td><td class="n">' + sg(x ? nz(x.rain) : NaN) + '%</td></tr>';
    }).join('');
    h += '<details class="det" id="d-list"><summary>店の一覧の表（本部だけ・店の名前つき' + (dn ? '・' + esc(dn) : '') + '）</summary><div>' + table(['店', 'エリア', 'まわりの様子', mn('a'), mn('q'), mn('c'), mn('u'), 'ロス率（%）', '広告の効き（倍）', '強い雨の日の' + mn('c')], trs, stores.length > 10) + '</div></details>';
    return h;
  }
  /** 比べる図: エリアの比較（全社の線つき）→ 店の比較（エリアごと・悪い順）。どの行も同じ目盛り。店の行を押すと、その店の・その部門の・その分析へ */
  function mapCompare(M, d, dn, m, mn, stores, rows, hid) {
    var an = S.an, ok = rows.filter(function (r) { return r.v; }), co = mapAgg(stores, an, m, d);
    var nm0 = (dn ? dn + 'の' : '') + (an === 'yo' ? mn(m) + 'の前年比' : an === 'wx' ? WL[S.wl] + 'の日の' + mn(m === 'q' ? 'a' : m) : AN[an]);
    var head = '<h2 class="sec" id="' + (hid || 'dig') + '">比べる — 店の' + esc(nm0) + '</h2>';
    var sw = an === 'wx' ? '<div class="wlsw" role="group" aria-label="雨の強さ">' + WL.map(function (t2, i) { return '<button type="button" data-wl="' + i + '" aria-pressed="' + (S.wl === i) + '">' + esc(t2) + '</button>'; }).join('') + '</div>' : '';
    if (!ok.length) return { top: sw + '<div class="drill"><div class="hint">この見る範囲には、' + esc(AN[an]) + 'の数がありません。</div></div>', low: '' };
    var areaV = M.areas.map(function (a) { return { a: a, v: mapAgg(a.stores, an, m, d) }; });
    var all = ok.map(function (r) { return r.v.d; }).concat(areaV.map(function (o) { return o.v ? o.v.d : NaN; })).filter(isFinite);
    var bar, lg, tk, R, worstFirst = an === 'tm' ? 0 : an === 'ls' || an === 'md' ? -1 : 1, cl = function (v) { return an === 'ad' ? cls(v.d - 1) : an === 'ls' || an === 'md' ? (co && v.d > co.d ? 'dn' : 'up') : cls(v.d); };
    if (an === 'yo' || an === 'wx') {
      R = Math.min(an === 'wx' ? 40 : 30, Math.max(an === 'wx' ? 5 : 10, Math.ceil(Math.max.apply(null, all.map(Math.abs)) / 5) * 5));
      bar = function (v) { return divBar(v.d, 0, R, co ? co.d : NaN); }; tk = divTicks(R, 0, pctTick);
      lg = '<span><i style="background:#5b8fd6"></i>' + (an === 'yo' ? '前年より多い' : 'ふだんより多い') + '</span><span><i style="background:#e07a6e"></i>少ない</span>';
    } else if (an === 'ad') {
      var ma = Math.max.apply(null, all.map(function (v) { return Math.abs(v - 1); }));
      R = Math.min(5, Math.max(1, Math.ceil(ma * 2) / 2));
      bar = function (v) { return divBar(v.d, 1, R, co ? co.d : NaN); }; tk = divTicks(R, 1, function (x) { return x < 0 ? '' : (Math.round(x * 10) / 10) + '倍'; });
      lg = '<span>特売の日の販売数 ÷ ふだん（倍・真ん中の線＝1倍）</span><span><i style="background:#5b8fd6"></i>ふだんより売れた</span><span><i style="background:#e07a6e"></i>ふだんより少ない</span>';
    } else if (an === 'ls') {
      R = Math.max(5, Math.ceil(Math.max.apply(null, all) / 5) * 5);
      bar = function (v) { return oneBar(v.d, R, co ? co.d : NaN); }; tk = [[0, '0%'], [50, (R / 2) + '%'], [100, R + '%']];
      lg = '<span>ロスの計（売上に対する %）</span><span><i style="background:#e07a6e"></i>全社より多い</span><span><i style="background:#5b8fd6"></i>少ない</span>';
    } else if (an === 'md') {
      bar = function (v) { return mdBar(v.f); }; tk = [[0, '0%'], [50, '50%'], [100, '100%（回の数）']];
      lg = '<span>52週MD の回の結果（計画と比べた回の割合）・数＝下回った回／全部の回</span><span><i style="background:#5b8fd6"></i>上回った</span><span><i style="background:#cbd5e1"></i>並み</span><span><i style="background:#e07a6e"></i>下回った</span>';
    } else {
      var mt = 0.1; ok.concat(areaV.filter(function (o) { return o.v; }).map(function (o) { return { v: o.v }; })).forEach(function (r) { r.v.dw.forEach(function (y) { if (isFinite(y)) mt = Math.max(mt, Math.abs(y - 1)); }); });
      mt = Math.min(mt, 0.5);
      bar = function (v) { return '<span class="bar tmb" aria-hidden="true">' + dwProf(v.dw, mt) + '</span>'; }; tk = null;
      lg = '<span>曜日の形（月→日・ふだん＝1.00 の線から上下・棒の端 ±' + Math.round(mt * 100) + '%）</span><span><i style="background:#5b8fd6"></i>ふだんより多い</span><span><i style="background:#e07a6e"></i>少ない</span><span><i style="background:rgba(234,138,40,.25)"></i>土日</span>';
    }
    lg = '<div class="lg"><span>' + esc(nm0) + '</span>' + lg + (co && an !== 'md' && an !== 'tm' ? '<span><i style="border-left:2px dashed #7c3aed;width:0"></i>全社' + (an === 'yo' || an === 'ls' ? '' : '（店の中央）') + ' ' + esc(co.t) + '</span>' : '') + (R ? '<span>目盛りの端 ' + (an === 'ls' ? R + '%' : an === 'ad' ? num(1 + R, 1) + '倍' : '±' + R + '%') + '</span>' : '') +
      asideLg({ yo: mn(m) + (m === 'u' ? '' : '（1日あたり）'), wx: '比べる用・' + WL[1 - S.wl] + 'の日の値', ad: '比べた特売の件数', md: '上回った回の数', tm: '客がいちばん多い時刻' }[an]) + '</div>';
    // 行の並び（PO 11/17）: 名前 → 主の数 → 棒 が一つのかたまり。比べる用の添えは右の端に、かっこ付きで
    var cells = function (v) {
      return '<span class="pct ' + (v && an !== 'tm' ? cl(v) : '') + '">' + esc(v ? (an === 'tm' ? (v.hi >= 0 ? v.t + 'が多い' : '―') : v.t) : '―') + '</span>' +
        (v ? bar(v) : '<span class="bar" aria-hidden="true"></span>') + '<span class="val">' + esc(v ? aside(v.t2) : '') + '</span>';
    };
    var rowHtml = function (name, sub, v, attrs, cls2, ar) {
      return '<' + (attrs ? 'button type="button"' : 'div') + ' class="drow mrow' + (attrs ? '' : ' leaf') + (cls2 || '') + '"' + (attrs || '') + '><span class="n"><span class="ar">' + (attrs ? ar || '▸' : '') + '</span><span>' + name + '</span></span>' + cells(v) + '</' + (attrs ? 'button' : 'div') + '>';
    };
    // 店の行のすぐ下に開く、その店の部門（PO 11/17「この画面で直ぐにできないと不便」・地図の数＝往復 0）。
    // 11/17d: 部門 → 中分類 → 小分類 → クラスも、その場で（PO「天気以外の時もドリルダウンでクラスまで」）。店の行を開いた時点で、その店の木を裏で受け取り始める（往復1本）。
    //   部門の数は地図の数・中分類より下は店の木の数（同じ分析・同じ目盛り）。木が届く前は待ちの印、届いたらこの塊だけを描き直す
    var O = {}; (S.mo || []).forEach(function (k) { O[k] = 1; });
    var subRow = function (name, v, attrs, extra, style, ar) {
      var el = attrs ? 'button type="button"' : 'div';
      return '<' + el + ' class="drow mrow sub' + (attrs ? '' : ' leaf') + extra + '" style="' + style + '"' + (attrs || '') + '><span class="n"><span class="ar">' + ar + '</span><span>' + name + '</span></span>' + cells(v) + '</' + (attrs ? 'button' : 'div') + '>';
    };
    var waitRow = function (dd, dep) {
      if (dd.none) return '<div class="hint" style="--dep:' + dep + '">' + esc(dd.none) + '</div>';
      if (dd.err) return '<div class="hint" style="--dep:' + dep + '">この店の中の数を受け取れませんでした（' + esc(dd.err) + '）。店の行を閉じて開き直すと、もう一度受け取ります。</div>';
      return '<div class="hint wait" style="--dep:' + dep + '"><span class="spin" aria-hidden="true"></span>この店の中（中分類 → クラス）の数を受け取っています…（届いたら、ここに開きます）</div>';
    };
    var treeRows = function (s, node, T, dep) {
      var out = '', lastG = null;
      kidsT(node, T.N).forEach(function (x) {
        if (x.g && x.g !== lastG) { lastG = x.g; out += '<div class="grp sub" style="--dep:' + dep + '">' + esc(x.g) + '</div>'; }
        var key = s.c + ':' + x.id, can = hasKids(x.n), op = can && !!O[key], v = treeLens(x.n, an, m), dpn = deptOfT(x.n, T.N), c = dpn ? deptCol(dpn.n) : null;
        out += subRow(esc(x.n.n), v, can ? ' data-mtog="' + esc(key) + '" aria-expanded="' + op + '" title="押すと、すぐ下に' + esc(x.n.n) + 'の中が開きます（もう一度押すと閉じる）"' : '',
          (c ? ' dc' : '') + (v ? '' : ' nodp') + (op ? ' open' : ''), dcStyleT(x.n, T.N, dep), can ? (op ? '▼' : '▶') : '・');
        if (op) out += treeRows(s, x.n, T, dep + 1);
      });
      return out;
    };
    var kidsOf = function (s) {
      var dd = DATA[s.c] || {}, T = dd.tree;
      if (!T && !dd.p && !dd.none && !dd.err) { fetchTree(s.c); dd = DATA[s.c] || dd; }   // 店の行を開いたら、その店の木を裏で受け取り始める
      return mapDl(M).filter(function (x) { return !x.alt; }).map(function (x) {
        var c = deptCol(x.n), v = s.dp && s.dp[x.id] ? mapLens(s.dp[x.id], an, m) : null, key = s.c + ':' + x.id, tn = T ? T.N[x.id] : null;
        var can = T ? !!(tn && hasKids(tn)) : !!(s.dp && s.dp[x.id]) && !dd.none, op = can && !!O[key];   // 木が届く前も押せる（届いたら、そこに開く）
        var h = subRow(esc(x.n), v, can ? ' data-mtog="' + esc(key) + '" aria-expanded="' + op + '" title="押すと、すぐ下に' + esc(s.nm + 'の' + x.n) + 'の中分類が開きます（もう一度押すと閉じる）"' : '',
          (c ? ' dc' : '') + (v ? '' : ' nodp') + (op ? ' open' : ''), (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + '--dep:1', can ? (op ? '▼' : '▶') : '・');
        if (op) h += T ? treeRows(s, tn, T, 2) : waitRow(dd, 2);
        return h;
      }).join('') + '<div class="dopen" style="--dep:1"><button type="button" data-store="' + esc(s.c) + '">' + esc(s.nm) + 'を大きく開く（AI のコメント・この段の図）▸</button></div>';
    };
    var a1 = '<h3 class="mh">エリアの比較 — ' + esc(nm0) + (an === 'yo' || an === 'ls' ? '（エリアの店を合わせた計）' : '（エリアの店の中央）') + '</h3><div class="drill an">' + lg + (tk ? ruler(tk.filter(function (x) { return x[1]; })) : '') +
      areaV.map(function (o) { return rowHtml(esc(o.a.nm) + ' <small>' + o.a.stores.length + '店</small>', '', o.v, '', ' area'); }).join('') + '</div>';
    var a2 = '<h3 class="mh">店の比較（エリアごと・' + (worstFirst < 0 ? '高い順' : worstFirst > 0 ? '低い順' : 'いつもの店の並び') + '）<small>' + (dn ? '行を押すと、その店の' + esc(dn) + 'の' + esc(AN[an]) + 'が開きます' : '行を押すと、すぐ下にその店の部門が開きます（部門 → 中分類 → クラスも、押すたびにすぐ下に）') + '</small></h3><div class="drill an">' + lg + (tk ? ruler(tk.filter(function (x) { return x[1]; })) : '');
    M.areas.forEach(function (a) {
      a2 += '<div class="grp">' + esc(a.nm) + '</div>';
      // ほかの店と比べない店（nc）は、並べ替えに入れず、エリアの最後に置く（PO 11/14: AI のコメントの「いちばん下がった・伸びた」に入れないのと同じ）
      var rs = rows.filter(function (r) { return a.stores.indexOf(r.s) >= 0; }).sort(function (p, q) { if (!p.s.nc !== !q.s.nc) return p.s.nc ? 1 : -1; if (!p.v) return 1; if (!q.v) return -1; return worstFirst ? (p.v.d - q.v.d) * worstFirst : 0; });
      rs.forEach(function (r) {
        var sd = d && r.x ? r.x.same || d : '', op = !d && (S.mo || []).indexOf(String(r.s.c)) >= 0;
        var nm = esc(r.s.nm) + (r.s.nc ? ' <small class="nctag">比べない</small>' : '') + (r.x && r.x.same ? ' <small>（' + esc((mapDl(M).filter(function (z) { return z.id === r.x.same; })[0] || {}).n || '') + 'と同じ）</small>' : '');
        if (d) a2 += rowHtml(nm, '', r.v, ' data-store="' + esc(r.s.c) + '"' + (sd ? ' data-sdep="' + esc(sd) + '"' : '') + ' title="押すと、' + esc(r.s.nm) + 'の' + esc(dn) + 'の' + esc(AN[an]) + 'が開きます"', r.v ? '' : ' nodp');
        else a2 += rowHtml(nm, '', r.v, ' data-mtog="' + esc(r.s.c) + '" aria-expanded="' + op + '" title="押すと、すぐ下に' + esc(r.s.nm) + 'の部門が開きます（もう一度押すと閉じる）"', (r.v ? '' : ' nodp') + (op ? ' open' : ''), op ? '▼' : '▶') + (op ? kidsOf(r.s) : '');
      });
    });
    a2 += '</div><div class="hint">' + (dn ? '店の行を押すと、その店の' + esc(dn) + '（中分類 → クラス）が、この分析のまま開きます。' : '店の行を押すと、すぐ下にその店の部門が、この分析のまま開きます。部門 → 中分類 → 小分類 → クラスも、押すたびにすぐ下に開きます（もう一度押すと閉じる・中分類より下は、その店の数を受け取ってから）。AI のコメントとこの段の図は「〇〇店を大きく開く」で。') + '「―」はその店に数が無い所（0 ではありません）。' + (stores.some(function (s) { return s.nc; }) ? '「比べない」の店は、並べる順に入れず、エリアの最後に置いています（エリアの値と全社の線にも入れていません）。' : '') + '</div>';
    return { top: sw + a1, low: head + a2, body: a2 };
  }
  function storeName(code) { return (ME.names && ME.names[code]) || (DATA[code] && (DATA[code].sum || DATA[code].tree) ? (DATA[code].sum || DATA[code].tree).meta.st.nm : '店 ' + code); }
  function viewNode(n) {
    var st = meta().st, h = '', hq = ME.role === 'hq' || ME.role === 'admin';
    h += '<h1 class="vt" id="lvtop">' + esc(n.lv === 0 ? n.n + 'のいま' : n.n) + '<small>' + esc(LVNM[n.lv]) + '｜' + esc(st.ar || '') + '・' + esc(st.ty || '') + (n.lv ? '｜' + esc(st.nm) : '') + '</small>' +
      (hq && n.lv === 0 ? '<button type="button" class="hbtn" data-view="home-map" style="margin-left:auto">← 全店のいまへ</button>' : '') + '</h1>';
    h += '<div class="ctl">' + deptBar() + metricBar(n) + '</div>' + duo(tiles(n), S.an === 'yo' ? aiBox(n) : anBox(n), blk('blk-dig', function () { return drill(n); })) + anFig(n) + details(n);
    return h;
  }
  /** 見る数（PO 11/16「売上／客数／販売数／客単価のいずれが指標か・案内が弱い」）: 見る範囲のすぐ下に置く。札・AI のコメント・掘り下げ・図の数が替わる（右上の帯の「見る数」と同じ） */
  function metricBar(n) {
    if (!AN_M[S.an]) return '<div class="msel"><span class="lb">見る数</span><span class="hint" style="margin:0">「' + esc(AN[S.an]) + '」は、決まった数で見ます（見る数の切り替えはありません）</span></div>';
    return '<div class="msel" role="group" aria-label="見る数"><span class="lb">見る数</span>' + ['a', 'q', 'c', 'u'].map(function (k) { return '<button type="button" data-m="' + k + '" aria-pressed="' + (S.m === k) + '">' + esc(mname(k, n)) + '</button>'; }).join('') +
      '<span class="hint" style="margin:0">札・AI のコメント・掘り下げ・図が、この数の前年比（直近4週）に替わります</span></div>';
  }
  /** 掘り下げの棒の物差し（棒の列にそろえる・PO 11/16「スケールが分かりづらい」）。ticks: [[位置 0〜100, 字], …] */
  function ruler(ticks) {
    return '<div class="drow leaf ruler" aria-hidden="true"><span class="n"><small>目盛り</small></span><span class="pct"></span><span class="bar">' + ticks.map(function (t) { return '<b style="left:' + t[0] + '%">' + esc(t[1]) + '</b>'; }).join('') + '</span><span class="val"></span></div>';
  }
  /** 比べる用の添え（PO 11/17「選んでいない方は比べるための表示と分かるように」）: かっこを付けて、棒の右の端に薄く */
  function aside(t) { return t ? '（' + t + '）' : ''; }
  function asideLg(t) { return t ? '<span class="lgx">（ ）＝' + esc(t) + '</span>' : ''; }
  function pctTick(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v * 10) / 10) + '%'; }
  function divTicks(R, base, fmt) { return [[0, fmt(base - R)], [25, fmt(base - R / 2)], [50, fmt(base)], [75, fmt(base + R / 2)], [100, fmt(base + R)]]; }
  /** 見る範囲（部門）の札（PO 11/16「冒頭の分析の時点で、部門ごとに切り替えができたほうが良い」）。押すと、分析の札・AI のコメント・掘り下げ・この段の図が、その部門に替わる */
  function deptBar() {
    var st = N().S; if (!st || !st.ch || !st.ch.length) return '';
    var curD = S.path.length > 1 ? S.path[1] : 'S';
    var b = function (id, nm, c) { var on = id === curD; return '<button type="button" data-dsel="' + esc(id) + '" aria-pressed="' + on + '"' + (c ? ' style="--dbg:' + c[0] + ';--dac:' + c[1] + '"' : '') + '>' + (c ? '<i aria-hidden="true"></i>' : '') + esc(nm) + '</button>'; };
    return '<div class="dsel" role="group" aria-label="見る範囲（部門）"><span class="lb">見る範囲</span>' + b('S', '店全体', null) +
      kids(st).map(function (x) { var al = x.n.alt && N()[x.n.alt]; return b(x.id, x.n.n, deptCol(x.n.n)) + (al ? b(x.n.alt, al.n, deptCol(x.n.n)) : ''); }).join('') + '</div>';
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
    var act = o.an ? ' role="button" tabindex="0" data-an="' + o.an + '" title="押すと、下の掘り下げが「' + esc(AN[o.an]) + '」に替わります"' : o.m ? ' role="button" tabindex="0" data-m="' + o.m + '" title="押すと、見る数が「' + esc(o.nm) + '」に替わります"' : '';
    return '<div class="tile' + (o.sel ? ' sel' : '') + (o.an ? ' an' : '') + '"' + act + '>' +
      '<div class="nm"><span>' + esc(o.nm) + '</span><span>' + (o.u ? '（' + esc(o.u) + '）' : '') + '</span></div><div class="v' + (o.vc ? ' ' + o.vc : '') + '">' + o.v + '</div>' +
      (o.yy != null ? '<div class="yy ' + cls(o.yy) + '">前年より ' + sg(o.yy) + '%</div>' : o.sub ? '<div class="yy zz">' + esc(o.sub) + '</div>' : '') +
      (o.sub2 ? '<div class="s2">' + esc(o.sub2) + '</div>' : '') +
      (o.g != null ? gauge(o.g, o.gm) : '') + (o.fig || '') + (o.rule ? '<div class="rule">' + o.rule + '</div>' : '') + '</div>';
  }
  // ── 見る分析（札で選ぶ・2026-11-15 PO: 店の最初の画面は2つの分析の中身から）。AN_M＝見る数（売上・販売数・来客数・単価）で中身が替わる分析
  var AN = { yo: '売上・客数の前年比', wx: '雨の日の効き', ad: '広告の効き', md: '52週MD', ls: 'ロス', tm: '曜日・時間帯' };
  var AN_M = { yo: 1, wx: 1, tm: 1 };
  var WL = ['雨（10mm 以上）', '強い雨（30mm 以上）'];
  function wxv(n, i) { var W = n.wxs && n.wxs[S.m], w = W && W[i]; return w && isFinite(w[0]) ? w : null; }   // [この段, 同じ型の店の中央, エリアの中央, エリアで何番目, 店の数]
  function dwOf(n) { return S.m === 'a' ? n.dw : (n.dwm && n.dwm[S.m]); }
  function dayNm(i) { return i === 7 ? '祝日' : DOW8[i] + '曜'; }
  function maxAt(a) { var k = -1; (a || []).forEach(function (v, i) { if (isFinite(v) && (k < 0 || v > a[k])) k = i; }); return k; }
  function minAt(a) { var k = -1; (a || []).forEach(function (v, i) { if (isFinite(v) && (k < 0 || v < a[k])) k = i; }); return k; }
  function peakHour(n) {   // いちばん多い曜日と時刻（時間帯の表の峰）
    var H = n.h && n.h[S.m === 'u' ? 'a' : S.m]; if (!H) return null;
    var hrs = meta().hrs || [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], best = null;
    H.forEach(function (r, d) { (r || []).forEach(function (v, j) { if (isFinite(v) && (!best || v > best.v)) best = { v: v, d: d, h: hrs[j] }; }); });
    return best;
  }
  function tiles(n) {
    var o = [], m = S.m, p = mpr(n, m), d = myo(n, m), v = mval(n, m), oth = ['a', 'c', 'u'].filter(function (k) { return k !== m; });
    o.push({ an: 'yo', nm: mname(m, n) + 'の前年比', u: MK[m].u, v: num(v, m === 'a' && v < 100 ? 1 : 0), yy: d, g: d, gm: p ? (isFinite(p.peer) ? p.peer : p.area) : NaN, rule: p ? ruleTxt(p.peer, p.area, p.rank, p.n) : '',
      sub2: oth.map(function (k) { return mname(k, n) + ' ' + sg(myo(n, k)) + '%'; }).join('・'), sel: S.an === 'yo' });
    var w1 = wxv(n, 1), w0 = wxv(n, 0), wm = w1 || w0;
    o.push({ an: 'wx', nm: '雨の日の効き', u: mname(m, n), v: wm ? sg(wm[0]) + '<small>%</small>' : '―', sub: wm ? (w1 ? '強い雨の日' : '雨の日') + '・ふだんの同じ曜日との差' : 'この段には雨の日の数がありません',
      sub2: w1 && w0 ? '雨（10mm〜）の日 ' + sg(w0[0]) + '%' : '', g: wm ? wm[0] : null, gm: wm && !nc() ? (isFinite(wm[1]) ? wm[1] : wm[2]) : NaN, rule: wm ? ruleTxt(wm[1], wm[2], wm[3], wm[4]) : '', sel: S.an === 'wx' });
    var a = n.ad && isFinite(n.ad.L) ? n.ad : null;
    o.push({ an: 'ad', nm: '広告の効き', u: '倍', v: a ? num(a.L, 2) + '<small>倍</small>' : '―', sub: a ? '特売の日の販売数 ÷ ふだん' : 'この段には広告の数がありません', sub2: a ? '載った ' + num(a.n) + '件（比べられた ' + num(a.nc) + '件）' : '', sel: S.an === 'ad' });
    var f = n.m5;
    o.push({ an: 'md', nm: '52週MD', u: '回', v: f && f.n ? '下回り ' + f.down + '<small>回</small>' : '―', sub: f && f.n ? f.n + '回のうち（上回り ' + f.up + '・並み ' + f.flat + '）' : '計画は部門・中分類ごと', sel: S.an === 'md' });
    o.push({ an: 'ls', nm: 'ロス率', u: '%', v: n.ls ? num(n.ls[2], 1) + '<small>%</small>' : '―', sub: n.ls ? '見切り ' + n.ls[0] + '%・廃棄 ' + n.ls[1] + '%' : 'この段にはロスの記録がありません',
      rule: n.ls ? ruleTxt(n.lp ? n.lp[0] : NaN, n.lp ? n.lp[1] : NaN, n.lr ? n.lr[0] : 0, n.lr ? n.lr[1] : 0, function (x) { return x.toFixed(1) + '%'; }, true) : '', sel: S.an === 'ls' });
    var dw = dwOf(n), pk = peakHour(n), hi = maxAt(dw);
    o.push({ an: 'tm', nm: '曜日・時間帯', u: '', v: hi >= 0 ? dayNm(hi) + '<small>がいちばん多い</small>' : '―', sub: hi >= 0 ? 'ふだんの ' + dw[hi].toFixed(2) + '倍（' + mname(m, n) + '）' : 'この段には曜日の数がありません', sub2: pk ? '峰の時刻 ' + dayNm(pk.d) + ' ' + pk.h + '時' : '', sel: S.an === 'tm' });
    return '<h2 class="sec" id="ancards">' + esc(n.n) + 'の分析の結果<small>札を押すと、下の掘り下げがその分析に替わります</small></h2><div class="tiles an6">' + o.map(tile).join('') + '</div><div class="hint">青＝多い・赤＝少ない（「+」「−」も付けています）｜札の小さな棒＝前年からの増減（どの札も同じ目盛り・端が ±15%）' + (nc() ? '｜' + esc(NC_NOTE) : '｜紫の点線＝物差し（同じ型の店の中央か、エリアの中央）') + '</div>';
  }
  /** 選んだ分析の AI のコメント（この段の数を決まった読み方で文にした物。新しい数は作らない・原因は1つに決めない） */
  function anBox(n) {
    var t = anText(n); if (!t) return '';
    return '<div class="ai"><div class="hd">AI のコメント（' + esc(AN[S.an]) + '）</div><dl><dt>結果</dt><dd>' + esc(t[0]) + '</dd><dt>なぜ</dt><dd>' + esc(t[1]) + '</dd><dt>すること</dt><dd>' + esc(t[2]) + '</dd></dl></div>';
  }
  function kidsWith(n, f) { if (!hasKids(n) || !kidsReady(n)) return []; return kids(n).map(function (x) { return { x: x, v: f(x.n) }; }).filter(function (o) { return o.v != null && isFinite(o.v); }); }
  function anText(n) {
    var K = KIDNM[n.lv] || 'クラス', cmp = !nc();
    if (S.an === 'wx') {
      var w = wxv(n, S.wl); if (!w) return null;
      var ks = kidsWith(n, function (x) { var y = wxv(x, S.wl); return y ? y[0] : null; }).sort(function (a, b) { return a.v - b.v; });
      return [WL[S.wl] + 'の日の' + mname(S.m, n) + 'は、ふだんの同じ曜日より ' + sg(w[0]) + '%' + (cmp && isFinite(w[1]) ? '（同じ型の店の中央 ' + sg(w[1]) + '%' + (w[3] && w[4] ? '・エリア' + w[4] + '店で' + w[3] + '番目' : '') + '）' : '') + '。' +
        (ks.length > 1 ? K + 'ごとでは、いちばん減るのは' + ks[0].x.n.n + '（' + sg(ks[0].v) + '%）、減りにくいのは' + ks[ks.length - 1].x.n.n + '（' + sg(ks[ks.length - 1].v) + '%）。' : ''),
        '全店の分析では、雨の日は重い物・かさばる物・急がない物が後回しにされやすい。店の差は、まわりの様子（車で来る店か、歩き・自転車で来る店か）でも変わる。どれかは、記録だけでは見分けられない。',
        '雨の予報の日は、' + (ks.length ? ks[0].x.n.n + 'から' : '') + '作る量・発注・並べ方を見直す。どこまで減らすかは、売場で確かめてから決める。'];
    }
    if (S.an === 'ad') {
      var a = n.ad; if (!a || !isFinite(a.L)) return null;
      var ka = kidsWith(n, function (x) { return x.ad && x.ad.nc >= 5 ? x.ad.L : null; }).sort(function (p, q) { return q.v - p.v; });
      return ['特売の日の販売数は、ふだんの ' + num(a.L, 2) + '倍（載った ' + num(a.n) + '件・比べられた ' + num(a.nc) + '件）。' + (ka.length > 1 ? K + 'ごとでは、よく効くのは' + ka[0].x.n.n + '（' + num(ka[0].v, 2) + '倍）、効きにくいのは' + ka[ka.length - 1].x.n.n + '（' + num(ka[ka.length - 1].v, 2) + '倍）。' : ''),
        '効きは、値下げの深さ・品・並べ方・載せた号で変わる。よく売れても、深い値下げ・数量限定の品は、原価を割る集客用のことがある。',
        'よく効いた品（下の図）を、次の号でも同じ売場・量で出せるかを見る。次も載せるかは、粗利を確かめてから決める。'];
    }
    if (S.an === 'md') {
      var f = n.m5; if (!f || !f.n) return null;
      var km = kidsWith(n, function (x) { return x.m5 && x.m5.n ? x.m5.down / x.m5.n * 100 : null; }).sort(function (p, q) { return q.v - p.v; });
      return ['52週MD の計画と比べた ' + f.n + '回のうち、上回った ' + f.up + '・並み ' + f.flat + '・下回った ' + f.down + '。' + (km.length > 1 ? K + 'ごとでは、下回りの割合がいちばん大きいのは' + km[0].x.n.n + '（' + Math.round(km[0].v) + '%）。' : ''),
        '計画との差は、売場の位置・量・時期のずれのほか、天気・広告の重なりでも出る。どれかは、記録だけでは見分けられない。',
        '下回った回の多い所から、イチオシ品の売場と量を計画どおりにできたかを、下の表の回ごとに確かめる。'];
    }
    if (S.an === 'ls') {
      if (!n.ls) return null;
      var kl = kidsWith(n, function (x) { return x.ls ? x.ls[2] : null; }).sort(function (p, q) { return q.v - p.v; });
      return ['ロスの計は ' + num(n.ls[2], 1) + '%（見切り ' + num(n.ls[0], 1) + '%・廃棄 ' + num(n.ls[1], 1) + '%）。' + (cmp && n.lp ? '同じ型の店の中央 ' + num(n.lp[0], 1) + '%' + (n.lr ? '・エリア' + n.lr[1] + '店で' + n.lr[0] + '番目（少ない順）' : '') + '。' : '') + (kl.length > 1 ? K + 'ごとでは、いちばん高いのは' + kl[0].x.n.n + '（' + num(kl[0].v, 1) + '%）。' : ''),
        '見込み: 作る量・仕入れの量／原料の見切り品を加工に回している／鮮度を厳しく見て早めに値引きしている／値引きの深さ・時刻の決まり。どれかは、記録からは見分けられない（売場で確かめる）。',
        (kl.length ? kl[0].x.n.n + 'から、' : '') + '作る量・並べ方を先に見直す。値引きの率や時刻は、そのあとに見直す。'];
    }
    if (S.an === 'tm') {
      var dw = dwOf(n), hi = maxAt(dw), lo = minAt(dw), pk = peakHour(n); if (hi < 0) return null;
      return ['いちばん多い曜日は' + dayNm(hi) + '（ふだんの ' + dw[hi].toFixed(2) + '倍）、少ないのは' + dayNm(lo) + '（' + dw[lo].toFixed(2) + '倍）。' + (pk ? '峰の時刻は ' + dayNm(pk.d) + 'の ' + pk.h + '時。' : ''),
        '曜日と時刻の型は、まわりの様子と、来るお客様の暮らし方で決まる。祝日・行事の日は別に考える。',
        '峰の前に主力を並べ、峰のあとは作る量を絞る。人の手当ても、曜日の型に合わせる。'];
    }
    return null;
  }
  /** 選んだ分析の「この段の図」（掘り下げの下・閉じない） */
  function anFig(n) {
    if (S.an === 'yo') return '';
    var body = '';
    if (S.an === 'wx') {
      var W = n.wxs && n.wxs[S.m];
      if (!W) body = '<p class="hint">この段には、雨の日の数がありません。</p>';
      else {
        var vals = [0, 1].map(function (i) { return W[i] && isFinite(W[i][0]) ? W[i][0] : NaN; }), mk = nc() ? null : [0, 1].map(function (i) { return W[i] ? (isFinite(W[i][1]) ? W[i][1] : W[i][2]) : NaN; });
        body = figt('雨の日の' + mname(S.m, n) + '（ふだんの同じ曜日との差・%）') + bars(vals, ['雨（10mm〜）', '強い雨（30mm〜）'], { base: 0, fmt: function (x) { return sg(x) + '%'; }, mark: mk, markName: '同じ型の店の中央（無いときはエリアの中央）', barName: n.lv === 0 ? 'この店' : n.n, unit: '%', title: '雨の日の効き' }) +
          '<p class="hint">青＝ふだんより多い・赤＝少ない。' + (mk ? '紫の点線＝同じ型の店の中央（無いときはエリアの中央）。' : esc(NC_NOTE)) + '雨の日の買い方（重い物・かさばる物が後回し など）は、上の帯の「天気と売れ方」で見られます。</p>';
      }
    } else if (S.an === 'tm') body = LAZY.dow(n) + LAZY.hour(n);
    else body = LAZY[{ ad: 'ad', md: 'md', ls: 'loss' }[S.an]](n);
    var hq = ME && (ME.role === 'hq' || ME.role === 'admin'), rep = { wx: 'WEATHER/w-s4', ls: 'WEATHER/l-s0', tm: 'WEATHER/u-s1n', ad: 'ADMD', md: 'ADMD' }[S.an];
    return '<h2 class="sec" id="anfig">' + esc(n.n) + 'の' + esc(AN[S.an]) + ' — この段の図</h2><div class="box">' + body +
      (hq && rep ? '<p class="hint">' + extA('reports/#/' + rep, '全店の図とグラフは、分析レポートで見られます（本部だけ・新しいタブ）') + '</p>' : '') + '</div>';
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
    if (S.an === 'tm') return drillTm(n);
    if (S.an !== 'yo') return drillAn(n);
    var k = kids(n), m = S.m, pd = myo(n, m), V = visRows(n);
    var vals = V.filter(function (r) { return r.x; }).map(function (r) { return myo(r.x.n, m); }).filter(isFinite);
    var R = Math.min(30, Math.max(10, Math.ceil(Math.max.apply(null, vals.concat([isFinite(pd) ? pd : 0]).map(Math.abs)) / 5) * 5));
    var pos = function (d) { return 50 + Math.max(-R, Math.min(R, d)) / R * 50; };
    var rows = V.map(function (r) {
      if (!r.x) return rowExtra(r);
      var x = r.x, d = myo(x.n, m), p = pos(d), b = !isFinite(d) ? '' : d >= 0 ? '<i class="u" style="left:50%;width:' + (p - 50) + '%"></i>' : '<i class="d" style="left:' + p + '%;width:' + (50 - p) + '%"></i>';
      var cut = Math.abs(d) > R ? '<span class="cut ' + cls(d) + '" style="' + (d > 0 ? 'right:0' : 'left:0') + '">' + (d > 0 ? '›' : '‹') + '</span>' : '';
      var mv = mval(x.n, m);
      return rowBtn(r, '<span class="pct ' + cls(d) + '">' + sg(d) + '%</span><span class="bar" aria-hidden="true"><span class="zl"></span>' + (isFinite(pd) ? '<span class="pl" style="left:' + pos(pd) + '%"></span>' : '') + b + cut + '</span><span class="val">' + esc(aside(isFinite(mv) ? num(mv, m === 'a' ? 1 : 0) + MK[m].u : '')) + '</span>');
    }).join('');
    return '<h2 class="sec" id="dig">掘り下げる — ' + esc(KIDNM[n.lv] || 'クラス') + 'ごとの' + esc(mname(m, k[0].n)) + 'の前年比</h2><div class="drill"><div class="lg"><span>' + esc(mname(m, k[0].n)) + 'の前年からの増減</span><span><i style="background:#5b8fd6"></i>前年より多い</span><span><i style="background:#e07a6e"></i>少ない</span><span><i style="border-left:2px dashed #7c3aed;width:0"></i>' + esc(n.n) + '全体（' + sg(pd) + '%）</span><span>目盛りの端 ±' + R + '%</span>' + asideLg(mname(m, k[0].n) + (m === 'u' ? '' : '（1日あたり）')) + DC_LG + '</div>' + ruler(divTicks(R, 0, pctTick)) + rows + '</div>' + DRILL_HINT;
  }
  // ── 掘り下げの行（PO 11/16）: 押すと、その行のすぐ下に中が開く（もう一度押すと閉じる）。別の画面へは「〇〇だけを大きく開く」で。部門ごとに淡い地の色
  var DC_LG = '<span><i class="dcsw" aria-hidden="true"></i>行の地の色・左の帯＝部門の印（増え減りの色ではありません）</span>';
  var DRILL_HINT = '<div class="hint">行を押すと、すぐ下にその中が開きます（もう一度押すと閉じる）。その段だけを大きく見るときは「〇〇だけを大きく開く」。「―」はその段に数が無い所（0 ではありません）。</div>';
  function openOf() { var o = {}; (S.open || []).forEach(function (id) { o[id] = 1; }); return o; }
  /** 見えている行（深さつき）: 開いた行の下に、その中の行。小分類は区切りの行 */
  function visRows(n) {
    var out = [], O = openOf();
    (function walk(p, dep) {
      var lastG = null;
      kids(p).forEach(function (x) {
        if (x.g && x.g !== lastG) { lastG = x.g; out.push({ grp: x.g, dep: dep }); }
        var op = !!O[x.id] && hasKids(x.n);
        out.push({ x: x, dep: dep, open: op });
        if (op) { if (kidsReady(x.n)) { walk(x.n, dep + 1); out.push({ end: x, dep: dep + 1 }); } else out.push({ wait: true, dep: dep + 1 }); }
      });
    })(n, 0);
    return out;
  }
  function rowBtn(r, inner) {
    var x = r.x, leaf = !hasKids(x.n), c = dcOf(x.n), st = dcStyle(x.n, r.dep);
    return '<button type="button" class="drow' + (leaf ? ' leaf' : '') + (c ? ' dc' : '') + (r.dep ? ' sub' : '') + (r.open ? ' open' : '') + '" data-id="' + esc(x.id) + '"' + (st ? ' style="' + st + '"' : '') +
      (leaf ? ' title="' + esc(x.n.n) + '（いちばん下の段）"' : ' data-tog="' + esc(x.id) + '" aria-expanded="' + r.open + '" title="押すと、すぐ下に' + esc(x.n.n) + 'の中が開きます（もう一度押すと閉じます）"') +
      '><span class="n"><span class="ar">' + (leaf ? '・' : r.open ? '▼' : '▶') + '</span><span>' + esc(x.n.n) + '</span></span>' + inner + '</button>';
  }
  function rowExtra(r) {
    if (r.grp) return '<div class="grp' + (r.dep ? ' sub' : '') + '" style="--dep:' + r.dep + '">' + esc(r.grp) + '</div>';
    if (r.wait) return '<div class="hint wait" style="--dep:' + r.dep + '"><span class="spin" aria-hidden="true"></span>読み込んでいます…</div>';
    if (r.end) return '<div class="dopen" style="' + dcStyle(r.end.n, r.dep) + '"><button type="button" data-drill="' + esc(r.end.id) + '">' + esc(r.end.n.n) + 'だけを大きく開く（AI のコメント・この段の図）▸</button></div>';
    return '';
  }
  /** 開いた行の並びから、1つの行とその中で開いていた行を外す（いま開いている店の木で、親をたどる） */
  function treeClose(list, id) { var all = N(); return list.filter(function (j) { if (j === id) return false; for (var x = all[j], g = 0; x && x.p && g++ < 8; x = all[x.p]) if (x.p === id) return false; return true; }); }
  /** 本部の地図の店の比較: 店の行（コード）を閉じたら、その店の中の行を全部・部門より下の行（コード:番号）を閉じたら、その中で開いていた行を外す */
  function moClose(list, key) {
    var p = String(key).split(':'), code = p[0], id = p[1], T = DATA[code] && DATA[code].tree;
    return list.filter(function (k) {
      if (k === key) return false;
      var q = String(k).split(':'); if (q[0] !== code || q.length < 2) return true;
      if (!id) return false;
      if (!T) return true;
      for (var x = T.N[q[1]], g = 0; x && x.p && g++ < 8; x = T.N[x.p]) if (x.p === id) return false;
      return true;
    });
  }
  function toggleOpen(id) {
    var o = (S.open || []).slice(), i = o.indexOf(id);
    if (i >= 0) o = o.filter(function (j) { if (j === id) return false; var x = N()[j], g = 0; while (x && x.p && g++ < 8) { if (x.p === id) return false; x = N()[x.p]; } return true; });   // 閉じるときは、その中で開いていた行も閉じる
    else o.push(id);
    go({ open: o }, { keep: true, part: 'blk-dig' });   // 掘り下げの塊だけを描き直す
  }
  /** 曜日の指数の掘り下げ（PO 11/16「このグラフでは何見てるかわからない」→ 部門 × 曜日の表。同じ日の夜「ヒートマップでは全く見づらい」→ 色の濃さをやめ、行ごとの曜日の形の棒と数） */
  function drillTm(n) {
    var V = visRows(n), K = KIDNM[n.lv] || 'クラス', mt = 0.15, L = 7;
    V.forEach(function (r) { if (!r.x) return; var dw = dwOf(r.x.n); if (dw) { L = Math.max(L, dw.length); dw.forEach(function (y) { if (isFinite(y)) mt = Math.max(mt, Math.abs(y - 1)); }); } });
    var cols = DOW8.slice(0, Math.min(8, L)), span = cols.length + 3;
    // PO 11/16「ヒートマップでは全く見づらい」→ 色の濃さをやめた。行ごとに「曜日の形」の小さな棒（ふだん＝1.00 の線から上下・どの行も同じ目盛り・少し立体）。数は色を付けない字で
    var BW = 15, GP = 6, PW = cols.length * (BW + GP) - GP + 4, PH = 50, MID = 25;
    var prof = function (dw) {
      var o = '<svg class="dwp" width="' + PW + '" height="' + PH + '" viewBox="0 0 ' + PW + ' ' + PH + '" role="img" aria-label="曜日の形（月から' + cols[cols.length - 1] + 'まで）">';
      cols.forEach(function (_, i) { if (i >= 5) o += '<rect x="' + (i * (BW + GP) - 2) + '" y="0" width="' + (BW + 4) + '" height="' + PH + '" fill="rgba(234,138,40,.10)"/>'; });
      o += '<line x1="0" x2="' + PW + '" y1="' + MID + '" y2="' + MID + '" stroke="#64748b" stroke-width="1"/>';
      cols.forEach(function (_, i) {
        var v = dw[i]; if (!isFinite(v)) return;
        var h = Math.max(1.5, Math.min(1, Math.abs(v - 1) / mt) * (MID - 3)), x = i * (BW + GP), up = v >= 1, y = up ? MID - h : MID;
        var f = up ? ['#5b8fd6', '#3c6bb0', '#8fb4ea'] : ['#e07a6e', '#b9574c', '#efaaa1'];
        o += '<g><title>' + esc(dayNm(i) + ' ' + v.toFixed(2) + '倍（ふだん＝1.00）') + '</title><rect x="' + x + '" y="' + y.toFixed(1) + '" width="' + (BW - 3) + '" height="' + h.toFixed(1) + '" fill="' + f[0] + '"/>' +
          '<polygon points="' + (x + BW - 3) + ',' + y.toFixed(1) + ' ' + (x + BW) + ',' + (y - 2).toFixed(1) + ' ' + (x + BW) + ',' + (y + h - 2).toFixed(1) + ' ' + (x + BW - 3) + ',' + (y + h).toFixed(1) + '" fill="' + f[1] + '"/>' +
          (up ? '<polygon points="' + x + ',' + y.toFixed(1) + ' ' + (x + 3) + ',' + (y - 2).toFixed(1) + ' ' + (x + BW) + ',' + (y - 2).toFixed(1) + ' ' + (x + BW - 3) + ',' + y.toFixed(1) + '" fill="' + f[2] + '"/>' : '') + '</g>';
      });
      return o + '</svg>';
    };
    var cell = function (v, i, hi) { return isFinite(v) ? '<td class="n dv"' + (i === hi ? ' style="font-weight:800"' : '') + '>' + v.toFixed(2) + '</td>' : '<td class="n dv">―</td>'; };
    var body = V.map(function (r) {
      if (r.grp) return '<tr class="tgrp"><td style="--dep:' + r.dep + '">' + esc(r.grp) + '</td><td colspan="' + (span - 1) + '"></td></tr>';   // 区切りの名前は左の列に置く（列をまたぐと、枠を横に送ったとき名前が流れる＝幅 375 で見つけた・11/16 夜）
      if (r.wait) return '<tr><td colspan="' + span + '">読み込んでいます…</td></tr>';
      if (r.end) return '<tr class="topen"><td colspan="' + span + '" style="' + dcStyle(r.end.n, r.dep) + '"><button type="button" data-drill="' + esc(r.end.id) + '">' + esc(r.end.n.n) + 'だけを大きく開く ▸</button></td></tr>';
      var x = r.x, dw = dwOf(x.n), hi = maxAt(dw), lo = minAt(dw), leaf = !hasKids(x.n), c = dcOf(x.n), st = dcStyle(x.n, r.dep);
      var nm = leaf ? '<span class="tn">・' + esc(x.n.n) + '</span>' : '<button type="button" class="tn" data-tog="' + esc(x.id) + '" aria-expanded="' + r.open + '" title="押すと、すぐ下に' + esc(x.n.n) + 'の中が開きます">' + (r.open ? '▼ ' : '▶ ') + esc(x.n.n) + '</button>';
      return '<tr class="dr' + (c ? ' dc' : '') + (r.dep ? ' sub' : '') + '" data-id="' + esc(x.id) + '"' + (st ? ' style="' + st + '"' : '') + '><td>' + nm + '</td><td class="pf">' + (dw ? prof(dw) : '―') + '</td>' +
        (dw ? cols.map(function (_, i) { return cell(dw[i], i, hi); }).join('') : '<td class="n" colspan="' + cols.length + '">―</td>') +
        '<td>' + (hi >= 0 ? '<b>' + dayNm(hi) + '</b>' + (lo >= 0 && lo !== hi ? '<small>（少ない ' + dayNm(lo) + '）</small>' : '') : '―') + '</td></tr>';
    }).join('');
    var head = ['名前', '曜日の形（月→' + cols[cols.length - 1] + '）'].concat(cols).concat(['多い曜日']);
    return '<h2 class="sec" id="dig">掘り下げる — ' + esc(K) + 'ごとの曜日の指数</h2><div class="drill an tm"><div class="lg"><span>曜日ごとの' + esc(mname(S.m, n)) + '（ふだんの日＝1.00・倍）</span><span><i style="background:#5b8fd6"></i>ふだんより多い（線から上へ・長いほど多い）</span><span><i style="background:#e07a6e"></i>少ない（線から下へ）</span><span><i style="background:rgba(234,138,40,.25)"></i>土日・祝</span><span>棒の端 ±' + Math.round(mt * 100) + '%（どの行も同じ目盛り）・太字＝いちばん多い曜日</span>' + DC_LG + '</div>' +
      table(head, body, V.length > 14) + '</div>' + DRILL_HINT;
  }
  /** 選んだ分析で掘る（雨の日の効き・広告・52週MD・ロス）。行どうし同じ目盛り・押すと、すぐ下に同じ分析のまま中が開く */
  function drillAn(n) {
    var k = kids(n), an = S.an, K = KIDNM[n.lv] || 'クラス', cmp = !nc(), VR = visRows(n);
    var val = function (x) {
      if (an === 'wx') { var w = wxv(x, S.wl), o = wxv(x, 1 - S.wl); return w ? { d: w[0], md: cmp ? (isFinite(w[1]) ? w[1] : w[2]) : NaN, t: sg(w[0]) + '%', t2: o ? (S.wl ? '雨 ' : '強い雨 ') + sg(o[0]) + '%' : '' } : null; }
      if (an === 'ad') { var a = x.ad; return a && isFinite(a.L) ? { d: a.L, t: num(a.L, 2) + '倍', t2: '比べた ' + num(a.nc) + '件' } : null; }
      if (an === 'ls') { var l = x.ls; return l ? { d: l[2], md: cmp && x.lp ? x.lp[0] : NaN, t: num(l[2], 1) + '%', t2: '見切り ' + num(l[0], 1) + '%・廃棄 ' + num(l[1], 1) + '%' } : null; }
      if (an === 'md') { var f = x.m5; return f && f.n ? { d: f.down / f.n * 100, f: f, t: f.down + '/' + f.n + '回', t2: '上回った ' + f.up + '回' } : null; }
      return null;
    };
    var V = VR.filter(function (r) { return r.x; }).map(function (r) { return val(r.x.n); }), bar, lg, R, tk = null;
    if (an === 'wx') {
      var mx = 0; V.forEach(function (v) { if (v) mx = Math.max(mx, Math.abs(v.d), isFinite(v.md) ? Math.abs(v.md) : 0); });
      R = Math.min(40, Math.max(5, Math.ceil(mx / 5) * 5));
      bar = function (v) { return divBar(v.d, 0, R, v.md); }; tk = divTicks(R, 0, pctTick);
      lg = '<span>' + esc(WL[S.wl]) + 'の日の' + esc(mname(S.m, k[0].n)) + '（ふだんの同じ曜日との差）</span><span><i style="background:#5b8fd6"></i>多い</span><span><i style="background:#e07a6e"></i>少ない</span>' + (cmp ? '<span><i style="border-left:2px dashed #7c3aed;width:0"></i>同じ型の店の中央（その行）</span>' : '') + '<span>目盛りの端 ±' + R + '%</span>' + asideLg('比べる用・' + WL[1 - S.wl] + 'の日の値');
    } else if (an === 'ad') {
      var ma = 0; V.forEach(function (v) { if (v) ma = Math.max(ma, Math.abs(v.d - 1)); });
      R = Math.min(5, Math.max(1, Math.ceil(ma * 2) / 2));
      bar = function (v) { return divBar(v.d, 1, R, NaN); }; tk = divTicks(R, 1, function (x) { return x < 0 ? '' : (Math.round(x * 10) / 10) + '倍'; });
      lg = '<span>特売の日の販売数 ÷ ふだん（倍・真ん中の線＝1倍）</span><span><i style="background:#5b8fd6"></i>ふだんより売れた</span><span><i style="background:#e07a6e"></i>ふだんより少ない</span><span>目盛りの端 ' + num(1 + R, 1) + '倍</span>' + asideLg('比べた特売の件数');
    } else if (an === 'ls') {
      var ml = 0; V.forEach(function (v) { if (v) ml = Math.max(ml, v.d, isFinite(v.md) ? v.md : 0); });
      R = Math.max(5, Math.ceil(ml / 5) * 5);
      bar = function (v) { return oneBar(v.d, R, v.md); }; tk = [[0, '0%'], [50, (R / 2) + '%'], [100, R + '%']];
      lg = '<span>ロスの計（売上に対する %）</span>' + (cmp ? '<span><i style="background:#e07a6e"></i>同じ型の店の中央より多い</span><span><i style="background:#5b8fd6"></i>少ない</span><span><i style="border-left:2px dashed #7c3aed;width:0"></i>同じ型の店の中央（その行）</span>' : '') + '<span>目盛りの端 ' + R + '%</span>' + asideLg('ロスの内訳（売上に対する %）');
    } else {
      bar = function (v) { return mdBar(v.f); }; tk = [[0, '0%'], [50, '50%'], [100, '100%（回の数）']];
      lg = '<span>52週MD の回の結果（計画と比べた回の割合）・数＝下回った回／全部の回</span><span><i style="background:#5b8fd6"></i>上回った</span><span><i style="background:#cbd5e1"></i>並み</span><span><i style="background:#e07a6e"></i>下回った</span>' + asideLg('上回った回の数');
    }
    var vi = 0, rows = VR.map(function (r) {
      if (!r.x) return rowExtra(r);
      var v = V[vi++], cl = !v ? '' : an === 'wx' ? cls(v.d) : an === 'ad' ? cls(v.d - 1) : an === 'ls' && isFinite(v.md) ? (v.d > v.md ? 'dn' : 'up') : '';
      return rowBtn(r, '<span class="pct ' + cl + '">' + esc(v ? v.t : '―') + '</span>' + (v ? bar(v) : '<span class="bar" aria-hidden="true"></span>') + '<span class="val">' + esc(v ? aside(v.t2) : '') + '</span>');
    }).join('');
    var sw = an === 'wx' ? '<div class="wlsw" role="group" aria-label="雨の強さ">' + WL.map(function (t, i) { return '<button type="button" data-wl="' + i + '" aria-pressed="' + (S.wl === i) + '">' + esc(t) + '</button>'; }).join('') + '</div>' : '';
    return '<h2 class="sec" id="dig">掘り下げる — ' + esc(K) + 'ごとの' + esc(AN[an]) + (an === 'wx' ? '（' + esc(mname(S.m, k[0].n)) + '）' : '') + '</h2>' + sw + '<div class="drill an"><div class="lg">' + lg + DC_LG + '</div>' + (tk ? ruler(tk.filter(function (t) { return t[1]; })) : '') + rows + '</div>' + DRILL_HINT;
  }
  function divBar(d, base, R, md) {   // 基準（0 か 1倍）を真ん中に、左右へ
    var pos = function (v) { return 50 + Math.max(-R, Math.min(R, v - base)) / R * 50; }, p = pos(d);
    var b = d >= base ? '<i class="u" style="left:50%;width:' + (p - 50) + '%"></i>' : '<i class="d" style="left:' + p + '%;width:' + (50 - p) + '%"></i>';
    var cut = Math.abs(d - base) > R ? '<span class="cut ' + cls(d - base) + '" style="' + (d > base ? 'right:0' : 'left:0') + '">' + (d > base ? '›' : '‹') + '</span>' : '';
    return '<span class="bar" aria-hidden="true"><span class="zl"></span>' + (isFinite(md) ? '<span class="pl" style="left:' + pos(md) + '%"></span>' : '') + b + cut + '</span>';
  }
  function oneBar(d, R, md) {   // 0 から右へ（ロス率）。物差しより多いと赤
    var w = Math.max(0, Math.min(100, d / R * 100)), hi = isFinite(md) && d > md;
    return '<span class="bar" aria-hidden="true"><span class="zl" style="left:0"></span>' + (isFinite(md) ? '<span class="pl" style="left:' + Math.min(100, md / R * 100) + '%"></span>' : '') + '<i class="' + (hi ? 'd' : 'u') + '" style="left:0;width:' + w + '%"></i></span>';
  }
  function mdBar(f) {   // 上回った・並み・下回った の割合（左から）
    var t = f.n || 1, u = f.up / t * 100, fl = f.flat / t * 100, dn = f.down / t * 100;
    return '<span class="bar" aria-hidden="true"><i class="u" style="left:0;width:' + u + '%"></i><i style="left:' + u + '%;width:' + fl + '%;background:#cbd5e1"></i><i class="d" style="left:' + (u + fl) + '%;width:' + dn + '%"></i></span>';
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
    // 曜日・時間帯・雨・ロス・広告・52週MD は、上の分析の札で選んで、図と掘り下げで見る（2026-11-15。前は、ここに閉じた表で置いていた）
    h += '<details class="det" id="d-read"><summary>数の読み方</summary><div><ul><li>売上・販売数・来客数は1日あたり。前年より＝直近4週を前年の同じ4週と比べた増減。</li><li>部門より下の来客数は「その分類を1つでも買ったレシートの数」（足し算にならない）。単価: 店＝客単価・部門より下＝1人あたり売上。</li><li>AI のコメントは、この段の数を決まった読み方で文にした物です。新しい数は作りません。原因は1つに決めず、考えられる物を並べます。</li></ul></div></details>';
    return h;
  }
  // ── くわしく（はじめ閉じる・開いたときに描く＝閉じた箱の中身を毎回作らない）
  function lazyDet(id, title, kind) { return '<details class="det" id="' + id + '" data-lazy="' + kind + '"><summary>' + esc(title) + '</summary><div class="lz"></div></details>'; }
  var DOWS = ['月', '火', '水', '木', '金', '土', '日'], DOW8 = ['月', '火', '水', '木', '金', '土', '日', '祝'];
  function figt(t) { return '<p class="figt">' + esc(t) + '</p>'; }
  // ── 曜日 × 時間帯の立体の棒（PO 11/16「時間帯や曜日のトレンドは、ヒートマップでは全く見づらい。棒グラフを擬似3Dに」・前の見本 POS ②曜日別来客動向〈ガラスの立体・純 SVG・回す〉を参考）
  //   横＝時刻（左→右）・奥＝曜日（手前が月曜・行の間をあける）・高さ＝数（どの棒も同じ目盛り）。面を少し透かして奥の棒も見せる。
  //   立体の高さは比べにくい（認知の決まり4）ので、曜日ごとの計と峰は行の端の札に数で・同じ数は「表で見る」にも。描き直しは図だけ（往復 0）
  var C3 = { yaw: -20, d: null, YAW0: -20, nar: window.innerWidth < 760 };
  function c3Svg() {
    var o = C3.d; if (!o || !o.H || !o.H.length) return '';
    var H = o.H, hrs = o.hrs, D = H.length, js = [], nar = window.innerWidth < 760;
    for (var j = 0; j < hrs.length; j++) if (H.some(function (r) { return isFinite(r[j]) && r[j] > 0; })) js.push(j);
    if (!js.length) return '';
    var j0 = js[0], J = js[js.length - 1] - j0 + 1;   // どの曜日も 0 の時刻（開店の前・閉店の後）は外す
    var max = 0; H.forEach(function (r) { for (var q = j0; q < j0 + J; q++) if (isFinite(r[q]) && r[q] > max) max = r[q]; }); if (!max) return '';
    var yaw = C3.yaw * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw), dk = 0.66, Hmax = 2.9, G = 2.0, wx = 0.34, wy = 0.2;
    var cx0 = (J - 1) / 2, gyOf = function (k) { return k * G - (D - 1) * G / 2; };
    var P = function (gx, gy, z) { return [gx * c - gy * s, -(gx * s + gy * c) * dk - z]; };
    var bars = [], rows = [], top = null;
    H.forEach(function (r, k) {
      var pk = -1, pv = -1, tot = 0;
      for (var q = j0; q < j0 + J; q++) { var v = r[q]; if (!isFinite(v)) continue; tot += v; if (v > pv) { pv = v; pk = q; } }
      rows.push({ k: k, tot: tot, pk: pk });
      for (var q2 = j0; q2 < j0 + J; q2++) {
        var v2 = r[q2]; if (!isFinite(v2)) continue;
        var gx = q2 - j0 - cx0, gy = gyOf(k), b = { k: k, j: q2, v: v2, gx: gx, gy: gy, z: Math.max(0.03, v2 / max * Hmax), pk: q2 === pk, ry: gx * s + gy * c };
        bars.push(b); if (!top || v2 > top.v) top = b;
      }
    });
    bars.sort(function (a, b) { return b.ry - a.ry; });   // 奥から描く（手前の棒が上に重なる）
    var fx0 = -cx0 - 0.7, fx1 = cx0 + 0.7, fy0 = gyOf(0) - 1.2, fy1 = gyOf(D - 1) + 0.6;
    var pts = [[fx0, fy0], [fx1, fy0], [fx1, fy1], [fx0, fy1]].map(function (p) { return P(p[0], p[1], 0); });
    bars.forEach(function (b) { pts.push(P(b.gx, b.gy, b.z + 0.35)); });
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    // 字の大きさ: 画面で 14px になるように（スマホは図を 620px で描いて横に送る）
    var W = 980, fz = nar ? 14 * W / 500 : 14, pad = 22, side = s < 0 ? 'L' : 'R', LB = nar ? fz * 5.2 : fz * 14;   // 曜日の札は、奥の行と重ならない側の端に
    var sc = Math.min((W - pad * 2 - LB) / (maxx - minx), (nar ? 620 : 500) / (maxy - miny)), HH = Math.round((maxy - miny) * sc + pad * 2 + fz * 1.6);
    var ox = (side === 'L' ? pad + LB : pad) + ((W - pad * 2 - LB) - (maxx - minx) * sc) / 2, oy = pad + fz * 0.4;
    var T = function (p) { return [(ox + (p[0] - minx) * sc).toFixed(1), (oy + (p[1] - miny) * sc).toFixed(1)]; };
    var poly = function (a, fill, st) { return '<polygon points="' + a.map(function (p) { return T(p).join(','); }).join(' ') + '" fill="' + fill + '"' + (st || ' stroke="rgba(15,23,42,.22)" stroke-width="0.6"') + '/>'; };
    var out = poly([P(fx0, fy0, 0), P(fx1, fy0, 0), P(fx1, fy1, 0), P(fx0, fy1, 0)], '#f4f7fb', ' stroke="#d5dde8" stroke-width="1"');
    for (var k = 0; k < D; k++) { var a = T(P(fx0, gyOf(k), 0)), b2 = T(P(fx1, gyOf(k), 0)); out += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b2[0] + '" y2="' + b2[1] + '" stroke="' + (k >= 5 ? '#f1d3b3' : '#cfdcef') + '" stroke-width="1.5"/>'; }
    var lab = '', every = nar ? 3 : (J > 9 ? 2 : 1);
    for (var q3 = 0; q3 < J; q3++) { if (q3 % every && q3 !== J - 1) continue; var t = T(P(q3 - cx0, fy0 + 0.3, 0)); lab += '<text x="' + t[0] + '" y="' + (+t[1] + fz) + '" font-size="' + fz.toFixed(1) + '" text-anchor="middle" fill="#334155">' + hrs[j0 + q3] + '時</text>'; }
    bars.forEach(function (bb) {
      // 色の濃さ＝高さ（PO 11/17「高さでヒートマップのように濃淡」）: 物差しは図の中の全部の棒で1つ（max）。低い＝薄い・高い＝濃い。色の向きは平日＝青・土日と祝日＝橙のまま
      var x0 = bb.gx - wx, x1 = bb.gx + wx, y0 = bb.gy - wy, y1 = bb.gy + wy, z = bb.z, we = bb.k >= 5, hu = we ? 28 : 214, sa = we ? 82 : 64, L = c3Light(bb.v / max);
      var col = function (l, al) { return 'hsla(' + hu + ',' + sa + '%,' + Math.max(18, Math.min(94, l)) + '%,' + al + ')'; };
      out += '<g data-k="' + bb.k + '" data-j="' + bb.j + '">' +
        poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, z), P(x0, y0, z)], col(L, 0.86)) +
        (s < 0 ? poly([P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, z), P(x1, y0, z)], col(L - 14, 0.86)) : poly([P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, z), P(x0, y0, z)], col(L - 14, 0.86))) +
        poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], col(L + 12, 0.97), bb.pk ? ' stroke="#0b2f66" stroke-width="2"' : null) + '</g>';
    });
    if (top) { var tt = T(P(top.gx, top.gy, top.z + 0.12)); lab += '<text x="' + tt[0] + '" y="' + tt[1] + '" font-size="' + fz.toFixed(1) + '" font-weight="800" text-anchor="middle" fill="#0b2f66" paint-order="stroke" stroke="#fff" stroke-width="4">' + esc(num(top.v, 1)) + '</text>'; }
    rows.forEach(function (r) {
      var gx = side === 'L' ? fx0 - 0.15 : fx1 + 0.15, t2 = T(P(gx, gyOf(r.k), 0)), we = r.k >= 5;
      lab += '<text x="' + t2[0] + '" y="' + (+t2[1] + fz * 0.35).toFixed(1) + '" text-anchor="' + (side === 'L' ? 'end' : 'start') + '" font-size="' + fz.toFixed(1) + '" fill="#475569" paint-order="stroke" stroke="#fff" stroke-width="4"><tspan font-weight="800" fill="' + (we ? '#b45309' : '#1f4f8f') + '">' + DOW8[r.k] + '</tspan>' +
        (nar ? '' : ' 計 ' + esc(num(r.tot, 1))) + (r.pk >= 0 ? (nar ? ' ' : '・峰 ') + hrs[r.pk] + '時' : '') + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + HH + '" width="100%" role="img" aria-label="曜日と時間帯ごとの' + esc(o.nm) + 'の立体の棒（数は下の「表で見る」）">' + out + lab + '</svg>';
  }
  /** 高さ（0〜1）→ 明るさ（低い＝薄い 84%・高い＝濃い 36%）。いちばん薄い段でも床（明るさ 97%）と見分けられる */
  function c3Light(t) { t = Math.max(0, Math.min(1, t || 0)); return 84 - 48 * Math.pow(t, 0.85); }
  /** 色の濃さの見本（図のすぐ上の凡例） */
  function c3Legend() {
    var sw = function (hu, sa) { return [0, 0.33, 0.66, 1].map(function (t) { return '<i style="background:hsl(' + hu + ',' + sa + '%,' + (c3Light(t) + 6).toFixed(0) + '%)"></i>'; }).join(''); };
    return '<div class="c3lg"><span>棒の色の濃さ＝' + esc((C3.d && C3.d.nm) || '売上') + 'の高さ（薄い＝少ない・濃い＝多い）</span><span class="sw">平日 ' + sw(214, 64) + '</span><span class="sw">土日・祝 ' + sw(28, 82) + '</span><span><i class="pk"></i>濃い縁＝その曜日の峰</span></div>';
  }
  /** 棒に合わせたときの札（PO 11/17「各柱をホバーした時に、データが出ると…透過カードで」）: 図の数から出せる物だけ。札は1つを使い回す（受け口は document に1つ） */
  var C3TIP = { el: null, g: null, raf: 0, ev: null };
  function c3TipText(k, j) {
    var o = C3.d; if (!o || !o.H || !o.H[k]) return '';
    var H = o.H, v = H[k][j]; if (!isFinite(v)) return '';
    var row = H[k].filter(isFinite).slice().sort(function (a, b) { return b - a; }), rk = row.indexOf(v) + 1;
    var oth = H.filter(function (r, i) { return i !== k && isFinite(r[j]); }).map(function (r) { return r[j]; }), av = oth.length ? oth.reduce(function (a, b) { return a + b; }, 0) / oth.length : NaN;
    var tot = H[k].reduce(function (a, b) { return a + (isFinite(b) ? b : 0); }, 0);
    var li = function (a, b) { return '<span>' + esc(a) + '</span><em>' + esc(b) + '</em>'; };
    return '<b>' + esc(dayNm(k) + ' ' + o.hrs[j] + '時') + '</b>' + li(o.nm + '（1日あたり）', num(v, 1) + ' ' + o.u) +
      li(dayNm(k) + 'の中で', rk === 1 ? '1番目（峰）' : rk + '番目（' + row.length + '時間のうち）') +
      (isFinite(av) && av > 0 ? li('ほかの曜日の' + o.hrs[j] + '時の平均', num(av, 1) + ' ' + o.u + '（' + num(v / av, 2) + '倍）') : '') +
      (tot > 0 ? li(dayNm(k) + 'の1日の計に占める', num(v / tot * 100, 1) + '%') : '');
  }
  function c3TipHide() { if (C3TIP.g) { C3TIP.g.classList.remove('hot'); C3TIP.g = null; } if (C3TIP.el) C3TIP.el.style.display = 'none'; }
  function c3TipShow(g, x, y) {
    if (!C3TIP.el) { C3TIP.el = document.createElement('div'); C3TIP.el.className = 'c3tip'; C3TIP.el.setAttribute('aria-hidden', 'true'); document.body.appendChild(C3TIP.el); }
    var t = C3TIP.el;
    if (C3TIP.g !== g) { if (C3TIP.g) C3TIP.g.classList.remove('hot'); C3TIP.g = g; g.classList.add('hot'); t.innerHTML = c3TipText(+g.getAttribute('data-k'), +g.getAttribute('data-j')); }
    if (!t.innerHTML) { c3TipHide(); return; }
    t.style.display = 'grid';
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var lx = x + 16 + w > vw - 6 ? x - 16 - w : x + 16, ly = y + 16 + h > vh - 6 ? y - 16 - h : y + 16;   // 右・下の端では反対側に
    t.style.left = Math.max(6, lx) + 'px'; t.style.top = Math.max(6, ly) + 'px';
  }
  /** 図の上の結論の一文（認知の決まり9）: 平日と土日の峰の時刻・いちばん多い所 */
  function c3Lead() {
    var o = C3.d; if (!o || !o.H) return '';
    var H = o.H, hrs = o.hrs, top = null, pkOf = function (r) { var pk = -1, pv = -1; r.forEach(function (v, j) { if (isFinite(v) && v > pv) { pv = v; pk = j; } }); return pk; };
    H.forEach(function (r, k) { r.forEach(function (v, j) { if (isFinite(v) && (!top || v > top.v)) top = { k: k, j: j, v: v }; }); });
    if (!top || !(top.v > 0)) return '';
    var rng = function (ks) { var ps = ks.filter(function (k) { return H[k]; }).map(function (k) { return pkOf(H[k]); }).filter(function (p) { return p >= 0; }).map(function (p) { return hrs[p]; }); if (!ps.length) return ''; var a = Math.min.apply(null, ps), b = Math.max.apply(null, ps); return a === b ? a + '時' : a + '〜' + b + '時'; };
    var wd = rng([0, 1, 2, 3, 4]), we = rng([5, 6]);
    return '<p class="c3k">' + (wd ? '平日の峰は <b>' + wd + '</b>' : '') + (we ? '、土日の峰は <b>' + we + '</b>' : '') + '。いちばん多いのは <b>' + dayNm(top.k) + 'の ' + hrs[top.j] + '時</b>（' + esc(num(top.v, 1) + o.u) + '）。</p>';
  }
  function c3Redraw() { c3TipHide(); $$('.c3s').forEach(function (e) { e.innerHTML = c3Svg(); }); }
  function bars(vals, labs, o) {   // 縦の棒（同じ目盛り・0 か基準の線から）。o: { base, fmt, mark〈比べる相手の値の並び〉, markName・barName〈図の上の凡例〉, unit }
    var hasMk = !!(o.mark && o.mark.some(isFinite));
    var lgd = hasMk && o.markName ? '<div class="blg"><span><i class="sb" aria-hidden="true"></i>棒＝' + esc(o.barName || 'この段') + '</span><span><i class="sd" aria-hidden="true"></i>点線＝' + esc(o.markName) + '</span></div>' : '';
    return lgd + barsSvg(vals, labs, o);
  }
  function barsSvg(vals, labs, o) {
    var W = Math.max(320, labs.length * 58), H = 190, pad = 34, base = o.base || 0, fin = vals.concat(o.mark || []).filter(isFinite);
    if (!fin.length) return '<p class="hint">数がありません。</p>';
    var lo = Math.min(base, Math.min.apply(null, fin)), hi = Math.max(base, Math.max.apply(null, fin)), rg = (hi - lo) || 1; lo -= rg * 0.08; hi += rg * 0.12;
    var y = function (v) { return 18 + (H - pad - 18) * (1 - (v - lo) / (hi - lo)); }, bw = (W - 40) / labs.length;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(o.title || '図') + '" data-u="' + esc(o.unit || '') + '"><line x1="30" x2="' + (W - 6) + '" y1="' + y(base) + '" y2="' + y(base) + '" stroke="#334155" stroke-width="1.5"/>';
    vals.forEach(function (v, i) {
      var x = 34 + i * bw, top = Math.min(y(v), y(base)), hgt = Math.abs(y(v) - y(base)), mk = o.mark ? o.mark[i] : NaN;
      var ty = v >= base ? Math.min(top, isFinite(mk) ? y(mk) : top) - 5 : Math.max(top + hgt, isFinite(mk) ? y(mk) : 0) + 14;   // 数の字は、点線と重ならない側に
      if (isFinite(v)) s += '<rect x="' + (x + bw * 0.18) + '" y="' + top + '" width="' + (bw * 0.64) + '" height="' + Math.max(1, hgt) + '" rx="3" fill="' + (v >= base ? '#5b8fd6' : '#e07a6e') + '"/><text x="' + (x + bw / 2) + '" y="' + ty + '" font-size="12" text-anchor="middle" fill="#1f2933">' + esc(o.fmt(v)) + '</text>';
      if (isFinite(mk)) s += '<line x1="' + (x + bw * 0.1) + '" x2="' + (x + bw * 0.9) + '" y1="' + y(mk) + '" y2="' + y(mk) + '" stroke="#7c3aed" stroke-width="2" stroke-dasharray="4 3"><title>' + esc((o.markName || '比べる相手') + ' ' + o.fmt(mk)) + '</title></line>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - 12) + '" font-size="13" text-anchor="middle" fill="#334155">' + esc(labs[i]) + '</text>';
    });
    return '<div class="yr">' + s + '</svg></div>';
  }
  var LAZY = {
    dow: function (n) {
      var m = S.m, v = m === 'a' ? n.dw : (n.dwm && n.dwm[m]);
      if (!v) return '<p class="hint">この段には、曜日の数がありません。</p>';
      var ar = (meta().st && meta().st.ar) || 'エリア', dn = n.lv === 0 ? '店' : n.lv === 1 ? '部門' : '中分類';
      return figt('曜日の指数（' + mname(m, n) + '・ふだん＝1.00・倍）') + bars(v, DOWS, { base: 1, fmt: function (x) { return x.toFixed(2); }, mark: m === 'a' ? n.da : null, markName: ar + '全体' + (n.lv === 0 ? '' : 'の、同じ' + dn) + 'の曜日の指数（エリアの店を合わせた形。予算・前年ではありません）', barName: n.lv === 0 ? 'この店' : n.n, unit: '倍', title: '曜日の指数' }) +
        '<p class="hint">青＝ふだんより多い曜日・赤＝少ない曜日。作る量・発注・人の手当ては、曜日の型に合わせて決める（祝日・行事の日は別に考える）。</p>';
    },
    hour: function (n) {
      var m = S.m === 'u' ? 'a' : S.m, H = n.h && n.h[m];
      if (!H) return '<p class="hint">この段には、時間帯の数がありません。</p>';
      var hrs = meta().hrs || [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], div = m === 'a' ? 1000 : 1, u = m === 'a' ? '千円' : m === 'q' ? '点' : '人';
      C3.d = { H: H.map(function (r) { return r.map(function (v) { return v / div; }); }), hrs: hrs, u: u, nm: mname(m, n) };   // 立体の棒の元（回すときに描き直す）
      var chart = '<div class="c3"><div class="c3b" role="group" aria-label="図の向き"><button type="button" data-c3rot="-15">↺ 左へ回す</button><button type="button" data-c3rot="0">はじめの向き</button><button type="button" data-c3rot="15">右へ回す ↻</button><span class="hint c3h-pc" style="margin:0">マウスで図を左右に引いても回せます。棒にマウスを置くと数の札が出ます（数は下の「表で見る」にも）</span><span class="hint c3h-sp" style="margin:0">図は指で横に送れます。棒を押すと数の札が出ます</span></div>' + c3Legend() + '<div class="c3s">' + c3Svg() + '</div></div>';
      var rows = H.map(function (r, i) {   // 数だけの表（色の濃さはやめた・PO 11/16 夜）。太字＝その曜日の峰・右に1日の計
        var pk = r.indexOf(Math.max.apply(null, r)), tot = r.reduce(function (a, v) { return a + (isFinite(v) ? v : 0); }, 0);
        return '<tr><td>' + DOW8[i] + '</td>' + r.map(function (v, j) { return '<td class="n"' + (j === pk ? ' style="font-weight:800"' : '') + '>' + num(v / div, m === 'a' ? 1 : 0) + '</td>'; }).join('') + '<td class="n"><b>' + num(tot / div, m === 'a' ? 1 : 0) + '</b></td></tr>';
      }).join('');
      return (S.m === 'u' ? '<p class="hint">単価は時間帯の数がないので、売上で見せています。</p>' : '') + figt('曜日 × 時間帯の' + mname(m, n) + '（1日あたり・' + u + '）') + c3Lead() + chart +
        '<p class="hint">棒の高さ＝その曜日・その時刻の' + esc(mname(m, n)) + '（どの棒も同じ目盛り・数のあるのは、いちばん高い棒）。手前から 月→日・祝。青＝平日・橙＝土日と祝日（棒の色の濃さ＝高さ）。縁の濃い棒＝その曜日でいちばん多い時刻（峰）で、行の端に「計」と「峰」を数で出しています。峰の前に主力を並べ、峰のあとは作る量を絞る。</p>' +
        '<details class="det"><summary>表で見る（数・太字＝その曜日の峰）</summary><div>' + table(['曜日'].concat(hrs.map(function (x) { return x + '時'; })).concat(['1日の計']), rows, false) + '</div></details>';
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
  function list(arr) { return '<ul style="margin:0;padding-left:1.2em">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
  function aiHtml(hd, r, y, s) { return '<div class="ai"><div class="hd">' + esc(hd) + '</div><dl><dt>結果</dt><dd>' + esc(r) + '</dd><dt>なぜ</dt><dd>' + esc(y) + '</dd><dt>すること</dt><dd>' + esc(s) + '</dd></dl></div>'; }
  function s1(x) { return String(x || '').replace(/[。\s]+$/, ''); }
  function kc1(c) { return '<button type="button" class="kc1" data-card="' + esc(c.id) + '"><span>' + esc(c.title) + '</span><small>' + esc(c.when || '') + (c.dept ? '・' + esc(c.dept) : '') + '</small></button>'; }
  function ymL(ym) { var p = String(ym || '').split('-'); return p.length === 2 ? p[0] + '年' + (+p[1]) + '月' : String(ym || ''); }

  // ── 月の指数（PO 11/17「今月の型から右は分析レポートのように、気になるところを深堀りできる形」）
  //   指数＝その月の1日あたり売上 ÷ 12か月の平均（店の木の n.m＝月ごとの1日あたり売上・新しい12か月で数える）。1.0倍＝ふだんの月。数は1年分だけなので目安
  function midx(n, mo, T) {
    var a = n && n.m, ms = (T && T.meta && T.meta.months) || []; if (!a || !a.length || !ms.length) return null;
    var L = Math.min(12, a.length, ms.length), off = a.length - L, moff = ms.length - L, ser = a.slice(off), sum = 0, c = 0, sold = 0, at = -1;
    for (var j = 0; j < L; j++) { var v = ser[j]; if (isFinite(v)) { sum += v; c++; if (v > 0) sold++; } if (+String(ms[moff + j]).slice(5, 7) === mo) at = j; }
    if (!c || !(sum > 0) || at < 0 || !isFinite(ser[at])) return null;
    var base = sum / c;
    return { v: ser[at] / base, d: ser[at], base: base, sold: sold, cnt: L, ser: ser, at: at, ym: ms[moff + at], ms: ms.slice(moff), full: sold === L && L === 12 };
  }
  /** 部門をまとめた指数（辞書のグロッサリー＝一般食品＋菓子＋日雑 など）: 月ごとの売上を足してから割る */
  function midxSum(list, mo, T) {
    var ns = list.filter(Boolean); if (!ns.length) return null; if (ns.length === 1) return midx(ns[0], mo, T);
    var L = Math.max.apply(null, ns.map(function (x) { return (x.m || []).length; })), m = [];
    for (var i = 0; i < L; i++) { var s = 0, ok = false; ns.forEach(function (x) { var v = x.m && x.m[i]; if (isFinite(v)) { s += v; ok = true; } }); m.push(ok ? s : NaN); }
    return midx({ m: m }, mo, T);
  }
  /** 月の指数の目盛り（店とその月で1つ・どの行も同じ）: 部門・中分類・クラスの |指数−1| の 9割の値を 0.1 刻みに上げる（0.3〜1.0）。押して開いても目盛りは替わらない */
  function monR(T, mo) {
    var c = T.__mr || (T.__mr = {}); if (c[mo]) return c[mo];
    var a = []; for (var id in T.N) { var n = T.N[id]; if (n.lv === 0 || n.lv === 3) continue; var x = midx(n, mo, T); if (x && x.full) a.push(Math.abs(x.v - 1)); }
    a.sort(function (p, q) { return p - q; });
    var p90 = a.length ? a[Math.floor((a.length - 1) * 0.9)] : 0.3;
    return (c[mo] = Math.min(1, Math.max(0.3, Math.ceil(p90 * 10 - 1e-9) / 10)));
  }
  function idxTick(x) { return (Math.round(x * 100) / 100) + '倍'; }
  /** 1〜12月の並びの指数（12か月の形） */
  function cal12(x) {
    var out = [];
    for (var k = 1; k <= 12; k++) { var j = -1; for (var i = x.ms.length - 1; i >= 0; i--) if (+String(x.ms[i]).slice(5, 7) === k) { j = i; break; } out.push(j >= 0 && isFinite(x.ser[j]) ? x.ser[j] / x.base : NaN); }
    return out;
  }
  /** 12か月の形の小さな棒（ふだん＝1.0 の線から上下・どの行も同じ目盛り mt・選んだ月の列に色・縁の濃い棒＝山の月） */
  function mon12Svg(v12, sel, mt, ph) {
    var CW = 20, PW = CW * 12, PH = ph || 40, MID = PH / 2, pk = maxAt(v12);
    var o = '<svg class="m12" width="100%" height="' + PH + '" viewBox="0 0 ' + PW + ' ' + PH + '" preserveAspectRatio="none" aria-hidden="true">';
    if (sel >= 1 && sel <= 12) o += '<rect x="' + (sel - 1) * CW + '" y="0" width="' + CW + '" height="' + PH + '" fill="#dbe8fb"/>';
    o += '<line x1="0" x2="' + PW + '" y1="' + MID + '" y2="' + MID + '" stroke="#64748b" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    v12.forEach(function (v, i) {
      if (!isFinite(v)) return;
      var h = Math.max(1.5, Math.min(1, Math.abs(v - 1) / mt) * (MID - 2)), up = v >= 1;
      o += '<rect x="' + (i * CW + 4) + '" y="' + (up ? MID - h : MID).toFixed(1) + '" width="' + (CW - 8) + '" height="' + h.toFixed(1) + '" fill="' + (up ? '#5b8fd6' : '#e07a6e') + '"' + (i === pk ? ' stroke="#0b2f66" stroke-width="2" vector-effect="non-scaling-stroke"' : '') + '/>';
    });
    return o + '</svg>';
  }
  function m12Labels(only) { var o = ''; for (var k = 1; k <= 12; k++) o += '<span>' + (!only || k === only ? k + (only ? '月' : '') : '') + '</span>'; return '<div class="m12l" aria-hidden="true">' + o + '</div>'; }   // only＝札の中（狭い）: 選んだ月だけ字を出す
  /** 掘り下げの下の段（今月の型）: 部門は決まった並び・中分類より下は指数の高い順（小分類の区切りも高い順・その中のクラスも高い順） */
  function monKids(n, T, mo) {
    if (!n || !n.ch) return [];
    if (n.lv === 0) return kidsT(n, T.N);
    var all = T.N, k = function (x) { var i = midx(x, mo, T); return i ? i.v : -1; }, direct = [], groups = [];
    n.ch.forEach(function (id) {
      var c = all[id]; if (!c) return;
      if (c.lv === 3) { var ks = (c.ch || []).filter(function (j) { return all[j]; }).map(function (j) { return { n: all[j], id: j, g: c.n, gi: id }; }); ks.sort(function (a, b) { return k(b.n) - k(a.n); }); groups.push({ c: c, ks: ks }); }
      else direct.push({ n: c, id: id });
    });
    direct.sort(function (a, b) { return k(b.n) - k(a.n); });
    groups.sort(function (a, b) { return k(b.c) - k(a.c); });
    return groups.reduce(function (o, g) { return o.concat(g.ks); }, direct);
  }
  function monRows(n, T, mo, R, md, dep, O) {
    var out = '', lastG = null;
    monKids(n, T, mo).forEach(function (x) {
      if (x.g && x.g !== lastG) { lastG = x.g; var gi = midx(T.N[x.gi], mo, T); out += '<div class="grp sub" style="--dep:' + dep + '">' + esc(x.g) + (gi ? '<small>（' + num(gi.v, 2) + '倍）</small>' : '') + '</div>'; }
      var nd = x.n, mi = midx(nd, mo, T), can = hasKids(nd), op = !!O[x.id], st = dcStyleT(nd, T.N, dep), dc = deptOfT(nd, T.N);
      var tip = can ? '押すと、すぐ下に' + nd.n + 'の中が開きます（もう一度押すと閉じる）' : '押すと、すぐ下に' + nd.n + 'の12か月の形と山の月が開きます（もう一度押すと閉じる）';
      out += '<button type="button" class="drow mrw' + (dc && deptCol(dc.n) ? ' dc' : '') + (dep ? ' sub' : '') + (op ? ' open' : '') + '" data-mmo="' + esc(x.id) + '" aria-expanded="' + op + '"' + (st ? ' style="' + st + '"' : '') + ' title="' + esc(tip) + '">' +
        '<span class="n"><span class="ar">' + (op ? '▼' : '▶') + '</span><span>' + esc(nd.n) + '</span></span>' +
        '<span class="pct ' + (mi ? cls((mi.v - 1) * 100) : '') + '">' + (mi ? num(mi.v, 2) + '倍' : '―') + '</span>' +
        (mi ? divBar(mi.v, 1, R, md) : '<span class="bar" aria-hidden="true"></span>') +
        '<span class="val">' + esc(mi ? aside(num(mi.d, mi.d < 100 ? 1 : 0) + '千円/日' + (mi.full ? '' : '・売れた月 ' + mi.sold + '/' + mi.cnt)) : '') + '</span></button>';
      if (op) out += can ? monRows(nd, T, mo, R, md, dep + 1, O) : monLeaf(nd, T, mo, dep + 1);
    });
    return out;
  }
  /** いちばん下（クラス）: 12か月の形と山の月 → 次の一手（決まった文）とその部門の判断カード */
  function monLeaf(nd, T, mo, dep) {
    var mi = midx(nd, mo, T), st = dcStyleT(nd, T.N, dep), dpn = deptOfT(nd, T.N);
    if (!mi) return '<div class="mleaf" style="' + st + '"><p class="hint" style="margin:0">この分類には、月ごとの売上がありません。</p></div>';
    var v12 = cal12(mi), pk = maxAt(v12), lo = minAt(v12), mt = 0.2;
    v12.forEach(function (v) { if (isFinite(v)) mt = Math.max(mt, Math.abs(v - 1)); }); mt = Math.min(mt, 2);
    var d6 = dpn ? POS2DICT[deptBase(dpn.n)] || '' : '', cards = d6 && DICT ? (DICT.cards || []).filter(function (k) { return k.dept === d6; }).slice(0, 3) : [];
    return '<div class="mleaf" style="' + st + '"><div class="mlh"><b>' + esc(nd.n) + 'の12か月の形</b>（月ごとの1日あたり売上 ÷ 12か月の平均・青い列＝' + mo + '月・棒の端 ' + num(1 + mt, 1) + '倍）</div>' +
      '<div class="m12w">' + mon12Svg(v12, mo, mt, 70) + m12Labels() + '</div>' +
      '<p class="mlt">山の月 <b>' + (pk + 1) + '月</b>（' + num(v12[pk], 2) + '倍）・谷の月 ' + (lo + 1) + '月（' + num(v12[lo], 2) + '倍）' + (mi.full ? '' : '｜12か月のうち売れた月は ' + mi.sold + '（季節の品か、途中から入った分類。倍の数は大きく出やすい）') + '</p>' +
      '<div class="nx"><b>次の一手</b>: 山の月（' + (pk + 1) + '月）の前の週に、売場と量を用意する。' + (cards.length ? '<div class="nxl">' + cards.map(kc1).join('') + '</div>' : '') + '</div></div>';
  }
  function monDrill(st, T, mo) {
    var R = monR(T, mo), O = {}, sx = midx(st, mo, T), ms = (T.meta && T.meta.months) || [];
    (S.mmo || []).forEach(function (id) { O[id] = 1; });
    var per = ms.length ? ymL(ms[Math.max(0, ms.length - 12)]) + '〜' + ymL(ms[ms.length - 1]) : '';
    return '<h2 class="sec" id="dig">掘り下げる — 去年の' + mo + '月、ふだんの月より売れた所' + (sx ? '<small>' + esc(ymL(sx.ym)) + ' ÷ 12か月の平均</small>' : '') + '</h2>' +
      '<div class="drill an mdig"><div class="lg"><span>月の指数（その月の1日あたり売上 ÷ 12か月の平均・真ん中の線＝1.0倍＝ふだんの月）</span><span><i style="background:#5b8fd6"></i>ふだんの月より売れた</span><span><i style="background:#e07a6e"></i>少なかった</span>' +
      (sx ? '<span><i style="border-left:2px dashed #7c3aed;width:0"></i>' + esc(st.n) + '全体（' + num(sx.v, 2) + '倍）</span>' : '') + '<span>目盛りの端 ' + num(1 - R, 1) + '〜' + num(1 + R, 1) + '倍（どの行も同じ）</span>' + asideLg('その月の1日あたり売上') + DC_LG + '</div>' +
      ruler(divTicks(R, 1, idxTick)) + monRows(st, T, mo, R, sx ? sx.v : NaN, 0, O) + '</div>' +
      '<div class="hint">行を押すと、すぐ下にその中が開きます（もう一度押すと閉じる）。クラスを押すと、12か月の形と山の月が開きます。中分類より下は、指数の高い順です。「売れた月 3/12」＝12か月のうち売れた月が少ない分類（季節の品か、途中から入った分類。倍の数は大きく出やすい）。数は1年分（' + esc(per) + '）だけなので、その年の天気・広告・暦のずれが混ざった目安です。</div>';
  }
  /** 一番下: 12か月の形と山の月（店全体と部門・どの行も同じ目盛り） */
  function monShape(st, T, mo) {
    var rows = [{ n: st }].concat(kidsT(st, T.N)).map(function (x) { var mi = midx(x.n, mo, T); return mi ? { n: x.n, v12: cal12(mi) } : null; }).filter(Boolean);
    if (!rows.length) return '';
    var mt = 0.1; rows.forEach(function (r) { r.v12.forEach(function (v) { if (isFinite(v)) mt = Math.max(mt, Math.abs(v - 1)); }); }); mt = Math.min(mt, 0.6);
    var tk = []; for (var i = 0; i < 12; i++) tk.push([(i + 0.5) * 100 / 12, (i + 1) + '月']);
    return '<h2 class="sec" id="mshape">12か月の形と山の月 — ' + esc(st.n) + '</h2><div class="drill an m12d"><div class="lg"><span>月ごとの1日あたり売上 ÷ 12か月の平均（線から上＝ふだんの月より多い）</span><span><i style="background:#5b8fd6"></i>多い月</span><span><i style="background:#e07a6e"></i>少ない月</span><span><i style="background:#dbe8fb"></i>' + mo + '月</span><span>棒の端 ±' + Math.round(mt * 100) + '%（どの行も同じ目盛り）・縁の濃い棒＝山の月</span>' + asideLg('谷の月') + '</div>' +
      ruler(tk).replace('drow leaf ruler', 'drow leaf ruler yrr') +
      rows.map(function (r) {
        var pk = maxAt(r.v12), lo = minAt(r.v12), c = r.n.lv === 1 ? deptCol(r.n.n) : null;
        return '<div class="drow leaf' + (c ? ' dc' : '') + (r.n.lv ? ' sub' : '') + '"' + (c ? ' style="--dbg:' + c[0] + ';--dac:' + c[1] + ';--dep:1"' : '') + '><span class="n"><span class="ar">・</span><span>' + esc(r.n.n) + '</span></span><span class="pct">山 ' + (pk + 1) + '月</span><span class="bar tmb m12b" aria-hidden="true">' + mon12Svg(r.v12, mo, mt) + '</span><span class="val">' + esc(aside('谷 ' + (lo + 1) + '月')) + '</span></div>';
      }).join('') + '</div>';
  }
  /** この月に「いつ」がかかる判断カード（催事の印のあるカード・when_from〜when_to から数える） */
  function monthCards(mo) {
    var out = [];
    (DICT.cards || []).forEach(function (c) { if (!c.ev) return; var e = DICT.events.filter(function (x) { return x.name === c.ev; })[0]; if (e && cardMonths(c, e).indexOf(mo) >= 0) out.push(c); });
    return out;
  }
  /** 今月の型の AI のコメント（この月の数を決まった読み方で文にした物。新しい数は作らない・原因は1つに決めない） */
  function monText(st, T, mo, M, evs, deps) {
    var s = midx(st, mo, T); if (!s) return null;
    var ds = deps.slice().sort(function (a, b) { return b.i.v - a.i.v; }), up = ds[0], dn = ds[ds.length - 1];
    var cl = []; for (var id in T.N) { var n = T.N[id]; if (n.lv !== 4) continue; var x = midx(n, mo, T); if (x && x.full && x.base >= 1) cl.push({ n: n, i: x }); }   // 12か月とも売れた・1日 1千円以上のクラスだけ（季節の品・小さい分類は倍の数が大きく出やすい）
    cl.sort(function (a, b) { return b.i.v - a.i.v; });
    var hi = cl.slice(0, 2), lo = cl.length > 2 ? cl[cl.length - 1] : null, f = function (o) { return o.n.n + '（' + num(o.i.v, 2) + '倍）'; };
    return [st.n + 'の' + ymL(s.ym) + 'の1日あたり売上は、12か月の平均の ' + num(s.v, 2) + '倍。' + (up && dn && up !== dn ? '部門では、いちばん伸びたのは' + up.x.n.n + '（' + num(up.i.v, 2) + '倍）、いちばん落ちたのは' + dn.x.n.n + '（' + num(dn.i.v, 2) + '倍）。' : '') +
      (hi.length ? 'クラスまで下りると、ふだんの月より売れたのは' + hi.map(f).join('・') + (lo ? '、少なかったのは' + f(lo) : '') + '。' : ''),
      'この月のテーマ（' + (M.theme || '―') + '）' + (evs.length ? 'と催事（' + evs.map(function (e) { return e.name; }).join('・') + '）' : '') + 'の需要が考えられる。ほかに、去年のその月の天気・広告・暦のずれ、売場や品ぞろえの変化も混ざる。数は1年分だけなので、どれが効いたかは記録だけでは見分けられない（目安）。',
      (hi.length ? hi.map(function (o) { return o.n.n; }).join('・') + 'など、去年この月に伸びた所は、山の前の週に売場と量を用意する。' : '') + (lo ? lo.n.n + 'など落ちた所は、量を絞る前に、去年の売場と天気を確かめる。' : '') + 'この月に「いつ」がかかる判断カードは、すぐ下の「次の一手」に。'];
  }
  function lensMonth() {
    var mo = S.month || (new Date().getMonth() + 1), M = DICT.months.filter(function (x) { return x.m === mo; })[0] || {};
    var evs = DICT.events.filter(function (e) { return e.month === mo; });
    var prep = DICT.events.filter(function (e) { var d = ((e.month - mo) % 12 + 12) % 12; return d > 0 && d <= (e.lead || 0); });
    var st = curStoreTop(), T = st && TREE ? TREE : null; if (st && !TREE) ensureTree();
    var sx = T ? midx(st, mo, T) : null, deps = T ? kidsT(st, T.N).map(function (x) { return { x: x, i: midx(x.n, mo, T) }; }).filter(function (o) { return o.i; }) : [];
    var ds = deps.slice().sort(function (a, b) { return b.i.v - a.i.v; }), mcs = monthCards(mo);
    var h = '<h1 class="vt" id="lvtop">今月の型<span class="mon"><button type="button" data-month="-1" aria-label="前の月">◀</button><b>' + mo + '月</b><button type="button" data-month="1" aria-label="次の月">▶</button></span><small>毎年この月にすること' + (sx ? '｜' + esc(st.n) + 'の数は ' + esc(ymL(sx.ym)) + '（1年分だけの目安）' : '') + '</small></h1>';
    // 1. 札（俯瞰）: テーマ／催事／自店の去年のこの月（12か月の小さな棒）／伸びた部門・落ちた部門
    var tl = [{ nm: 'この月のテーマ', v: esc(M.theme || '―'), vc: 'tx', sub2: cut1(M.spot, 46) },
      { nm: '催事', v: evs.length ? esc(evs.map(function (e) { return e.name; }).join('・')) : 'この月の当日は無し', vc: 'tx', sub2: prep.length ? '準備中: ' + prep.map(function (e) { return e.name + '（' + e.month + '月）'; }).join('・') : '準備中の催事はありません' }];
    if (sx) {
      var v12 = cal12(sx), mt = 0.1; v12.forEach(function (v) { if (isFinite(v)) mt = Math.max(mt, Math.abs(v - 1)); });
      tl.push({ nm: '自店の去年の' + mo + '月', v: num(sx.v, 2) + '<small>倍</small>', sub2: '12か月の平均＝1.0倍｜' + ymL(sx.ym) + '・1日あたり ' + num(sx.d, 0) + '千円（平均 ' + num(sx.base, 0) + '千円）', fig: '<div class="fig">' + mon12Svg(v12, mo, Math.min(mt, 0.6), 34) + m12Labels(mo) + '</div>' });
      if (ds.length > 1) tl.push({ nm: '伸びた部門・落ちた部門', v: esc(ds[0].x.n.n) + ' <small>' + num(ds[0].i.v, 2) + '倍</small>', vc: 'tx', sub2: '落ちた: ' + ds[ds.length - 1].x.n.n + ' ' + num(ds[ds.length - 1].i.v, 2) + '倍（部門の指数）' });
    } else if (st && !TREE) tl.push({ nm: '自店の去年の' + mo + '月', v: '<span class="spin" aria-hidden="true"></span>', sub: '自店の数を読み込んでいます…' });
    if (tl.length < 4) tl.push({ nm: '判断カード', u: '枚', v: mcs.length + '<small>枚</small>', sub: 'この月に「いつ」がかかるカード' });
    var mTl = '<div class="tiles t4 mtiles">' + tl.map(tile).join('') + '</div>', mAi = '', mDig = '';
    if (!st) mTl += '<div class="hint">' + (ME && (ME.role === 'hq' || ME.role === 'admin') ? '全店のいまで店を開くと、その店の「去年のこの月」の数と掘り下げが、ここに出ます（いまは辞書の部分だけ）。' : 'このアカウントには店が結ばれていないので、辞書の部分だけを出しています。') + '</div>';
    // 2. AI のコメント → 次の一手（この月に「いつ」がかかる判断カード）
    var t = T ? monText(st, T, mo, M, evs, deps) : null;
    if (t) mAi += aiHtml('AI のコメント（' + mo + '月の型・' + st.n + '）', t[0], t[1], t[2]);
    mAi += '<div class="nx"><b>次の一手</b>（' + mo + '月に「いつ」がかかる判断カード・' + mcs.length + '枚）' + (mcs.length ? '<div class="nxl">' + mcs.map(kc1).join('') + '</div>' : '<p style="margin:4px 0 0">この月に「いつ」がかかる判断カードはありません。下の「くわしく（この月の資料）」と、催事ごとを見てください。</p>') + '</div>';
    // 3. 掘る（去年のこの月、ふだんの月より売れた所: 部門 → 中分類 → 小分類 → クラス）。行を押したときは、この塊だけを描き直す
    if (T && sx) mDig += blk('blk-mdig', function () { return monDrill(st, T, mo); }) + monShape(st, T, mo);
    else if (st && !TREE) mDig += '<h2 class="sec" id="dig">掘り下げる</h2><div class="drill"><div class="hint wait"><span class="spin" aria-hidden="true"></span>この店の月ごとの数を読み込んでいます…</div></div>';
    h += duo(mTl, mAi, mDig);
    // 4. くわしく（この月の資料・はじめ閉じる・開いたときに描く）
    h += lazyBox('d-mon', 'くわしく（この月の資料: 記念日・チラシ・よく買われるもの・天気と需要・売場の山・週のテーマ・気をつける所）', function () { return monDetail(M, evs, prep); });
    return h;
  }
  function monDetail(M, evs, prep) {
    var det = '<div class="box"><h3>この月のテーマ</h3><p style="margin:0">' + esc(M.theme || '―') + '</p>' + (M.spot ? '<p class="hint">' + esc(M.spot) + '</p>' : '') + '</div>';
    det += '<div class="box"><h3>催事と準備</h3>' + (evs.length ? '<div class="evs">' + evs.map(evBtn).join('') + '</div>' : '<p class="hint">この月に当日が来る催事はありません。</p>') +
      (prep.length ? '<p class="hint" style="margin-top:8px">準備・予約が動いている催事: ' + prep.map(function (e) { return '<button type="button" class="lk" data-ev="' + esc(e.id) + '">' + esc(e.name) + '（' + e.month + '月）</button>'; }).join('・') + '</p>' : '') + '</div>';
    Object.keys(M.items || {}).forEach(function (k) { var it = M.items[k]; if (it && it.list && it.list.length) det += '<div class="box"><h3>' + esc(it.label || k) + '</h3>' + list(it.list) + '</div>'; });
    if (M.note) det += '<div class="box"><h3>この月の気をつける所</h3><p style="margin:0">' + esc(M.note) + '</p></div>';
    det += '<div class="box"><h3>天気と売れ方</h3><p style="margin:0 0 6px">' + esc((DICT.weather && DICT.weather.calendar && DICT.weather.calendar[0]) || '') + '</p><div class="nx"><button type="button" data-lens="wx">天気と売れ方を開く ▸</button></div></div>';
    return det;
  }
  function evBtn(e) { return '<button type="button" class="ev" data-ev="' + esc(e.id) + '" aria-pressed="' + (S.ev === e.id) + '"><b>' + esc(e.name) + '</b><small>' + e.month + '月' + (e.day ? '・' + esc(e.day) : '') + (e.lead ? '・準備 ' + e.lead + 'か月前から' : '') + '</small></button>'; }

  // ── 催事の「いつ」（判断カードの when_from・when_to＝E-2m・E-1d・E・E+3d など。E＝当日）
  var DAY = 86400000;
  function today0() { var t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  /** 当日（だいたい）: 「2/3」「12/23〜25」は書いてある日・「5月第2日曜」はその年のその日・「7月下旬」は25日・「9月」は15日 */
  function evDate(e, yr) {
    var m = e.month, d = 15, s = String(e.day || ''), r;
    if ((r = /^(\d{1,2})\/(\d{1,2})/.exec(s))) { m = +r[1]; d = +r[2]; }
    else if ((r = /第(\d)日曜/.exec(s))) { var wd = new Date(yr, m - 1, 1).getDay(); d = 1 + ((7 - wd) % 7) + (+r[1] - 1) * 7; }
    else if (/下旬/.test(s)) d = 25; else if (/上旬/.test(s)) d = 5;
    return new Date(yr, m - 1, d);
  }
  function offDate(base, code) {
    var r = /^E(?:([+-])(\d+)([dwm]))?$/.exec(String(code || '')); if (!r) return null;
    var t = new Date(base.getTime()); if (!r[1]) return t;
    var k = (r[1] === '-' ? -1 : 1) * +r[2];
    if (r[3] === 'd') t.setDate(t.getDate() + k); else if (r[3] === 'w') t.setDate(t.getDate() + 7 * k); else t.setMonth(t.getMonth() + k);
    return t;
  }
  function evNext(e) { var now = today0(), y = now.getFullYear(), d = evDate(e, y); if (d.getTime() + 3 * DAY < now.getTime()) d = evDate(e, y + 1); return d; }   // 次に来る当日（3日より前に過ぎていれば来年）
  function evDays(e) { return Math.round((evNext(e).getTime() - today0().getTime()) / DAY); }
  function cardWin(c, base) { var a = offDate(base, c.when_from), b = offDate(base, c.when_to); if (!a || !b) return null; return a <= b ? [a, b] : [b, a]; }
  function cardMonths(c, e) {
    var w = cardWin(c, evDate(e, 2026)); if (!w) return [];
    var out = [], t = new Date(w[0].getFullYear(), w[0].getMonth(), 1);
    for (var g = 0; t <= w[1] && g < 14; g++) { if (out.indexOf(t.getMonth() + 1) < 0) out.push(t.getMonth() + 1); t.setMonth(t.getMonth() + 1); }
    return out;
  }
  function evCards(e) { return (DICT.cards || []).filter(function (c) { return c.ev === e.name; }); }
  function evFacts(e) { return (DICT.facts || []).filter(function (f) { return f.ev === e.name; }); }
  function evCalls(cards) { var seen = {}, out = []; cards.forEach(function (c) { (c.basis || []).forEach(function (b) { var k = byId(DICT.calls, b); if (k && !seen[k.id]) { seen[k.id] = 1; out.push(k); } }); }); return out; }
  function fval(f) { var v = f.value; return (typeof v === 'number' ? num(v, Math.round(v) === v ? 0 : 1) : String(v == null ? '' : v)) + (f.unit || ''); }
  function evTag(e, now) { var dd = ((e.month - now) % 12 + 12) % 12; return e.month === now ? '<small class="ytag on">今月</small>' : dd > 0 && dd <= (e.lead || 0) ? '<small class="ytag">準備中</small>' : ''; }
  function cardWhen(c, e) { return String(c.when || '').replace(e.name + 'の', ''); }
  /** いちばん近い時期のカード（いまがその時期の物を先に・次に、始まりが近い物） */
  function evNextCard(e, cards) {
    var now = today0().getTime(), nd = evNext(e), best = null;
    cards.forEach(function (c) {
      var w = cardWin(c, nd); if (!w) return;
      if (w[1].getTime() + DAY < now) { var w2 = cardWin(c, evDate(e, nd.getFullYear() + 1)); if (w2) w = w2; }
      var st = w[0].getTime(), k = st <= now ? 0 : st - now;
      if (!best || k < best.k) best = { c: c, k: k, act: st <= now };
    });
    return best;
  }
  /** 催事の選び（1行の横送り・今月／準備中の印） */
  function evStrip(cur) {
    var now = new Date().getMonth() + 1;
    return '<div class="evstrip" role="group" aria-label="催事を選ぶ">' + DICT.events.map(function (e) { return '<button type="button" class="ev1" data-ev="' + esc(e.id) + '" aria-pressed="' + (e.id === cur) + '"><b>' + esc(e.name) + '</b><span>' + e.month + '月' + evTag(e, now) + '</span></button>'; }).join('') + '</div>';
  }
  /** 準備から当日までの帯の上に、判断カードを1行ずつ（カードの「いつ」の間を緑の帯・橙の地＝準備の間・紺の線＝当日） */
  function evBand(e, cards) {
    var E = evDate(e, 2026), lead = e.lead || 0, P = offDate(E, 'E-' + lead + 'm'), ws = cards.map(function (c) { return { c: c, w: cardWin(c, E) }; }).filter(function (o) { return o.w; });
    if (!ws.length) return '<h3 class="mh" id="evband">準備から当日まで — 判断カードの時期</h3><div class="hint">この催事に印の付いた判断カードは、まだありません（本部が書く欄）。</div>';
    var t0 = Math.min(P.getTime(), Math.min.apply(null, ws.map(function (o) { return o.w[0].getTime(); }))) - 3 * DAY, t1 = Math.max(E.getTime() + 2 * DAY, Math.max.apply(null, ws.map(function (o) { return o.w[1].getTime(); }))) + 3 * DAY;
    var pos = function (t) { return (t - t0) / (t1 - t0) * 100; }, tk = [];
    for (var k = 12; k >= 1; k--) { var tm = offDate(E, 'E-' + k + 'm').getTime(); if (tm >= t0) tk.push([pos(tm), k + 'か月前']); }
    tk.push([pos(E.getTime()), '当日']);
    var pe = pos(E.getTime()), pp = pos(P.getTime());
    var rows = ws.sort(function (a, b) { return a.w[0] - b.w[0]; }).map(function (o) {
      var a = pos(o.w[0].getTime()), b = pos(o.w[1].getTime() + DAY), w = Math.max(1.6, b - a);
      return '<button type="button" class="drow evc" data-card="' + esc(o.c.id) + '" title="押すと、判断カード「' + esc(o.c.title) + '」が開きます"><span class="n"><span class="ar">▸</span><span>' + esc(o.c.title) + '</span></span><span class="pct">' + esc(cardWhen(o.c, e)) + '</span>' +
        '<span class="bar evb" aria-hidden="true" style="--pe:' + pe.toFixed(2) + '%;--pp:' + pp.toFixed(2) + '%"><i class="cw" style="left:' + Math.min(100 - w, a).toFixed(2) + '%;width:' + w.toFixed(2) + '%"></i></span><span class="val">' + esc(aside(o.c.dept || '全部門')) + '</span></button>';
    }).join('');
    return '<h3 class="mh" id="evband">準備から当日まで — 判断カードの時期<small>カードを押すと開きます</small></h3><div class="drill an evband"><div class="lg"><span><i class="lgcw"></i>カードの時期（いつ）</span>' + (lead ? '<span><i class="lgpp"></i>準備・予約が動く間（' + lead + 'か月前から）</span>' : '') + '<span><i style="background:#1f4f8f;width:3px"></i>当日</span>' + asideLg('部門') + '</div>' + ruler(tk).replace('drow leaf ruler', 'drow leaf ruler evc') + rows + '</div>';   // 目盛りの行も、カードの行と同じ列の幅（evc）
  }
  /** 催事の AI のコメント: 結果＝数字の事実・なぜ＝過去の判断とその結果・すること＝判断カード（どれも辞書の文のまま。作文で埋めない） */
  function evAi(e, cards, facts, calls) {
    if (!facts.length && !cards.length && !calls.length) return '';
    var r = facts.length ? facts.slice(0, 3).map(function (f) { return f.metric + ' ' + fval(f) + (f.period ? '（' + f.period + '）' : ''); }).join('。') + '。' : 'この催事の数字の事実は、まだありません。';
    var y = calls.length ? calls.slice(0, 2).map(function (k) { return '過去の判断「' + s1(k.decision) + '」→ ' + (s1(k.outcome) || '結果の記録なし') + (k.verdict ? '（' + k.verdict + '）' : ''); }).join('。') + '。' : '過去の判断とその結果の記録は、まだありません（本部が書く欄）。';
    var s = cards.length ? cards.slice(0, 2).map(function (c) { return c.title + '（' + cardWhen(c, e) + '）: ' + s1(c['do']); }).join('。') + '。' : 'この催事に印の付いた判断カードは、まだありません。下の掘り下げで、部門ごとの型を見てください。';
    return aiHtml('AI のコメント（' + e.name + '）', r, y, s);
  }
  // ── 催事の掘り下げ（部門 → 区分 → 売場の型・計画・注意点・反省・カード）。催事ごと・年間の流れ・部門ごとで同じ部品
  var DICT2POS = { '農産': ['青果'], '畜産': ['精肉'], '水産': ['水産'], '惣菜': ['惣菜'], '日配': ['日配'], 'グロッサリー': ['一般食品', '菓子', '日雑'] };
  var POS2DICT = { '青果': '農産', '精肉': '畜産', '水産': '水産', '惣菜': '惣菜', '日配': '日配', '一般食品': 'グロッサリー', '菓子': 'グロッサリー', '日雑': 'グロッサリー' };
  function evGroups(e, only) {
    var g = {}, keys = [], ord = ['（全体）'].concat(DEPT6);
    (e.depts || []).forEach(function (d, i) { var k = d.dept6 || '（全体）'; if (only && k !== only) return; if (!g[k]) { g[k] = []; keys.push(k); } g[k].push({ d: d, i: i }); });
    keys.sort(function (a, b) { var p = ord.indexOf(a), q = ord.indexOf(b); return (p < 0 ? 99 : p) - (q < 0 ? 99 : q); });
    return keys.map(function (k) { return { k: k, list: g[k] }; });
  }
  function posNodes(T, k) { var st = T.N.S; if (!st) return []; if (k === '（全体）') return [st]; var nm = DICT2POS[k] || []; return (st.ch || []).map(function (id) { return T.N[id]; }).filter(function (n) { return n && nm.indexOf(n.n) >= 0; }); }
  /** 区分の名前に当たる自店の分類（同じ名前の部門・中分類・クラス）。当たらなければ null（数を作らない） */
  function kbNode(T, k, name) {
    var b = String(name || '').replace(/（.*$/, ''), roots = posNodes(T, k); if (!b) return null;
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i]; if (r.n === b) return r;
      var q = (r.ch || []).slice(), g = 0;
      while (q.length && g++ < 5000) { var id = q.shift(), n = T.N[id]; if (!n) continue; if (n.n === b && n.lv !== 3) return n; if (n.ch) q = q.concat(n.ch); }
    }
    return null;
  }
  function evRow(key, nameHtml, mi, asd, dep, c, op, R) {
    var st = (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + (dep ? '--dep:' + dep + ';' : '');
    return '<button type="button" class="drow erow' + (c ? ' dc' : '') + (dep ? ' sub' : '') + (op ? ' open' : '') + '" data-eo="' + esc(key) + '" aria-expanded="' + op + '"' + (st ? ' style="' + st + '"' : '') + ' title="押すと、すぐ下に中が開きます（もう一度押すと閉じる）">' +
      '<span class="n"><span class="ar">' + (op ? '▼' : '▶') + '</span><span>' + nameHtml + '</span></span>' +
      '<span class="pct ' + (mi ? cls((mi.v - 1) * 100) : '') + '">' + (mi ? num(mi.v, 2) + '倍' : '―') + '</span>' + (mi ? divBar(mi.v, 1, R, NaN) : '<span class="bar" aria-hidden="true"></span>') + '<span class="val">' + esc(aside(asd)) + '</span></button>';
  }
  function kbRows(e, g, T, R, dep, O) {
    var c = deptCol(YDEPT[g.k] || g.k);
    return g.list.map(function (o) {
      // 区分の名前＝辞書の部門の名前（農産・グロッサリー など）なら、その部門の POS の部門（まとめて）。ほかは同じ名前の自店の分類（「食品」＝一般食品）。当たらなければ「―」
      var d = o.d, key = e.id + '|' + g.k + '|' + o.i, op = !!O[key], base = String(d.dept || '').replace(/（.*$/, ''), roots = T ? posNodes(T, g.k) : [];
      var nd = T ? (base === g.k ? (roots.length === 1 ? roots[0] : null) : kbNode(T, g.k, KB_ALIAS[base] || base)) : null;
      var mi = nd ? midx(nd, e.month, T) : (T && base === g.k ? midxSum(roots, e.month, T) : null);
      var nm = esc(d.dept) + (d.area && d.area !== '両エリア' ? ' <small>' + esc(d.area) + '</small>' : '');
      return evRow(key, nm, mi, '売場の型 ' + (d.corners || []).length + '・計画 ' + (d.plans || []).length, dep, c, op, R) + (op ? evLeaf(e, g.k, d, nd, T, dep + 1, !!mi) : '');
    }).join('');
  }
  /** 区分のいちばん下: 予定・注意点・変わった所・売場の型・計画（長い文は2行で切って「続き」）・自店のその週の 52週MD・その部門のカード */
  var KB_ALIAS = { '食品': '一般食品' };   // 辞書の区分の名前 → POS の分類の名前（はっきり同じ物だけ。ほかは「―」のまま・作らない）
  function evLeaf(e, k, d, nd, T, dep, matched) {
    var c = deptCol(YDEPT[k] || k), st = (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + '--dep:' + dep;
    var sec = function (t, body) { return body ? '<div class="es"><b>' + esc(t) + '</b>' + body + '</div>' : ''; };
    var para = function (s) { s = String(s || ''); if (!s) return ''; var lg = s.length > 90; return '<div class="ct' + (lg ? ' cl' : '') + '"><p>' + esc(s) + '</p>' + (lg ? '<button type="button" class="more" data-more="1">続き ▸</button>' : '') + '</div>'; };
    var h = '<div class="eopen" style="' + st + '">' + sec('予定', para(d.schedule)) + sec('注意点', para(d.caution)) + sec('変わった所・反省', para(d.change));
    if ((d.corners || []).length) h += sec('売場の型（' + d.corners.length + '）', '<ul>' + d.corners.map(function (x) { return '<li><b>' + esc(x.name) + '</b>' + (x.items ? '<small>' + esc(x.items) + '</small>' : '') + para(x.how) + '</li>'; }).join('') + '</ul>');
    if ((d.plans || []).length) h += sec('計画（' + d.plans.length + '）', '<ul>' + d.plans.map(function (p) { return '<li><b>' + esc((p.size || '') + (p.theme ? '・' + p.theme : '')) + '</b>' + para(p.body) + '</li>'; }).join('') + '</ul>');
    var rows = nd && nd.m5 && nd.m5.rows ? nd.m5.rows.filter(function (r) {   // 自店の 52週MD（去年のその催事の前後の週＝当日の10日前〜3日後）
      var t = new Date(String(r[7] || '') + 'T00:00:00'); if (isNaN(t.getTime())) return false;
      var E = evDate(e, t.getFullYear()).getTime(); return t.getTime() >= E - 10 * DAY && t.getTime() <= E + 3 * DAY;
    }).slice(0, 6) : [];
    if (rows.length) h += sec('自店の 52週MD（' + esc(nd.n) + '・その催事の週）', table(['週', '区分', 'イチオシ品', '計画比（倍）', '結果'], rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td class="w">' + esc(r[2]) + '</td><td class="n"><b>' + num(r[3], 2) + '</b></td><td class="' + (r[6] === 'down' ? 'dn' : r[6] === 'up' ? 'up' : '') + '">' + esc({ up: '上回った', flat: '計画並み', down: '下回った' }[r[6]] || '') + '</td></tr>'; }).join(''), false));
    var cs = evCards(e).filter(function (x) { return x.dept === k; });
    if (cs.length) h += sec('判断カード（' + cs.length + '）', cs.map(kc1).join(''));
    if (T && !matched) h += '<p class="hint" style="margin:0">「' + esc(String(d.dept || '').replace(/（.*$/, '')) + '」に当たる自店の分類が無いので、数（月の指数）は出していません。</p>';
    return h + '</div>';
  }
  /** 催事の掘り下げの箱（凡例・目盛り・行）。only＝部門ごとで、その部門の区分だけ（部門の行を飛ばす） */
  function evDrill(e, T, only) {
    var O = {}; (S.eo || []).forEach(function (k) { O[k] = 1; });
    var gs = evGroups(e, only), R = T ? monR(T, e.month) : 0.5, out = '';
    if (only) gs.forEach(function (g) { out += kbRows(e, g, T, R, 0, O); });
    else gs.forEach(function (g) {
      var key = e.id + '|' + g.k, op = !!O[key], mi = T ? midxSum(posNodes(T, g.k), e.month, T) : null, nC = 0;
      g.list.forEach(function (o) { nC += (o.d.corners || []).length; });
      out += evRow(key, esc(g.k), mi, '区分 ' + g.list.length + '・売場の型 ' + nC, 0, deptCol(YDEPT[g.k] || g.k), op, R);
      if (op) out += kbRows(e, g, T, R, 1, O);
    });
    var lg = T ? '<span>主の数＝' + esc(T.N.S.n) + 'のその部門の、去年の' + e.month + '月の月の指数（1.0倍＝ふだんの月・催事の日ごとの数は無いので月で代わり）</span><span><i style="background:#5b8fd6"></i>ふだんの月より売れた</span><span><i style="background:#e07a6e"></i>少なかった</span><span>目盛りの端 ' + num(1 - R, 1) + '〜' + num(1 + R, 1) + '倍</span>'
      : '<span>数（自店の月の指数）は、店を開くと出ます（いまは辞書の型だけ）</span>';
    return '<div class="drill an edrill"><div class="lg">' + lg + asideLg(only ? '型の数' : '区分・型の数') + DC_LG + '</div>' + (T ? ruler(divTicks(R, 1, idxTick)) : '') + (out || '<div class="hint">この部門の型は、まだありません。</div>') + '</div>';
  }
  function lensEvent() {
    var now = new Date().getMonth() + 1, withD = DICT.events.filter(function (x) { return (x.depts || []).length; });
    var e = byId(DICT.events, S.ev) || withD.slice().sort(function (a, b) { return evDays(a) - evDays(b); })[0] || DICT.events[0];
    LAST.ev = e ? e.name : '';   // はじめは、これから来る催事のうち型のある物（いちばん近い物）
    var st = curStoreTop(), T = st && TREE ? TREE : null; if (st && !TREE) ensureTree();
    var cards = evCards(e), facts = evFacts(e), calls = evCalls(cards), gs = evGroups(e), nC = 0, days = evDays(e), nd = evNext(e);
    (e.depts || []).forEach(function (d) { nC += (d.corners || []).length; });
    var h = '<h1 class="vt" id="lvtop">催事ごと<small>' + DICT.events.length + 'の催事・部門ごとの展開の型' + (T ? '｜数は' + esc(st.n) + 'の月の指数（1年分だけの目安）' : '') + '</small></h1>' + evStrip(e.id);
    h += '<h2 class="sec" id="evhd">' + esc(e.name) + '<small>' + e.month + '月' + (e.day ? '・' + esc(e.day) : '') + evTag(e, now) + '</small></h2>';
    // 1. 札: いつ（あと何日）／型のある部門／判断カード／数字の事実
    var tl = [{ nm: 'いつ', v: esc(e.day || (e.month + '月')), vc: 'tx', sub2: (e.lead ? '準備 ' + e.lead + 'か月前から・' : '') + (days <= 0 ? 'いまがその時期' : 'あと ' + days + '日（' + (nd.getMonth() + 1) + '/' + nd.getDate() + ' ごろ）') },
      { nm: '型のある部門', u: '部門', v: gs.filter(function (g) { return g.k !== '（全体）'; }).length + '<small>部門</small>', sub2: '区分 ' + (e.depts || []).length + '・売場の型 ' + nC },
      { nm: '判断カード', u: '枚', v: cards.length + '<small>枚</small>', sub2: cards.length ? cards[0].title + (cards.length > 1 ? ' ほか' : '') : '印の付いたカードはまだありません' },
      { nm: '数字の事実', v: facts.length ? esc(fval(facts[0])) : '―', vc: 'tx', sub2: facts.length ? facts[0].metric + (facts.length > 1 ? '（ほか ' + (facts.length - 1) + '件）' : '') : 'この催事の数字の事実は、まだありません' }];
    var eTl = '<div class="tiles t4 etiles">' + tl.map(tile).join('') + '</div>', eAi = '', eDig = '';
    if (e.note) eTl += '<p class="evnote">' + esc(e.note) + '</p>';
    // 2. 図: 準備から当日までの帯の上にカード（札・図 → AI のコメント → 次の一手 までが概要）
    eTl += evBand(e, cards);
    // 3. AI のコメント → 次の一手（いちばん近い時期のカード）
    eAi += evAi(e, cards, facts, calls);
    var nx = evNextCard(e, cards);
    eAi += '<div class="nx"><b>次の一手</b>: ' + (nx ? '<button type="button" data-card="' + esc(nx.c.id) + '">' + esc(nx.c.title) + ' ▸</button>（' + esc(cardWhen(nx.c, e)) + '・' + (nx.act ? 'いまがその時期' : 'あと ' + Math.ceil(nx.k / DAY) + '日で始まる') + (nx.c.dept ? '・' + esc(nx.c.dept) : '') + '）' : 'この催事に印の付いた判断カードはまだありません。下の掘り下げで、部門ごとの予定と注意点を見てください。') + '</div>';
    // 4. 掘る（部門 → 区分 → 売場の型・計画・注意点・反省・カード）。行を押したときは、この塊だけを描き直す
    if (gs.length) eDig += blk('blk-edig', function () { return '<h2 class="sec" id="dig">掘り下げる — 部門 → 区分 → 売場の型・計画・注意点</h2>' + evDrill(e, T, '') + '<div class="hint">行を押すと、すぐ下にその中が開きます（もう一度押すと閉じる）。区分を押すと、予定・注意点・変わった所・売場の型・計画（長い文は「続き」で全文）と、その部門の判断カードが開きます。</div>'; });
    else eDig += '<h2 class="sec" id="dig">掘り下げる</h2><div class="box"><p style="margin:0">この催事は、部門ごとの型がまだありません（資料に催事固有の指示が無いため）。今月の型と判断カードを見てください。</p></div>';   // 空の表は出さない
    h += duo(eTl, eAi, eDig);
    // 5. くわしく（はじめ閉じる）: 部門ごとの表・展開の型の表
    var rows = (e.depts || []).map(function (d) { return '<tr><td>' + esc(d.dept6 || d.dept) + '</td><td>' + esc(d.area || '') + '</td><td class="w">' + esc(d.schedule || '―') + '</td><td class="w">' + esc(d.caution || '―') + '</td><td class="w">' + esc(d.change || '―') + '</td></tr>'; }).join('');
    var cn = []; (e.depts || []).forEach(function (d) { (d.corners || []).forEach(function (c) { cn.push('<tr><td>' + esc(d.dept6 || d.dept) + '</td><td>' + esc(c.name) + '</td><td class="w">' + esc(c.items || '') + '</td><td class="w">' + esc(c.how || '') + '</td></tr>'); }); });
    if (rows) h += lazyBox('d-evt', 'くわしく（部門ごとの予定・注意点・変わった所の表）', function () { return '<div class="box">' + table(['部門', 'エリア', '予定', '注意点', '変わった所・反省'], rows, (e.depts || []).length > 6) + '</div>'; });   // 閉じた箱の中身は、開いたときに描く（開く速さ）
    if (cn.length) h += lazyBox('d-evc', '展開の型（売場ごと・' + cn.length + '）', function () { return table(['部門', '売場', '品', '展開の仕方'], cn.join(''), cn.length > 10); });
    h += '<p class="hint">広告の実績から抜き出した候補（本部の確かめの前）は、店の画面には出しません。</p>';
    return h;
  }
  /** 年間の流れ（PO 11/17「カレンダーが壊れている」→ 選んだ案: 催事1つを1行の帯に）。12か月の帯（点線＝準備・予約が動く月・塗り＝当日の月・今月の列に色）。
   *  行を押すと、すぐ下にその催事のひとこと・判断カード・部門 → 区分 → 型が開く（往復 0・開いた行＝S.yo・中の行＝S.eo・催事ごとと同じ部品）。前の図は線が箱を貫き、年をまたぐ準備（正月）を描いていなかった */
  function yearRow(e, now, op, attrs, tip) {
    var W = 100 / 12, nm = function (i) { return ((i % 12) + 12) % 12; }, m0 = e.month - 1, s0 = m0 - (e.lead || 0), segs = [];
    if (e.lead) { if (s0 >= 0) segs.push([s0 * W, (m0 - s0) * W]); else { segs.push([nm(s0) * W, 100 - nm(s0) * W]); if (m0 > 0) segs.push([0, m0 * W]); } }   // 年をまたぐ準備（正月・年始＝11月から）は、右の端と左の端の2本
    var prep = segs.map(function (g) { return '<i class="pr" style="left:' + g[0].toFixed(2) + '%;width:' + g[1].toFixed(2) + '%"></i>'; }).join('');
    var day = '<i class="ed" style="left:' + (m0 * W + 0.6).toFixed(2) + '%;width:' + (W - 1.2).toFixed(2) + '%"></i>';
    return '<button type="button" class="drow yrow' + (op ? ' open' : '') + '"' + attrs + ' aria-expanded="' + op + '" title="' + esc(tip) + '">' +
      '<span class="n"><span class="ar">' + (op ? '▼' : '▶') + '</span><span>' + esc(e.name) + '</span>' + evTag(e, now) + '</span>' +
      '<span class="pct">' + e.month + '月</span><span class="bar yr12" aria-hidden="true">' + prep + day + '</span>' +
      '<span class="val">' + esc(aside((e.day || '') + (e.lead ? '・準備 ' + e.lead + 'か月前から' : ''))) + '</span></button>';
  }
  function yearLg(now) { return '<div class="lg"><span><i style="background:#1f4f8f"></i>当日の月</span><span><i class="lgpr"></i>準備・予約が動く月</span><span><i style="background:#dbe8fb"></i>いまの月（' + now + '月）</span>' + asideLg('日付・準備の始まり') + '</div>'; }
  function yearTicks() { var tk = []; for (var i = 0; i < 12; i++) tk.push([(i + 0.5) * 100 / 12, (i + 1) + '月']); return ruler(tk).replace('drow leaf ruler', 'drow leaf ruler yrr'); }
  function lensYear() {
    var now = new Date().getMonth() + 1;
    var body = function () {
      var O = {}; (S.yo || []).forEach(function (id) { O[id] = 1; });
      var evs = DICT.events.slice().sort(function (a, b) { return a.month - b.month; });
      return '<div class="drill yr" style="--now:' + ((now - 1) * 100 / 12).toFixed(3) + '%">' + yearLg(now) + yearTicks() +
        evs.map(function (e) { var op = !!O[e.id]; return yearRow(e, now, op, ' data-yev="' + esc(e.id) + '"', '押すと、すぐ下に' + e.name + 'の判断カードと、部門 → 区分 → 売場の型・計画・注意点が開きます（もう一度押すと閉じます）') + (op ? yearOpen(e) : ''); }).join('') + '</div>';
    };
    return '<h1 class="vt" id="lvtop">年間の流れ<small>' + DICT.events.length + 'の催事</small></h1>' + blk('blk-year', body) +
      '<div class="hint">催事の行を押すと、すぐ下にその催事の判断カードと、部門 → 区分 → 売場の型・計画・注意点が開きます（もう一度押すと閉じる）。全文は「催事ごとで大きく見る」で。</div>';
  }
  var YDEPT = { '農産': '青果', '畜産': '精肉', '水産': '水産', '惣菜': '惣菜', '日配': '日配', 'グロッサリー': '一般食品' };   // 辞書の6部門 → 部門の色（POS の部門の名前）
  function cut1(s, n) { s = String(s || '').split('。')[0]; return s.length > n ? s.slice(0, n) + '…' : s + (s ? '。' : ''); }
  /** 年間の流れの行の中（押した行のすぐ下）: ひとこと → 判断カード（その催事の印・いつ）→ 部門 → 区分 → 型（催事ごとと同じ部品）→ 大きく見る */
  function yearOpen(e) {
    var cards = evCards(e), st = curStoreTop(), T = st && TREE ? TREE : null;
    var h = '<div class="yopen">' + (e.note ? '<p class="ynote">' + esc(e.note) + '</p>' : '');
    if (cards.length) h += '<div class="ycards"><b>判断カード（' + cards.length + '）</b>' + cards.map(kc1).join('') + '</div>';
    if ((e.depts || []).length) h += '<div class="ydepts"><b>部門 → 区分 → 売場の型・計画・注意点（押すと、すぐ下に開きます）</b>' + evDrill(e, T, '') + '</div>';
    else h += '<p class="hint" style="margin:4px 0">この催事は、部門ごとの型がまだありません（資料に催事固有の指示が無いため）。</p>';
    return h + '<div class="dopen" style="--dep:1;padding-left:0;background:none;box-shadow:none;border:0"><button type="button" data-ev="' + esc(e.id) + '">' + esc(e.name) + 'を催事ごとで大きく見る（札・カードの時期・全文の表）▸</button></div></div>';
  }
  var DEPT6 = ['農産', '畜産', '水産', '惣菜', '日配', 'グロッサリー'];   // ヒッスルの部門の並び（PO 11/16「部門の並び順はヒッスルを基準に統一」）
  var DEPT_MAP = { '農産': ['青果', '農産', '野菜', '果物'], '水産': ['鮮魚', '水産', '塩干'], '畜産': ['精肉', '畜産', '肉'], '惣菜': ['惣菜'], '日配': ['日配'], 'グロッサリー': ['一般食品', '菓子', '酒', 'グロッサリー', '日用', '日雑'] };
  /** 部門ごとの「その部門の1年」: 月の形（自店）＋その部門に型のある催事の帯（今から近い順）。催事の行を押すと、すぐ下にその部門の区分 → 型 */
  function deptYear(pos, d6, n) {
    var now = new Date().getMonth() + 1, T = n && TREE ? TREE : null, O = {}; (S.eo || []).forEach(function (k) { O[k] = 1; });
    var evs = d6 ? DICT.events.filter(function (e) { return (e.depts || []).some(function (x) { return x.dept6 === d6; }); }) : [];
    evs.sort(function (a, b) { return evDays(a) - evDays(b); });
    var shape = '', mi = T ? midx(n, now, T) : null;
    if (mi) {
      var v12 = cal12(mi), mt = 0.1, pk, lo, c = deptCol(pos); v12.forEach(function (v) { if (isFinite(v)) mt = Math.max(mt, Math.abs(v - 1)); }); mt = Math.min(mt, 0.6); pk = maxAt(v12); lo = minAt(v12);
      shape = '<div class="drow leaf mshape' + (c ? ' dc' : '') + '"' + (c ? ' style="--dbg:' + c[0] + ';--dac:' + c[1] + '"' : '') + '><span class="n"><span class="ar">・</span><span>' + esc(pos) + 'の月の形</span></span><span class="pct">山 ' + (pk + 1) + '月</span><span class="bar tmb m12b" aria-hidden="true">' + mon12Svg(v12, now, mt) + '</span><span class="val">' + esc(aside('谷 ' + (lo + 1) + '月・棒の端 ±' + Math.round(mt * 100) + '%')) + '</span></div>';
    }
    var rows = evs.map(function (e) {
      var key = 'D|' + e.id, op = !!O[key];
      return yearRow(e, now, op, ' data-eo="' + esc(key) + '"', '押すと、すぐ下に' + e.name + 'の' + d6 + 'の区分 → 売場の型・計画・注意点が開きます（もう一度押すと閉じます）') +
        (op ? '<div class="yopen">' + evDrill(e, T, d6) + '<div class="dopen" style="--dep:1;padding-left:0;background:none;box-shadow:none;border:0"><button type="button" data-ev="' + esc(e.id) + '">' + esc(e.name) + 'を催事ごとで大きく見る ▸</button></div></div>' : '');
    }).join('');
    return '<h2 class="sec" id="dyear">' + esc(pos) + 'の1年 — 月の形と催事' + (d6 ? '<small>催事の行を押すと、すぐ下に' + esc(d6) + 'の区分 → 売場の型・計画・注意点が開きます（今から近い順）</small>' : '') + '</h2>' +
      '<div class="drill yr" style="--now:' + ((now - 1) * 100 / 12).toFixed(3) + '%">' + yearLg(now) + yearTicks() + shape + (rows || '<div class="hint">この部門に型のある催事は、まだありません。</div>') + '</div>' +
      (mi ? '<div class="hint">月の形＝' + esc(pos) + 'の月ごとの1日あたり売上 ÷ 12か月の平均（' + esc(T.N.S.n) + '・1年分だけの目安・線から上＝ふだんの月より多い）。</div>' : '');
  }
  /** 本部だけ: この部門の店ごとの違い（地図の 店 × 部門 の数・往復 0）。店の行を押すと、その店のその部門が開く */
  //   店を開いていないとき（本部）は、全社のその部門の分析の札・AI のコメントも、地図の数で（top）。地図は窓口が本部・管理者にだけ返す（店のアカウントには ME.map が無い）
  function deptStores(pos) {
    var M = ME.map, dl = (M.dl || []).filter(function (x) { return x.n === pos; })[0]; if (!dl) return { top: '', body: '' };
    var d = dl.id, lvn = { lv: 1 }, mn = function (k) { return mname(k, lvn); }, stores = [];
    M.areas.forEach(function (a) { a.stores.forEach(function (s) { stores.push(s); }); });
    var has = stores.filter(function (s) { return !!mapPick(s, d); });
    var rows = stores.map(function (s) { var x = mapPick(s, d); return { s: s, x: x, v: mapLens(x, S.an, S.m) }; });
    var cmp = mapCompare(M, d, pos, S.m, mn, stores, rows, 'dstx'), t = mapText(M, d, pos, S.m, mn, stores, rows);
    var top = '<h2 class="sec" id="ancards">全社の' + esc(pos) + 'の分析の結果<small>札を押すと、AI のコメントと店ごとの違いが、その分析に替わります（地図の数）</small></h2><div class="tiles an6">' + mapTiles(M, d, S.m, mn, stores, has).map(tile).join('') + '</div>' +
      (t ? aiHtml('AI のコメント（' + AN[S.an] + '・全社の' + pos + '）', t.r, t.y, t.s) : '');
    return { top: top, body: '<h2 class="sec" id="dstores">店ごとの違い — ' + esc(pos) + 'の' + esc(AN[S.an]) + '（本部だけ）<small>上の分析の札で、見る分析が替わります</small></h2>' + cmp.top + cmp.body };
  }
  function lensDept() {
    var st = curStoreTop(), all = st ? N() : null, hq = ME && (ME.role === 'hq' || ME.role === 'admin');
    var opts = st ? kids(st).reduce(function (o, x) { o.push({ id: x.id, n: x.n.n }); if (x.n.alt && all[x.n.alt]) o.push({ id: x.n.alt, n: all[x.n.alt].n }); return o; }, []) : DEPT_ORDER.map(function (nm) { return { id: '', n: nm }; });
    if (!opts.length) opts = DEPT_ORDER.map(function (nm) { return { id: '', n: nm }; });
    var cur = opts.filter(function (o) { return o.n === S.dept; })[0] || opts[0], pos = cur.n, d6 = POS2DICT[deptBase(pos)] || '', n = st && cur.id ? all[cur.id] : null;
    LAST.dept = pos;
    var h = '<h1 class="vt" id="lvtop">部門ごと<small>' + (st ? esc(st.n) + '｜' : '') + 'POS の8部門' + (d6 ? '｜型とカードは辞書の「' + esc(d6) + '」から' : '') + '</small></h1>';
    h += '<div class="ctl"><div class="dsel" role="group" aria-label="部門"><span class="lb">部門</span>' + opts.map(function (o) { var c = deptCol(o.n); return '<button type="button" data-pdept="' + esc(o.n) + '" aria-pressed="' + (o.n === pos) + '"' + (c ? ' style="--dbg:' + c[0] + ';--dac:' + c[1] + '"' : '') + '>' + (c ? '<i aria-hidden="true"></i>' : '') + esc(o.n) + '</button>'; }).join('') + '</div>' + (n || (hq && ME.map) ? metricBar(n || { lv: 1 }) : '') + '</div>';
    // 1. その部門の札（いまの様子と同じ分析の札6枚）→ AI のコメント
    var dh = hq && ME.map ? deptStores(pos) : null, aiH = n ? (S.an === 'yo' ? aiBox(n) : anBox(n)) : '';
    var dTl = '', dAi = '', dDig = '';
    if (n) { dTl += tiles(n); dAi += aiH; }
    else dTl += (dh ? dh.top : '') + '<div class="hint">' + (hq ? '全店のいまで店を開くと、その店の' + esc(pos) + 'の札・AI のコメント・中分類 → クラスの掘り下げが、ここに出ます。いまは全社の' + esc(pos) + '（地図の数）・辞書の型・店ごとの違い（本部だけ）を出しています。' : 'このアカウントには店が結ばれていないので、辞書の部分だけを出しています。') + '</div>';
    // 2. 次の一手（その部門の判断カード）。カードが無い部門は作文で埋めない。AI のコメントに次の一手がある分析（前年比）では、カードは「あわせて見る」
    var cs = d6 ? DICT.cards.filter(function (c) { return c.dept === d6; }) : [];
    dAi += '<div class="nx"><b>' + (aiH.indexOf('class="nx"') >= 0 ? 'あわせて見る' : '次の一手') + '</b>（' + esc(d6 || pos) + 'の判断カード・' + cs.length + '枚）' + (cs.length ? '<div class="nxl">' + cs.map(kc1).join('') + '</div>' : '<p style="margin:4px 0 0"><span class="tag gap">本部が書く欄</span> この部門のカードは、まだありません（作文では埋めません）。全部門のカードは下の「くわしく」に。</p>') + '</div>';
    // 3. 掘る（数）: 中分類 → 小分類 → クラス（この画面の中で・別の画面へ飛ばさない）
    if (n) dDig += blk('blk-dig', function () { return drill(n); });
    // 4. その部門の1年（月の形と催事）＝ 掘る（辞書）: 催事 → 区分 → 型・カード
    dDig += blk('blk-dyear', function () { return deptYear(pos, d6, n); });
    h += duo(dTl, dAi, dDig);
    // 5. 本部だけ: 店ごとの違い（地図の 店 × 部門 の数）
    if (dh) h += dh.body;
    var allc = DICT.cards.filter(function (c) { return !c.dept; });
    h += lazyBox('d-dcards', 'くわしく（全部門の判断カード・' + allc.length + '）', function () { return '<div class="cards">' + allc.map(cardBtn).join('') + '</div>'; });
    return h;
  }
  function cardBtn(c) { return '<button type="button" class="kc" data-card="' + esc(c.id) + '"><span class="kk">判断カード</span><span class="kt">' + esc(c.title) + '</span><span class="ks">いつ: ' + esc(c.when || '') + '<br>すること: ' + esc(c.do || '') + '</span></button>'; }
  /** 天気と売れ方のいちばん上（2026-11-15 PO「図解で直に見る場所・掘り下げが無い」）: 自店の雨の日 → 全店・エリアの効き → 店ごと（本部だけ）。押すと店のステータスで部門 → クラスへ */
  function ciRow(label, v, lo, hi, R, attrs, tag, sub) {
    var pos = function (x) { return 50 + Math.max(-R, Math.min(R, x)) / R * 50; }, p = pos(v);
    var b = v >= 0 ? '<i class="u" style="left:50%;width:' + (p - 50) + '%"></i>' : '<i class="d" style="left:' + p + '%;width:' + (50 - p) + '%"></i>';
    var ci = isFinite(lo) && isFinite(hi) ? '<span class="ci" style="left:' + pos(lo) + '%;width:' + Math.max(0.5, pos(hi) - pos(lo)) + '%"></span>' : '';
    var el = attrs ? 'button type="button"' : 'div';
    return '<' + el + ' class="drow' + (attrs ? '' : ' leaf') + '"' + (attrs || '') + '><span class="n"><span class="ar">' + (attrs ? '▶' : '・') + '</span><span>' + esc(label) + '</span>' + (tag || '') + '</span><span class="pct ' + cls(v) + '">' + sg(v) + '%</span><span class="bar" aria-hidden="true"><span class="zl"></span>' + b + ci + '</span><span class="val">' + esc(aside(sub)) + '</span></' + (attrs ? 'button' : 'div') + '>';
  }
  function wxTop() {
    var W = DICT.weather || {}, hq = ME && (ME.role === 'hq' || ME.role === 'admin'), st = curStoreTop(), h = '', meH = '', allH = '';
    var evRows = []; (W.groups || []).forEach(function (g) { (g.rows || []).forEach(function (r) { if (r.ev && r.ev.areas && r.ev.areas.length) evRows.push(r); }); });
    // ① 自店（店の人・本部が店を開いているとき）: 来客数で、雨と強い雨。物差しは同じ型の店の中央
    if (st && st.wxs && st.wxs.c) {
      var C = st.wxs.c, vals = [0, 1].map(function (i) { return C[i] && isFinite(C[i][0]) ? C[i][0] : NaN; }), mk = nc() ? null : [0, 1].map(function (i) { return C[i] ? (isFinite(C[i][1]) ? C[i][1] : C[i][2]) : NaN; });
      meH += '<div class="box wxme"><h3>' + esc(meta().st.nm) + 'の雨の日（来客数・ふだんの同じ曜日との差）</h3>' + bars(vals, ['雨（10mm〜）', '強い雨（30mm〜）'], { base: 0, fmt: function (x) { return sg(x) + '%'; }, mark: mk, markName: '同じ型の店の中央（無いときはエリアの中央）', barName: 'この店', unit: '%', title: '自店の雨の日の効き' }) +
        '<p class="hint">' + (mk ? '紫の点線＝同じ型の店の中央。' : esc(NC_NOTE)) + 'どの部門・クラスで減るかは、下のボタンで掘り下げて見られます。</p>' +
        '<div class="nx"><button type="button" data-anhome="wx">' + esc(meta().st.nm) + 'の雨の日の効きを、部門 → 中分類 → クラスまで見る ▸</button></div></div>';
    } else if (ME && ME.role === 'store') meH += '<div class="box"><p style="margin:0">' + esc((CUR && DATA[CUR] && DATA[CUR].none) || 'この店の雨の日の数を読み込んでいます…') + '</p></div>';
    // ② 全店・エリアの効き（同じ0の線・細い線＝確からしい幅）
    if (evRows.length) {
      var R = 5; evRows.forEach(function (r) { r.ev.areas.forEach(function (a) { R = Math.max(R, Math.abs(a.v), isFinite(a.lo) ? Math.abs(a.lo) : 0); }); }); R = Math.min(40, Math.ceil(R / 5) * 5);
      allH += '<h2 class="sec" id="wxall">天気で来客数がどう動くか — 全店とエリア</h2><div class="drill an"><div class="lg"><span>その天気の日の来客数（同じ店・同じ曜日・同じ月のふだんとの差）</span><span><i style="background:#e07a6e"></i>減る</span><span><i style="background:#5b8fd6"></i>増える</span><span><i style="background:#1f2933;height:2px;vertical-align:3px"></i>確からしい幅</span><span>目盛りの端 ±' + R + '%</span>' + asideLg('確からしさ') + '</div>' +
        evRows.map(function (r) { return '<div class="grp">' + esc(r.what) + '｜' + esc(r.hitokoto || '') + '</div>' + r.ev.areas.map(function (a) { return ciRow(a.label, a.v, a.lo, a.hi, R, '', '', '確か ' + (a.sure || '―')); }).join(''); }).join('') + '</div>';
    }
    // 幅のある PC（1480〜）: 自店の雨の日（左）と、全店・エリアの効き（右）を並べる（PO 11/17e「図を左右に」）
    h += meH && allH ? '<div class="wxtop"><div class="wx-me">' + meH + '</div><div class="wx-all">' + allH + '</div></div>' : meH + allH;
    // ③ 店ごと（本部だけ・店の人にはほかの店の名前と数を出さない）
    if (hq && W32) h += blk('blk-w32', w32Block);   // 行を押す・雨の強さ・見る数を替えるときは、この塊だけを描き直す
    else if (hq) {
      w32Load();
      var code = {}; ((ME.map && ME.map.areas) || []).forEach(function (a) { a.stores.forEach(function (s) { code[s.nm] = s; code[String(s.nm).replace(/店$/, '')] = s; }); });
      var pick = evRows.filter(function (r) { return r.ev.stores && r.ev.stores.length; }), cur = pick[S.wl === 1 ? 0 : 1] || pick[0];
      if (cur) {
        var ss = cur.ev.stores.slice().sort(function (a, b) { return a.v - b.v; }), Rs = 10; ss.forEach(function (s) { Rs = Math.max(Rs, Math.abs(s.v), isFinite(s.lo) ? Math.abs(s.lo) : 0); }); Rs = Math.min(50, Math.ceil(Rs / 5) * 5);
        h += '<h2 class="sec" id="wxstores">店ごとの違い — ' + esc(cur.what) + '（本部だけ）</h2>' +
          '<div class="wlsw" role="group" aria-label="雨の強さ">' + pick.map(function (r) { var i = /強い/.test(r.what) ? 1 : 0; return '<button type="button" data-wl="' + i + '" aria-pressed="' + (r === cur) + '">' + esc(r.what) + '</button>'; }).join('') + '</div>' +
          '<div class="drill an"><div class="lg"><span>店ごとの来客数の差（減る順）</span><span><i style="background:#1f2933;height:2px;vertical-align:3px"></i>確からしい幅</span><span>目盛りの端 ±' + Rs + '%</span>' + asideLg('エリア・雨の日の数') + '</div>' +
          ss.map(function (s) { var m = code[s.name] || code[s.name + '店']; return ciRow(s.name, s.v, s.lo, s.hi, Rs, m ? ' data-wxstore="' + esc(m.c) + '" title="押すと、' + esc(m.nm) + 'の雨の日の効きを部門・クラスまで見られます"' : '', m && m.nc ? ' <small class="nctag">比べない</small>' : '', (s.area || '') + (s.days ? '・' + s.days + '日' : '')); }).join('') + '</div>' +
          '<div class="hint">店を押すと、その店のステータスが「雨の日の効き」で開き、部門 → 中分類 → クラスへ掘れます。' + (cur.ev.stores_note ? esc(cur.ev.stores_note) : '') + '</div>' +
          (W32_ERR ? '<div class="hint">店の中（部門 → クラス）の数を受け取れませんでした（' + esc(W32_ERR) + '）。<button type="button" class="hbtn" data-w32retry="1">もう一度受け取る</button>　' + extA('reports/#/WEATHER/w-s3b', '分析レポートの 3-2 で見る（新しいタブ）') + '</div>'
            : '<div class="hint wait"><span class="spin" aria-hidden="true"></span>店の中（部門 → 中分類 → クラス）の数を受け取っています…（数秒・届いたら、この一覧が押して開ける形に替わります）</div>');
      }
    }
    if (hq) {
      h += '<div class="box"><h3>図とグラフで全部見る（分析レポート「売れ方・ロス・天気の分析」・本部だけ・新しいタブで開きます）</h3><div class="chips">' +
        [['w-s1', '結論'], ['w-s3', '天気と来客数'], ['w-s3b', '店ごとの違い'], ['w-s3c', '部門ごとの店の並び'], ['w-s4', '部門ごとの買い方'], ['w-s4c', '雨の日に減る小分類'], ['w-s6', '時間帯と雨'], ['w-s6c', '天気と売れ残り']].map(function (x) { return extA('reports/#/WEATHER/' + x[0], esc(x[1]), 'chip'); }).join('') + '</div></div>';
    }
    return h;
  }
  function lensWx() {
    var W = DICT.weather || {}, h = '<h1 class="vt" id="lvtop">天気と売れ方<small>' + esc(W.period || '') + '</small></h1>';
    var st = curStoreTop();
    h += wxTop();   // 自店の雨の日の図 → 全店・エリア → 店ごと（本部だけ）→ 分析レポートの章
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
  var ADMIN = null;
  function safeHtml(s) { return String(s).replace(/<\/?(script|iframe|object|embed|link|meta|style)\b[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ''); }
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
  // ── 天気と売れ方の「店ごとの違い」（PO 11/17「ドリルダウン型で深掘りできるのは、この画面で直ぐにできないと不便。いちいち詳細深堀りでは面倒」「読み込みせずとも見られるように」）
  // 数は分析レポート「売れ方・ロス・天気の分析」の 3-2 と同じ物（同じファイルの中の図のデータ＝script.tdata・script.tdeep）。窓口は分析レポートの口（本部・管理者だけ・アプリの札で通る）。
  // 本部が入ったら裏で1回だけ受け取って解いておく（往復2本・約 0.8MB）→ 店・部門・中分類・小分類・クラスは、押したらすぐ開く（往復 0）
  // 行＝[段, 親の番号, 名前の番号, 印〔4＝開ける〕, 値の組 g＝0〜3 を4つずつ〔左×10, 左の確かさ, 右×10, 右の確かさ〕, …]。g＝雨の強さ×2＋指標（0 売上・1 来客数）
  //   店の行の後ろ（c.XO から）＝[店コード, エリア〔0 北関東・1 首都圏〕, 値の組ごとの左の値の95%の幅の下×10・上×10]
  var W32 = null, W32_P = null, W32_ERR = '', W32_LABEL = '';
  function w32FromHtml(html) {
    var a = /<script type="application\/json" class="tdata">([\s\S]*?)<\/script>/.exec(html), b = /<script type="text\/plain" class="tdeep">([\s\S]*?)<\/script>/.exec(html);
    if (!a || !b) return Promise.reject(new Error('レポートの中に 3-2 の図のデータがありません'));
    var j = JSON.parse(a[1].replace(/<\\\//g, '</'));
    // 図のデータの形（V11・V12 の形）を確かめる。違う形のレポートが置かれたら、描かずに「受け取れませんでした」へ（これまでの店の一覧が出る）
    var c0 = j && j.c;
    if (!c0 || typeof c0.XO !== 'number' || !Array.isArray(c0.S) || c0.S.length < 2 || !Array.isArray(c0.RN) || c0.RN.length < 2 || !Array.isArray(c0.AREA) || !Array.isArray(j.n) || !Array.isArray(j.r) || !j.r.length || j.r[0].length < c0.XO + 2)
      return Promise.reject(new Error('レポートの 3-2 の図のデータの形が、この画面の知っている形と違います'));
    var d = { c: j.c, n: j.n.slice(), r: j.r.slice(), k: [], top: [], st: [] };
    var bin = atob(b[1].replace(/\s+/g, '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate'))).text().then(function (t) {
      var q = JSON.parse(t), n0 = d.n.length, c = q.c, p = 0;
      q.n.forEach(function (x) { d.n.push(x); });
      for (var i = 0; i < c[0].length; i++) { var x = new Array(c.length); for (var k = 0; k < c.length; k++) x[k] = c[k][i]; p += x[1]; x[1] = p; x[2] += n0; d.r.push(x); }   // 列ごとの並び → 行（親の番号は1つ前との差）
      for (var r = 0; r < d.r.length; r++) { d.k[r] = []; var pp = d.r[r][1]; if (pp >= 0) { d.k[pp].push(r); d.st[r] = d.st[pp]; } else { d.st[r] = r; d.top.push(r); } }
      return d;
    });
  }
  function w32Load() {
    if (W32 || W32_P || W32_ERR || !ME || !(ME.role === 'hq' || ME.role === 'admin')) return W32_P;
    if (!CAN_GZ || !(window.crypto && crypto.subtle) || typeof TextDecoder !== 'function') { W32_ERR = 'この端末のブラウザでは開けません'; return null; }
    var t0 = performance.now(), it = null;
    W32_P = AUTH.call('reportList').then(function (r) {
      it = r && r.ok && Array.isArray(r.reports) ? r.reports.filter(function (x) { return x && x.key === 'WEATHER' && /^[0-9a-f]{64}$/.test(x.sha256 || '') && x.parts > 0 && x.parts < 20; })[0] : null;
      if (!it) throw new Error((r && r.error) || '分析レポートの一覧に「売れ方・ロス・天気の分析」がありません');
      var ps = []; for (var n = 0; n < it.parts; n++) ps.push(AUTH.call('reportPart', { key: 'WEATHER', n: n, want: it.sha256, bg: true }));   // bg＝裏の受け取り（レポートを見た記録に数えない・窓口 11-17c）
      return Promise.all(ps);
    }).then(function (rs) {
      var bufs = rs.map(function (x, i) {
        if (!x || !x.ok || x.n !== i || x.sha256 !== it.sha256 || typeof x.data !== 'string') throw new Error((x && x.error) || '分析レポートを受け取れませんでした');
        var s = atob(x.data), u = new Uint8Array(s.length); for (var k = 0; k < s.length; k++) u[k] = s.charCodeAt(k); return u;
      });
      return new Response(new Blob(bufs).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }).then(function (ab) {
      return crypto.subtle.digest('SHA-256', ab).then(function (h) {
        var hx = Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        if (hx !== it.sha256) throw new Error('受け取ったレポートが元のファイルと違います');
        W32_LABEL = String(it.label || '') + (it.date ? '・' + it.date : '');
        return new TextDecoder('utf-8').decode(ab);
      });
    }).then(w32FromHtml).then(function (d) {
      d.ms = Math.round(performance.now() - t0); W32 = d; W32_P = null;
      window.__statusT = window.__statusT || {}; window.__statusT.w32 = d.ms;
      if (S.view === 'wx') render({ keep: true });
    }).catch(function (e) {
      W32_P = null; W32_ERR = String(e && e.message || e).slice(0, 120);
      if (S.view === 'wx') render({ keep: true });
    });
    return W32_P;
  }
  var W32_PRE = /^(Ａコープ|ＪＡＦ|JAF|Aコープ|新鮮ぐんま)\s*/;
  function w32Nm(d, i) { var nm = d.n[d.r[i][2]]; return d.r[i][0] === 0 ? String(nm).replace(W32_PRE, '').replace(/店$/, '') : nm; }
  function w32V(d, i, b) { var v = d.r[i][b]; return v === null || v === undefined ? null : v / 10; }
  // 確かさの段（レポートと同じ決まり）: 0＝塗り（95%以上）・1＝枠だけ（70〜95%・中分類の「95%未満」）・2＝点線の枠（70%未満）
  function w32Tier(k) { if (k === null || k === undefined) return 2; if (k > 100) return k === 101 ? 1 : 0; return k >= W32.c.LINE ? 0 : k >= W32.c.LOW ? 1 : 2; }
  function w32Cf(k) { return k === null || k === undefined ? '—' : k > 100 ? ['95%未満', '95〜99%', '99%以上'][k - 101] : k >= 99 ? '99%以上' : k + '%'; }
  function w32Cmp(d, b) { return function (x, y) { var p = d.r[x][b], q = d.r[y][b], np = p === null || p === undefined, nq = q === null || q === undefined; if (np !== nq) return np ? 1 : -1; if (!np && p !== q) return p - q; return x - y; }; }
  function w32Kids(d, i, b) { var k = d.k[i].slice(); if (k.length && d.r[k[0]][0] !== 1) k.sort(w32Cmp(d, b)); return k; }   // 部門は決めた順のまま・店と中分類より下は、減りの大きい順
  function w32Dept(d, i) { var x = i; while (x >= 0 && d.r[x][0] > 1) x = d.r[x][1]; return x >= 0 && d.r[x][0] === 1 ? d.n[d.r[x][2]] : null; }
  function w32Vis(d, b) {
    var O = {}, out = []; (S.wo || []).forEach(function (i) { O[i] = 1; });
    (function walk(list, dep) {
      list.forEach(function (i) {
        var can = !!(d.r[i][3] & 4) && d.k[i].length > 0, op = can && !!O[i];
        out.push({ i: i, dep: dep, can: can, open: op });
        if (op) { walk(w32Kids(d, i, b), dep + 1); if (dep === 0) out.push({ end: i }); }
      });
    })(d.top.slice().sort(w32Cmp(d, b)), 0);
    return out;
  }
  function w32Bar(v, R, ref, t, lo, hi) {
    var pos = function (x) { return 50 + Math.max(-R, Math.min(R, x)) / R * 50; }, p = pos(v), c = (v >= 0 ? 'u' : 'd') + (t ? ' t' + t : '');
    var b = v >= 0 ? '<i class="' + c + '" style="left:50%;width:' + (p - 50) + '%"></i>' : '<i class="' + c + '" style="left:' + p + '%;width:' + (50 - p) + '%"></i>';
    var cut = Math.abs(v) > R ? '<span class="cut ' + cls(v) + '" style="' + (v > 0 ? 'right:0' : 'left:0') + '">' + (v > 0 ? '›' : '‹') + '</span>' : '';
    var ci = lo !== null && hi !== null && isFinite(lo) && isFinite(hi) ? '<span class="ci" style="left:' + pos(lo) + '%;width:' + Math.max(0.5, pos(hi) - pos(lo)) + '%"></span>' : '';
    return '<span class="bar" aria-hidden="true"><span class="zl"></span>' + (ref !== null && isFinite(ref) ? '<span class="pl" style="left:' + pos(ref) + '%"></span>' : '') + b + cut + ci + '</span>';
  }
  function w32Row(d, x, g, R, known) {
    var i = x.i, r = d.r[i], lv = r[0], b = 4 + 4 * g, m = g & 1, X = d.c.XO;
    var l = w32V(d, i, b), rv = w32V(d, i, b + 2), ref = lv ? w32V(d, d.st[i], b) : null;
    var lo = lv === 0 ? w32V(d, i, X + 2 + 2 * g) : null, hi = lv === 0 ? w32V(d, i, X + 3 + 2 * g) : null;
    var dn = lv ? w32Dept(d, i) : null, c = dn ? deptCol(dn) : null, sty = (c ? '--dbg:' + c[0] + ';--dac:' + c[1] + ';' : '') + (x.dep ? '--dep:' + x.dep + ';' : '');
    var rl = lv === 0 ? (m ? '1人あたり点数' : '客単価') : (m ? '1人あたり点数' : '1人あたり売上');
    var s = lv === 0 ? known[String(r[X])] : null, tag = lv === 0 ? ' <small>' + esc(d.c.AREA[r[X + 1]] || '') + '</small>' + (s && s.nc ? ' <small class="nctag">比べない</small>' : '') : '';
    var pth = []; for (var k = i; k >= 0; k = d.r[k][1]) pth.unshift(d.n[d.r[k][2]]);
    var tip = pth.join(' ▸ ') + '｜' + d.c.RN[g >> 1] + 'の日｜' + (lv === 0 ? (m ? '来客 ' : '店全体の売上 ') : (m ? '買った人の数 ' : '売上 ')) + (l === null ? '—（数えていない）' : sg(l) + '%（確かさ ' + w32Cf(r[b + 1]) + '）') +
      '｜' + rl + ' ' + (rv === null ? '—' : sg(rv) + '%（確かさ ' + w32Cf(r[b + 3]) + '）') + (x.can ? '｜押すと、すぐ下に' + ['部門', '中分類', '小分類', 'クラス'][lv] + 'が開きます' : '');
    return '<button type="button" class="drow' + (x.can ? '' : ' leaf') + (c ? ' dc' : '') + (lv ? ' sub' : '') + (x.open ? ' open' : '') + '"' + (x.can ? ' data-w32="' + i + '" aria-expanded="' + x.open + '"' : '') + (sty ? ' style="' + sty + '"' : '') + ' title="' + esc(tip) + '">' +
      '<span class="n"><span class="ar">' + (x.can ? (x.open ? '▼' : '▶') : '・') + '</span><span>' + esc(w32Nm(d, i)) + '</span>' + tag + '</span>' +
      '<span class="pct ' + (l === null ? '' : cls(l)) + '">' + (l === null ? '—' : sg(l) + '%') + '</span>' +
      (l === null ? '<span class="bar" aria-hidden="true"></span>' : w32Bar(l, R, ref, w32Tier(r[b + 1]), lo, hi)) +
      '<span class="val">' + esc(rv === null ? '' : aside(rl + ' ' + sg(rv) + '%')) + '</span></button>';
  }
  /** 天気と売れ方の「店ごとの違い」（本部だけ）。雨の強さ（S.wl）×見る数（S.wm: 0 売上・1 来客数）。開いた行＝S.wo（行の番号） */
  function w32Block() {
    var d = W32, rain = S.wl === 1 ? 1 : 0, m = S.wm === 1 ? 1 : 0, g = rain * 2 + m, b = 4 + 4 * g, sc = d.c.S[rain], R = Math.max(-sc.lo, sc.hi);
    var known = {}; ((ME.map && ME.map.areas) || []).forEach(function (a) { a.stores.forEach(function (s) { known[String(s.c)] = s; }); });
    var rows = w32Vis(d, b).map(function (x) {
      if (x.end === undefined) return w32Row(d, x, g, R, known);
      var code = String(d.r[x.end][d.c.XO]), s = known[code];
      return s ? '<div class="dopen" style="--dep:1"><button type="button" data-wxstore="' + esc(code) + '">' + esc(s.nm) + 'のステータスを開く（前年比・ロス・広告なども）▸</button></div>' : '';
    }).join('');
    var rn = d.c.RN[rain], mn = m ? '来客数' : '売上';
    var sw = '<div class="w32sw"><span class="lb">雨の強さ</span><div class="wlsw" role="group" aria-label="雨の強さ">' + d.c.RN.map(function (t, i) { return '<button type="button" data-wl="' + i + '" aria-pressed="' + (rain === i) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<span class="lb">見る数</span><div class="wlsw" role="group" aria-label="見る数">' + ['売上', '来客数'].map(function (t, i) { return '<button type="button" data-wm="' + i + '" aria-pressed="' + (m === i) + '">' + t + '</button>'; }).join('') + '</div></div>';
    // 凡例は短い言葉で（スマホで1行に2〜3つ入るように・PO 11/17 の図の見やすさ）。細かい読み方は図の下の一文へ
    var lg = '<div class="lg"><span>' + esc(rn) + 'の日の' + mn + '（ふだんとの差・前年比ではない）</span>' +
      '<span><i style="background:#e07a6e"></i>減る</span><span><i style="background:#5b8fd6"></i>増える</span>' +
      '<span><i class="lgt"></i>はっきり（95%以上）</span><span><i class="lgt t1"></i>傾向（70〜95%）</span><span><i class="lgt t2"></i>たまたま（70%未満）</span>' +
      '<span><i style="border-left:2px dashed #7c3aed;width:0"></i>その店</span><span><i style="background:#1f2933;height:2px;vertical-align:3px"></i>店の95%の幅</span>' +
      '<span>端 ±' + R + '%</span>' + asideLg(m ? '1人あたり点数' : '1人あたり売上') + '</div>';
    return '<h2 class="sec" id="wxstores">店ごとの違い — ' + esc(rn) + 'の日の' + mn + '（本部だけ）</h2>' + sw + '<div class="drill an w32">' + lg + ruler(divTicks(R, 0, pctTick)) + rows + '</div>' +
      '<div class="hint">店の行を押すと、すぐ下に部門が開きます。部門 → 中分類 → 小分類 → クラスと、押すたびに細かく開きます（もう一度押すと閉じる）。' +
      '店の行は店全体の' + (m ? '来客数（（ ）は1人あたり点数）' : '売上（（ ）は客単価）') + '、部門より下は' + (m ? 'その分類を買った人の数' : 'その分類の売上') + 'です。棒の塗り・枠・点線は、数の確かさ（ふだんの揺れで説明できない確からしさ）。紫の点線は、その店の値です。行の地の色・左の帯は部門の印（増え減りの色ではありません）。' +
      '数は分析レポート「売れ方・ロス・天気の分析」' + (W32_LABEL ? '（' + esc(W32_LABEL) + '）' : '') + 'の 3-2 と同じです。' + extA('reports/#/WEATHER/w-s3b', 'レポートの 3-2 で見る（新しいタブ）') + '</div>';
  }
  function w32Toggle(i) {
    var d = W32; if (!d || !d.r[i] || !(d.r[i][3] & 4) || !d.k[i].length) return;
    var o = (S.wo || []).slice();
    if (o.indexOf(i) >= 0) o = o.filter(function (j) { if (j === i) return false; for (var x = d.r[j][1], n = 0; x >= 0 && n++ < 8; x = d.r[x][1]) if (x === i) return false; return true; });   // 閉じるときは、その中で開いていた行も閉じる
    else o.push(i);
    go({ wo: o }, { keep: true, part: 'blk-w32' });
  }
  // 本部が店を次々に開いても重くならないよう、端末に持つ店の木は新しい3店まで（古い店は、もう一度開いたときに受け取り直す・往復1本）
  //   本部の地図の店の比較で開いている店の木は捨てない（開いている行が待ちに戻らないように）
  var KEPT = [], KEEP_MAX = 3;
  function keepTree(code) {
    KEPT = KEPT.filter(function (c) { return c !== code; }).concat([code]);
    var open = {}; (S.mo || []).forEach(function (k) { open[String(k).split(':')[0]] = 1; });
    for (var i = 0; KEPT.length > KEEP_MAX && i < KEPT.length;) {
      var old = KEPT[i]; if (old === CUR || old === code || open[old]) { i++; continue; }
      KEPT.splice(i, 1); if (DATA[old] && DATA[old].tree) DATA[old] = { sum: DATA[old].sum === DATA[old].tree ? null : DATA[old].sum };
    }
  }
  /** 店の木を受け取る（往復1本・同じ店を2回頼まない）。いま開いている店（CUR）にも、本部の地図で開いた店にも使う。店の木の書き手はここだけ（DATA[店].tree） */
  var PEND = 0;
  function fetchTree(code) {
    if (!ME || !code) return null;
    var d = DATA[code] || (DATA[code] = {});
    if (d.tree || d.none) return null;
    if (d.p) return d.p;
    PEND++; d.err = '';
    d.p = AUTH.call('statusStore', CAN_GZ ? { code: code } : { code: code, plain: true }).then(function (r) {
      if (r && r.ok && r.gz) return unzipJson(r.gz).then(function (t) { r.tree = t; return r; });
      return r;
    }).then(function (r) {
      PEND--; d.p = null;
      if (r && r.ok && r.tree) { d.tree = r.tree; if (!d.sum) d.sum = r.tree; keepTree(code); }
      else if (r && r.nodata) d.none = r.error;
      else d.err = String((r && r.error) || 'うまく読み込めませんでした').slice(0, 80);
      treeArrived(code, r);
    }, function () { PEND--; d.p = null; d.err = '通信できませんでした'; treeArrived(code, null); });
    return d.p;
  }
  function treeArrived(code, r) {
    var d = DATA[code] || {};
    if (CUR === code) {
      TREE_P = null;
      if (d.tree || d.none) { useStore(code); render({ keep: true }); }
      else if (r) onFail(r); else toast('通信できませんでした。もう一度押してください。');
      return;
    }
    if (r && r.auth) { onFail(r); return; }
    if ((S.view === 'home' || S.view === 'status') && !CUR && (S.mo || []).indexOf(String(code)) >= 0) { if (!redraw('blk-mcmp')) render({ keep: true }); }   // 本部の地図で開いている店: 店の比較の塊だけを描き直す
  }
  function ensureTree() {
    if (TREE || TREE_P || !ME || !CUR) return TREE_P;
    TREE_P = fetchTree(CUR);
    return TREE_P;
  }
  /** 店を選ぶ（本部が全体の地図から）。その店の木が無ければ受け取る（往復1本・待ちの印）。店の人は、スマレコの名簿の所属の1店だけ */
  function pickStore(code, dep) {
    var path = dep ? ['S', dep] : ['S'];
    if (code === CUR && S.view === 'status' && S.path.join() === path.join()) return;
    pushHist();
    useStore(code); S.view = 'status'; S.path = path; S.open = [];
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
  var gl = 0, glT = 0, glStop = null;
  function glide(y) {
    // 前の滑りは、動き（rAF）も最後の着地（setTimeout）も止める（11/17d: 店を開いてすぐ「戻る」と、前の滑りの着地が後から来て、画面が飛んでいた）
    // 行き先は、いまのページで送れる所まで（戻った先のページが短いと、届かない所へ滑り続け、止まって見えたあとも引き戻していた）
    y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight)); cancelAnimationFrame(gl); clearTimeout(glT); if (glStop) glStop();
    var y0 = window.scrollY, d = y - y0, t0 = performance.now(), dur = Math.max(280, Math.min(650, Math.abs(d) * 0.6));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.visibilityState === 'hidden' || Math.abs(d) < 2) { glStop = null; window.scrollTo(0, y); return; }
    var stop = false; glStop = function () { stop = true; };
    // 着いたら、保険の着地（setTimeout）も消す（保険は rAF が止まったときだけ効く。着いたあとに人が送った位置を、保険が引き戻さない）
    function step(t) { if (stop) return; var k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, y0 + d * e); if (k < 1) gl = requestAnimationFrame(step); else { stop = true; glStop = null; clearTimeout(glT); } }
    gl = requestAnimationFrame(step);
    glT = setTimeout(function () { if (stop) return; stop = true; glStop = null; window.scrollTo(0, y); }, dur + 90);
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
      if (narrowNav() && $('#side').classList.contains('on') && !e.target.closest('#side') && !e.target.closest('#menubtn')) sideOpen(false);
      if (!e.target.closest('.res') && !e.target.closest('input')) $$('.res').forEach(function (x) { x.classList.remove('on'); });
      if (e.target === $('#dlg')) { closeDlg(); return; }
      if (e.target.closest('.guide2') && gdClick(e)) return;   // 利用ガイドの中（地図の箱・見たいこと・この画面へ）
      if (narrowNav() && e.target.closest('#sideapps a')) sideOpen(false);
      var b = e.target.closest('button,[role="button"]'); if (!b) return;
      var ds = b.dataset;
      if (ds.close) closeDlg();
      if (ds.hit != null) { useHit(+ds.hit); return; }
      if (ds.q) { var q1 = $('#q1'); q1.value = ds.q; q1.focus(); search(q1, $('#r1')); return; }
      if (ds.card) { openCard(ds.card); return; }
      if (ds.ev) { go({ view: 'event', ev: ds.ev, eo: S.eo || [] }, { top: true }); return; }   // 催事を選ぶ（選びの帯・年間の流れ・今月の型から）: いちばん上の札から見る
      if (ds.month) { go({ month: (((S.month || (new Date().getMonth() + 1)) - 1 + +ds.month) % 12 + 12) % 12 + 1 }, { keep: true }); return; }
      if (ds.pdept != null) { if (ds.pdept !== S.dept) go({ dept: ds.pdept, open: [] }, { keep: true }); return; }   // 部門ごと: POS の部門を選ぶ
      if (ds.more) { var ct = b.closest('.ct'); if (ct) { ct.classList.toggle('full'); b.textContent = ct.classList.contains('full') ? '閉じる ▴' : '続き ▸'; } return; }   // 長い文の「続き」（その場で全文・描き直さない）
      if (ds.slides) { showSlides(ds.slides.split(','), b); return; }
      if (ds.nav === 'back') { if (narrowNav()) sideOpen(false); return back(); }
      if (ds.nav === 'top') { if (narrowNav()) sideOpen(false); pushHist('scroll'); setBack(); glide(0); toast('↑ いちばん上へ'); return; }
      if (b.id === 'menubtn') { sideOpen(!$('#side').classList.contains('on')); return; }
      if (b.id === 'fromchip') { fromBack(); return; }
      if (b.id === 'guidebtn') { openGuide(); return; }
      if (ds.sx) { if (narrowNav()) sideOpen(false); sideGo(ds.sx); return; }
      if (b.id === 'upbtn') { if (S.path.length > 1) go({ view: 'status', path: S.path.slice(0, -1) }, { land: true }); return; }
      if (b.id === 'acctbtn') { $('#acctmenu').classList.toggle('on'); return; }
      if (b.id === 'logout') { AUTH.logout(); return; }
      if (ds.lens) {   // 左のサイドの画面の木＝タブ（来た所の札は消す）。本文の中の「〇〇を開く」は、来た所の札を出す
        var inSide = !!b.closest('#side'); if (inSide && narrowNav()) sideOpen(false);
        if (ds.lens === 'guide') { openGuide(); return; }
        if (ds.lens === 'home') go({ view: 'home', path: ['S'] }, { top: true, nav: inSide ? 'tab' : '' }); else go({ view: ds.lens }, { top: true, nav: inSide ? 'tab' : '' }); return;
      }
      if (ds.view === 'home-map') { if (narrowNav()) sideOpen(false); pushHist(); useStore(''); S.view = 'home'; S.path = ['S']; S.open = []; render({ top: true }); return; }
      if (ds.view) { go({ view: ds.view }, { top: true }); return; }
      if (ds.store) { pickStore(ds.store, ds.sdep); return; }   // 本部の地図の店の札（部門を選んでいれば、その店のその部門へ）
      if (ds.mdp != null) { try { localStorage.setItem('storeops_mdp_v1', ds.mdp); } catch (e2) {} if (ds.mdp !== S.mdp) go({ mdp: ds.mdp }, { keep: true }); return; }   // 本部の地図の見る範囲（全社／部門）
      if (ds.crumb != null) { go({ view: 'status', path: S.path.slice(0, +ds.crumb + 1) }, { land: true }); return; }
      if (ds.anhome) { go({ view: 'status', path: ['S'], an: ds.anhome }, { top: true }); return; }   // 天気と売れ方 → 自店のステータスをその分析で
      if (ds.wxstore) { pushHist(); useStore(ds.wxstore); S.view = 'status'; S.path = ['S']; S.open = []; S.an = 'wx'; render({ top: true }); ensureTree(); return; }   // 本部: 店ごとの雨の効き → その店を雨の日の効きで
      if (ds.an) { go({ an: ds.an }, { keep: true }); return; }
      if (ds.wl != null) { go({ wl: +ds.wl }, { keep: true, part: S.view === 'wx' && W32 ? 'blk-w32' : '' }); return; }   // 天気と売れ方の店ごとの違いの中なら、その塊だけ
      if (ds.m) { go({ m: ds.m }, { keep: true }); return; }
      if (ds.tog) { toggleOpen(ds.tog); return; }   // 掘り下げの行: その場で開く・閉じる
      if (ds.w32 != null) { w32Toggle(+ds.w32); return; }   // 天気と売れ方の店ごとの違い: その場で開く・閉じる（往復 0）
      if (ds.wm != null) { go({ wm: +ds.wm }, { keep: true, part: S.view === 'wx' && W32 ? 'blk-w32' : '' }); return; }   // 同: 売上／来客数
      if (ds.w32retry) { W32_ERR = ''; w32Load(); render({ keep: true }); return; }
      if (ds.yev) { var yo = (S.yo || []).slice(), yi = yo.indexOf(ds.yev); if (yi >= 0) yo.splice(yi, 1); else yo.push(ds.yev); go({ yo: yo }, { keep: true, part: 'blk-year' }); return; }   // 年間の流れの行: すぐ下に開く（往復 0）
      if (ds.mtog) { var mk = ds.mtog, mo = S.mo || []; if (mo.indexOf(mk) >= 0) mo = moClose(mo, mk); else { mo = mo.concat([mk]); var dd0 = DATA[mk.split(':')[0]]; if (dd0 && dd0.err) dd0.err = ''; } go({ mo: mo }, { keep: true, part: 'blk-mcmp' }); return; }   // 本部の地図の店の比較: 店 → 部門 → 中分類 → クラスを、すぐ下に（店の比較の塊だけを描き直す）
      if (ds.mmo) { var mm = S.mmo || []; go({ mmo: mm.indexOf(ds.mmo) >= 0 ? treeClose(mm, ds.mmo) : mm.concat([ds.mmo]) }, { keep: true, part: 'blk-mdig' }); return; }   // 今月の型の掘り下げ
      if (ds.eo) { var eo = S.eo || [], ek = ds.eo, pre = (ek.indexOf('D|') === 0 ? ek.slice(2) : ek) + '|'; go({ eo: eo.indexOf(ek) >= 0 ? eo.filter(function (k) { return k !== ek && k.indexOf(pre) !== 0; }) : eo.concat([ek]) }, { keep: true, part: { event: 'blk-edig', year: 'blk-year', dept: 'blk-dyear' }[S.view] || '' }); return; }   // 催事の掘り下げ（閉じるときは、その中で開いていた行も閉じる）
      if (ds.c3rot != null) { var dr = +ds.c3rot; C3.yaw = dr ? Math.max(-80, Math.min(80, C3.yaw + dr)) : C3.YAW0; c3Redraw(); return; }   // 立体の棒を回す（図だけ描き直す・往復 0）
      if (ds.dsel) { if ((S.path.length > 1 ? S.path[1] : 'S') !== ds.dsel || S.path.length > 2) go({ view: 'status', path: ds.dsel === 'S' ? ['S'] : ['S', ds.dsel] }, { keep: true }); return; }   // 見る範囲（部門）: 分析の見方はそのまま、範囲だけ替える
      if (ds.drill) { drillTo(ds.drill); return; }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute && (t.getAttribute('role') === 'button' || (t.getAttribute('role') === 'link' && t.closest('.guide2')))) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }   // 図の中の催事（svg）にも効く
      if (e.key === 'Escape') { $('#acctmenu').classList.remove('on'); if (narrowNav()) sideOpen(false); closeDlg(); $$('.res').forEach(function (x) { x.classList.remove('on'); }); return; }
      if (t.id === 'q1') {
        var box = $('#r1'), items = $$('button[data-hit]', box), cur = items.findIndex(function (x) { return x.classList.contains('act'); });
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; var nx = e.key === 'ArrowDown' ? Math.min(items.length - 1, cur + 1) : Math.max(0, cur - 1); items.forEach(function (x, i) { x.classList.toggle('act', i === nx); }); items[nx].scrollIntoView({ block: 'nearest' }); }
        if (e.key === 'Enter') { e.preventDefault(); if (cur >= 0) useHit(+items[cur].dataset.hit); }
      }
    });
    // 人が送る・押す・打つと、滑り（glide）を止める（人の操作と滑りが取り合わない・11/17d）
    var glCancel = function (ev) { if (ev && ev.type === 'pointerdown' && ev.target.closest && ev.target.closest('#side')) return; SPY.pin = ''; if (glStop) { glStop(); glStop = null; cancelAnimationFrame(gl); clearTimeout(glT); } };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, glCancel, { passive: true, capture: true }); });
    var c3drag = null;   // 立体の棒: 左右に引いて回す（指でも・マウスでも）
    document.addEventListener('pointerdown', function (e) { var s = e.target.closest && e.target.closest('.c3s'); if (!s || e.pointerType === 'touch' || e.button) return; /* 指は横に送る（はみ出した図を動かす）・回すのはボタンで */ c3drag = { x: e.clientX, y0: C3.yaw, raf: 0 }; s.classList.add('drag'); });
    document.addEventListener('pointermove', function (e) {
      if (!c3drag) return; var ny = Math.max(-80, Math.min(80, c3drag.y0 + (e.clientX - c3drag.x) * 0.35));
      if (Math.abs(ny - C3.yaw) < 0.5) return; C3.yaw = ny;
      if (!c3drag.raf) c3drag.raf = requestAnimationFrame(function () { if (c3drag) c3drag.raf = 0; c3Redraw(); });
    });
    var c3up = function () { if (!c3drag) return; c3drag = null; $$('.c3s.drag').forEach(function (s) { s.classList.remove('drag'); }); };
    // 立体の棒の札: 矢印を合わせると出る（1コマに1回）・外すと消える。指は押したときに出す
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return; C3TIP.ev = e; if (C3TIP.raf) return;
      C3TIP.raf = requestAnimationFrame(function () { C3TIP.raf = 0; var ev = C3TIP.ev, g = !c3drag && ev.target.closest && ev.target.closest('.c3s g[data-k]'); if (g) c3TipShow(g, ev.clientX, ev.clientY); else if (C3TIP.g) c3TipHide(); });
    }, { passive: true });
    document.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') return; var g = e.target.closest && e.target.closest('.c3s g[data-k]'); if (g) c3TipShow(g, e.clientX, e.clientY); else c3TipHide(); }, { passive: true });
    window.addEventListener('scroll', function () { if (C3TIP.g) c3TipHide(); }, { passive: true });
    document.addEventListener('pointerup', c3up); document.addEventListener('pointercancel', c3up);
    document.addEventListener('input', function (e) { var t = e.target; if (t.id !== 'q1') return; clearTimeout(stimer); stimer = setTimeout(function () { search(t, $('#r1')); }, 120); });
    window.addEventListener('scroll', function () { fhSchedule(); sideSpySoon(); }, { passive: true });
    // 探す欄（上の帯）: 空のまま押すと、困りごとの言葉の例
    document.addEventListener('focusin', function (e) { if (e.target && e.target.id === 'q1' && !e.target.value.trim()) { var r1 = $('#r1'); r1.innerHTML = qExamples(); r1.classList.add('on'); } });
    // 左の目次の幅を掴んで変える（この端末に覚える）
    (function () {
      var g = $('#sidegrip'), drag = null, w = 0; try { w = parseInt(localStorage.getItem('storeops_side_w_v1') || '', 10); } catch (e) { w = 0; }
      if (w >= 180 && w <= 420) document.documentElement.style.setProperty('--side', w + 'px');
      if (!g) return;
      g.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, w: $('#side').getBoundingClientRect().width }; g.setPointerCapture(e.pointerId); e.preventDefault(); });
      g.addEventListener('pointermove', function (e) { if (!drag) return; var nw = Math.max(180, Math.min(420, Math.round(drag.w + e.clientX - drag.x))); document.documentElement.style.setProperty('--side', nw + 'px'); });
      g.addEventListener('pointerup', function () { if (!drag) return; drag = null; try { localStorage.setItem('storeops_side_w_v1', String(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--side'), 10))); } catch (e) { /* 覚えられなくても今は使える */ } fhSchedule(); });
    })();
    document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('tw')) fhSchedule(); }, true);
    window.addEventListener('resize', function () { document.documentElement.style.setProperty('--hdr', $('#hdr').offsetHeight + 'px'); fhSchedule(); if (!narrowNav()) sideOpen(false); var nar = window.innerWidth < 760; if (nar !== C3.nar) { C3.nar = nar; c3Redraw(); } });
    document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.matches && d.matches('details[data-lazy]') && d.open) fillLazy(d); if (d && d.matches && d.matches('details[data-lzf]') && d.open) fillLzf(d); fhSchedule(); }, true);
    window.addEventListener('beforeprint', function () { $$('details[data-lzf]').forEach(fillLzf); });
  }

  // ── はじめ: ログイン → statusStart（往復1本）→ 描く → 店の木を裏で先取り
  function onReady(email) {
    showBusy('読み込んでいます…');
    var t0 = performance.now();
    AUTH.call('statusStart').then(function (r) {
      if (!r || !r.ok) { if (r && r.auth) showGate(r.error, true, AUTH.login); else showGate((r && r.error) || '読み込めませんでした。', true, function () { onReady(email); }); return; }
      ME = r; DATA = {};
      try { localStorage.setItem('storeops_role_v1', String(r.role || 'none')); } catch (e) { /* 前の辞書の画面が、分析レポートの入口を出すかを決めるだけ（見られる範囲は窓口が決める） */ }
      if (r.role === 'store') { (r.stores || []).forEach(function (c) { DATA[c] = { sum: (r.summaries && r.summaries[c]) || null, none: r.nodata ? r.note : null }; }); useStore(r.stores[0]); }
      else useStore('');
      $('#acctbtn').innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 14.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="al">' + esc(r.email) + '（' + esc(roleLabel()) + '）</span>▾';
      $('#acctwho').textContent = r.email + '（' + roleLabel() + '）';
      $('#sideapps').innerHTML = appLinks();
      $('#builds').textContent = '画面 ' + ((window.STOREOPS_CONFIG || {}).build || '作業用') + '／窓口 ' + (r.build || '―');
      $('#sidever').textContent = '版: 画面 ' + ((window.STOREOPS_CONFIG || {}).build || '作業用') + '／窓口 ' + (r.build || '―');   // 公開の確かめ（左のサイドの下・スクロールせずに見つかる所）   // 公開の確かめ（どの版が出ているか）
      hideGate();
      try { render({}); } catch (e) { showGate('画面を描けませんでした（' + String(e && e.message || e).slice(0, 80) + '）。開き直してください。', true, function () { location.reload(); }); throw e; }
      window.__statusT = { start: performance.now() - t0 };
      if (CUR) ensureTree();
      loadDict();   // 辞書の中身と探す欄の読みの表を、裏で受け取る（型の選び・探すは、そのあと往復 0）
      if (r.role === 'hq' || r.role === 'admin') setTimeout(w32Load, 1200);
      setTimeout(gdFetch, 2500);   // 利用ガイドの中身を、最初の画面のあとに裏で1回（押したときの待ちを 0 に）   // 天気と売れ方の店ごとの違い（分析レポート 3-2 と同じ数）を、最初の画面のあとに裏で受け取る
    }, function () { showGate('通信できませんでした。通信の状態を確かめて、もう一度お試しください。', true, function () { onReady(email); }); });   // 通信の失敗と、描く所の失敗を分けて知らせる
  }
  /** 見た目のファイルが、この画面の版の物か（公開の直後に、古い見た目のファイルと組みで読まれたことがある・2026-11-16）。違えば、版の印つきで読み直す（1回だけ） */
  function cssGuard() {
    var want = (window.STOREOPS_CONFIG || {}).build; if (!want) return 'dev';
    var got = getComputedStyle(document.documentElement).getPropertyValue('--css-build').replace(/["'\s]/g, '');
    if (got === want) return 'ok';
    var old = document.querySelector('link[rel="stylesheet"][href^="style.css"]'); if (!old || document.getElementById('cssfix')) return 'skip';
    var l = document.createElement('link'); l.id = 'cssfix'; l.rel = 'stylesheet'; l.href = 'style.css?v=' + encodeURIComponent(want) + '&r=' + Date.now();
    l.onload = function () { old.remove(); fhSchedule(); };
    document.head.appendChild(l);
    return 'reload';
  }
  window.STATUS_CSS = cssGuard;
  document.addEventListener('DOMContentLoaded', function () {
    cssGuard();
    main = $('#main'); FH = $('#fh');
    document.documentElement.style.setProperty('--hdr', $('#hdr').offsetHeight + 'px');
    if (window.ResizeObserver) new ResizeObserver(function () { var hh = $('#hdr').offsetHeight + 'px'; if (document.documentElement.style.getPropertyValue('--hdr') !== hh) { document.documentElement.style.setProperty('--hdr', hh); fhSchedule(); } }).observe($('#hdr'));
    bind();
    AUTH.start(onReady, { gate: showGate, busy: showBusy });
  });
  window.STATUS_APP = { go: go, back: back, fromBack: fromBack, from: function () { var f = S.from && FROMS[S.from]; return f ? f.nm : ''; }, place: placeName, guide: { open: openGuide, ready: function () { return !!GD.html; }, go: gdGo, here: function () { return GD.here; }, prof: function () { var t0 = performance.now(); GD.cache = ''; var c = gdPrepared(), t1 = performance.now(); return { prep: t1 - t0, bytes: c.length }; } }, histLen: function () { return HIST.length; }, drillTo: drillTo, state: S, fhUpdate: fhUpdate, openSec: function (id) { openSec(id); }, tree: function () { return TREE; }, me: function () { return ME; }, kept: function () { return Object.keys(DATA).filter(function (c) { return DATA[c] && DATA[c].tree; }).length; }, dict: function () { return DICT; }, busy: function () { return !!(TREE_P || W32_P) || PEND > 0; }, gliding: function () { return !!glStop; },   // busy＝店の木・3-2 の数を裏で受け取っている最中（試験が、届いた後の描き直しと押すのが重ならないように待つ）
    find: function (q) { var i = $('#q1'); i.value = q; search(i, $('#r1')); return $$('#r1 button[data-hit]').map(function (b) { return b.textContent; }); } };
})();
