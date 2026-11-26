// ハチの見本（s1127a・2026-11-26 PO「ハチの動きOK　他へ広げて下さい」）。右上のアカウントのメニュー（▾）の「ハチの見本を見る」と、利用ガイドの「待つ間のハチの絵」から。
//   この辞書で出るハチの場面（開くときの待ち・ログインを確かめる間・長い待ち・つながらない・30 秒・探して見つからない）を、本物と同じ部品・同じ置き場・同じ字で、もふ・むぎわら の 12 場面。
//   形は商品呼出番号表【惣菜】0.2.9 の見本（自分のペースで進める）と同じ: 1 / 12 で止まる・「次へ ▶」「◀ 前へ」（キーの → ←）・左の場面の一覧から直に飛ぶ・
//   何番目か・場面の名前・どんな時に出るかを大きめに・「自動で流す」を選んだときだけ 1 場面 10 秒（長い待ちは字が替わってから 6 秒）・一時停止。長い待ちは本物と同じ 8 秒で字が替わる。
//   見るだけ: 窓口を呼ばない・データ・ログインの札・この PC に覚えた絵の選び（mitsubachi_style）を変えない（絵の案はカードごとに渡す）。カードの釦を押しても、次の場面へ進むだけ。
//   上の帯と同じ所に見本の帯（「← 元の画面へ戻る」は上の帯の「← ひとつ前に戻る」と同じ所・隣に「↑ TOP」）。Esc でも戻る。戻ると元の画面のまま（見ていた画面・送った位置）。
//   字は全部 textContent（部品も同じ）。外から読む物は無い。本物の幕（#gate）は、見本の間だけ場面の置き場（一覧の右・説明の下）に収める（status.js の STATUS_BEE の口）
(function () {
  'use strict';
  var B = window.STATUS_BEE, MB = window.Mitsubachi;
  if (!B || !MB) return;   // 部品が読めない端末では、見本を出さない（入口も作らない）
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = String(text); return e; }
  function btn(cls, text, title, fn) { var b = el('button', cls, text); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', fn); return b; }
  var NAME = { B: 'もふ', C: 'むぎわら' };
  var AUTO_MS = 10000, AFTER_SLOW_MS = 6000, SLOW_AT_MS = 8300;   // 自動で流すときの 1 場面・長い待ちで字が替わってから・字が替わる時刻（カードが出る 0.3 秒＋8 秒＝本物と同じ）
  var NARROW = 900;   // この辞書の左のサイドが「☰ 目次」になる幅と同じ。これより狭いと、場面の一覧は「☰ 場面の一覧」で開け閉め
  var NOHIT_Q = '駐車場の雪かき';   // 見本の「探して見つからない」に出す、打った字の例（作り物）
  var SAME = '見本では出したままにしています（ハチはずっと 8 の字に飛びます）。「↺ この場面をもう一度」で、0.3 秒たって出る所から見られます。';
  var CARD = '見本なので、カードの釦を押すと次の場面へ進みます。';

  // ---------------------------------------------------------------- 場面（play(絵の案, 次へ) → 止める関数）
  var SCENES = [
    { name: '開くときの待ち', when: '辞書を開いて 0.3 秒より長くかかったとき、真ん中に出ます。終わるとすぐ消えます。', note: SAME,
      play: function (st) { B.busy('読み込んでいます…', { style: st }); return function () { B.hide(); }; } },
    { name: 'ログインを確かめる間', when: 'Google でログインして戻ったとき、ログインを確かめる間に出ます（0.3 秒より長いときだけ）。', note: SAME,
      play: function (st) { B.busy('ログインを確かめています…', { style: st }); return function () { B.hide(); }; } },
    { name: '長い待ち（8 秒を超えた）', when: '8 秒を超えても終わらないとき、下の字が「時間がかかっています」に替わります。', slow: true, note: '',
      play: function (st) { B.busy('読み込んでいます…', { style: st }); return function () { B.hide(); }; } },
    { name: 'つながらない', when: '通信が切れたとき、困り顔と理由と「もう一度」が出ます。「もう一度」で、同じ所からやり直せます。', note: CARD,
      play: function (st, next) { B.retry({ title: '開けませんでした', text: B.net.offline, retry: next, style: st }); return function () { B.hide(); }; } },
    { name: '30 秒たっても返事がない', when: '30 秒たっても返事が無いとき、待つのをやめて、理由と「もう一度」を出します。', note: CARD,
      play: function (st, next) { B.retry({ title: '開けませんでした', text: B.net.timeout, retry: next, style: st }); return function () { B.hide(); }; } },
    { name: '探して見つからない', when: '上の帯の「探す」で見つからなかったとき、止まったハチと、言葉の例（押すと探します）が出ます。', note: '見本なので、言葉の例を押しても探しません。',
      play: function (st) {
        var sg = stage('is-find'), box = el('div', 'bd-find'), q = el('div', 'bd-q'), res = el('div', 'res bd-res');
        q.textContent = NOHIT_Q; q.setAttribute('aria-label', '探す欄（見本・打った字）');
        box.append(q, res); sg.append(box); B.none(res, NOHIT_Q, st);
        return function () { sg.remove(); };
      } }
  ];
  var STEPS = [];
  ['B', 'C'].forEach(function (st) { SCENES.forEach(function (sc) { STEPS.push({ st: st, sc: sc }); }); });

  // ---------------------------------------------------------------- 見本の帯（上の帯と同じ所）・左の場面の一覧・場面の上の進める釦と説明・下の画面を押せなくする透明の幕
  var run = null;
  function stage(cls) {
    var sg = el('div', 'bee-demo-stage' + (cls ? ' ' + cls : '')); sg.style.top = run.top + 'px'; sg.style.left = run.left + 'px';
    sg.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button[data-q]')) e.stopPropagation(); });   // 言葉の例を押しても、本物の探す欄で探さない
    document.body.append(sg); return sg;
  }
  function build() {
    var bar = el('div', 'bee-demo-bar'); bar.id = 'bee-demo'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'ハチの見本');
    var badge = el('span', 'bd-badge', 'ハチの見本'), sp = el('span', 'bd-sp');
    var nav = el('nav', 'bd-nav'); nav.setAttribute('aria-label', '戻る');
    var back = btn('bd-back', '← 元の画面へ戻る', '見本を終えて、元の画面へ戻ります（Esc でも戻ります）', function () { end(''); });
    var top = btn('bd-top', '↑ TOP', '場面の一覧と場面を、いちばん上へ', function () { run.list.scrollTop = 0; document.querySelectorAll('.bee-demo-stage').forEach(function (s) { s.scrollTop = 0; }); });
    nav.append(back, top);
    bar.append(badge, sp, nav, el('span', 'bd-lead', '待ち・つながらない・見つからないときのハチを、1場面ずつ見られます（見るだけ）'), el('span', 'bd-keys', 'キー: → 次へ・← 前へ・Esc 戻る'));
    // 左の場面の一覧（もふ 1〜6・むぎわら 7〜12）
    var list = el('nav', 'bee-demo-list'); list.id = 'bee-demo-list'; list.setAttribute('aria-label', '場面の一覧');
    list.append(el('p', 'bdl-title', '場面の一覧（' + STEPS.length + '）'));
    var items = [];
    ['B', 'C'].forEach(function (st) {
      list.append(el('p', 'bdl-head', '絵: ' + NAME[st]));
      STEPS.forEach(function (s, i) {
        if (s.st !== st) return;
        var b = btn('bdl-item', '', s.sc.when, function () { closeList(); show(i); });
        b.append(el('span', 'bdl-n', String(i + 1)), el('span', 'bdl-name', s.sc.name));
        list.append(b); items.push(b);
      });
    });
    // 場面の上: 進める釦（前へ・何番目・次へ・一覧・もう一度・自動で流す）・場面の名前・どんな時に出るか
    var cap = el('div', 'bee-demo-cap'); cap.id = 'bee-demo-cap';
    var row = el('div', 'bd-row');
    var prev = btn('bd-btn bd-prev', '◀ 前へ', '前の場面（キーの ←）', function () { go(-1); });
    var count = el('strong', 'bd-count');
    var next = btn('bd-btn bd-pri bd-next', '次へ ▶', '次の場面（キーの →）', function () { go(+1); });
    var listBtn = btn('bd-btn bd-listbtn', '☰ 場面の一覧', '見たい場面を選ぶ', function () { toggleList(); }); listBtn.setAttribute('aria-expanded', 'false'); listBtn.setAttribute('aria-controls', 'bee-demo-list');
    var replay = btn('bd-btn bd-replay', '↺ ', 'いまの場面を、はじめから出し直します', function () { show(run.i); }); replay.append(el('span', 'bd-long', 'この場面を'), document.createTextNode('もう一度'));
    var autoBox = el('span', 'bd-autobox');
    var autoBtn = btn('bd-btn bd-auto', '自動で流す', '1 場面 10 秒で次へ進みます（もう一度押すとやめる）', function () { setAuto(!run.auto); }); autoBtn.setAttribute('aria-pressed', 'false');
    var pauseBtn = btn('bd-btn bd-pause', '‖ 一時停止', 'いまの場面のまま止める（もう一度押すと続ける）', function () { setPaused(!run.paused); }); pauseBtn.setAttribute('aria-pressed', 'false'); pauseBtn.hidden = true;
    var leftTxt = el('span', 'bd-left');
    autoBox.append(autoBtn, pauseBtn, leftTxt);
    row.append(prev, count, next, listBtn, replay, autoBox);
    var title = el('div', 'bd-title'); title.setAttribute('aria-live', 'polite');
    var style = el('span', 'bd-style'), name = el('strong', 'bd-name'); title.append(style, name);
    var when = el('p', 'bd-when'), note = el('p', 'bd-note'), still = el('p', 'bd-still', 'この PC は『動きを減らす』の設定なので、ハチは止まって見えます。');
    still.hidden = !MB.deviceReduced();
    cap.append(row, title, when, note, still);
    var shield = el('div', 'bee-demo-shield'); shield.setAttribute('aria-hidden', 'true');
    document.body.append(shield, list, cap, bar);
    run.bar = bar; run.sp = sp; run.nav = nav; run.list = list; run.cap = cap; run.shield = shield; run.items = items; run.count = count; run.style = style; run.name = name;
    run.when = when; run.note = note; run.prev = prev; run.next = next; run.autoBtn = autoBtn; run.pauseBtn = pauseBtn; run.leftTxt = leftTxt; run.listBtn = listBtn; run.back = back;
  }
  function narrow() { return window.innerWidth <= NARROW; }
  // 帯・一覧・説明の大きさに合わせて、場面の置き場（上と左）を決める（場面の説明が替わったとき・幅が替わったときも）
  function place() {
    if (!run) return;
    var nw = narrow(), hdr = $('#hdr'), side = $('#side');
    run.bar.style.minHeight = hdr && !nw ? hdr.offsetHeight + 'px' : '';   // PC の幅では上の帯と同じ高さ
    run.list.classList.toggle('is-drop', nw);
    run.listBtn.hidden = !nw;
    if (!nw) { run.list.hidden = false; run.listBtn.setAttribute('aria-expanded', 'false'); run.list.style.width = (side && side.offsetWidth ? side.offsetWidth : 250) + 'px'; }
    else { run.list.style.width = ''; if (!run.listOpen) run.list.hidden = true; }
    // 「← 元の画面へ戻る」を、上の帯の「← ひとつ前に戻る」と同じ左の位置に（PC の幅）
    run.sp.style.width = '0px';
    var bk = $('#back');
    if (!nw && bk && bk.getClientRects().length) run.sp.style.width = Math.max(0, Math.round(bk.getBoundingClientRect().left - run.nav.getBoundingClientRect().left)) + 'px';
    var barH = run.bar.getBoundingClientRect().height;
    run.left = nw ? 0 : run.list.offsetWidth;
    run.cap.style.top = barH + 'px'; run.cap.style.left = run.left + 'px';
    run.capH = run.cap.getBoundingClientRect().height;
    run.top = barH + run.capH;
    run.list.style.top = (nw ? run.top : barH) + 'px';
    document.querySelectorAll('.bee-demo-stage').forEach(function (sg) { sg.style.top = run.top + 'px'; sg.style.left = run.left + 'px'; });
    var g = $('#gate'); g.style.top = run.top + 'px'; g.style.left = run.left + 'px';   // 本物の幕を、場面の置き場の中に（真ん中に寄せる作りはそのまま）
  }
  function toggleList(on) {
    if (!run || !narrow()) return;
    run.listOpen = on === undefined ? !run.listOpen : on;
    run.list.hidden = !run.listOpen; run.listBtn.setAttribute('aria-expanded', String(run.listOpen));
    if (run.listOpen && run.items[run.i]) run.items[run.i].focus();
  }
  function closeList() { if (run && run.listOpen) { toggleList(false); run.listBtn.focus(); } }
  function paint(i) {
    var s = STEPS[i], sc = s.sc;
    run.count.textContent = (i + 1) + ' / ' + STEPS.length;
    run.style.textContent = '絵: ' + NAME[s.st];
    run.name.textContent = sc.name;
    run.when.textContent = sc.when;
    run.note.textContent = sc.slow ? '本物と同じ 8 秒で、カードの下の字が替わります（あと 9 秒）。' : sc.note; run.note.hidden = !sc.note && !sc.slow;
    run.prev.disabled = i === 0;
    run.next.textContent = i === STEPS.length - 1 ? '終える ▶' : '次へ ▶';
    run.next.title = i === STEPS.length - 1 ? '見本を終えて、元の画面へ戻ります' : '次の場面（キーの →）';
    run.items.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    place();
  }
  function stopScene() { var s = run.stop; run.stop = null; if (s) { try { s(); } catch (e) { /* 片付けの失敗で止めない */ } } }
  function show(i) {
    stopScene();
    run.i = i; paint(i);
    var s = STEPS[i], me = ++run.seq, keep = document.activeElement;   // 本物のエラーのカードは「もう一度」に手を移すので、見本の釦に手を戻す（キーで続けて進められる）
    run.stop = s.sc.play(s.st, function () { if (run && run.seq === me) go(+1); });   // カードの釦＝次の場面へ（二度押しで2つ進まない）
    place();
    var mine = keep && keep !== document.body && keep.isConnected && (run.bar.contains(keep) || run.cap.contains(keep) || run.list.contains(keep));
    (mine ? keep : run.next).focus({ preventScroll: true });
    run.t0 = Date.now();
    run.ms = s.sc.slow ? SLOW_AT_MS + AFTER_SLOW_MS : AUTO_MS; run.deadline = run.t0 + run.ms; run.rest = run.ms;
    tick();
  }
  function go(d) { if (!run) return; var j = run.i + d; if (j < 0) return; if (j >= STEPS.length) { end('ハチの見本は、ここまでです（元の画面のままです）'); return; } show(j); }
  // 0.25 秒ごと: 長い待ちの「字が替わるまで あと◯秒」と、自動で流すときの「あと◯秒で次へ」
  function tick() {
    if (!run) return;
    var sc = STEPS[run.i].sc;
    if (sc.slow) {
      var changed = !!document.querySelector('#gate .mb-wait.mb-slow');
      var sec = Math.max(1, Math.ceil((SLOW_AT_MS - (Date.now() - run.t0)) / 1000));
      var t = changed ? '✓ カードの下の字が替わりました（本物と同じ、8 秒を超えたとき）。' : '本物と同じ 8 秒で、カードの下の字が替わります（あと ' + sec + ' 秒）。';
      if (run.note.textContent !== t) { run.note.textContent = t; if (run.cap.getBoundingClientRect().height !== run.capH) place(); }
    }
    if (!run.auto) return;
    if (run.paused) { run.leftTxt.textContent = '止めています'; return; }
    if (run.i === STEPS.length - 1) { setAuto(false); run.leftTxt.textContent = '最後の場面です'; return; }
    var rest = run.deadline - Date.now();
    if (rest <= 0) { go(+1); return; }
    var lt = 'あと ' + Math.ceil(rest / 1000) + ' 秒で次へ';
    if (run.leftTxt.textContent !== lt) run.leftTxt.textContent = lt;
  }
  function setAuto(on) {
    run.auto = on; run.paused = false;
    run.autoBtn.setAttribute('aria-pressed', String(on)); run.autoBtn.textContent = on ? '✓ 自動で流す' : '自動で流す';
    run.pauseBtn.hidden = !on; run.pauseBtn.textContent = '‖ 一時停止'; run.pauseBtn.setAttribute('aria-pressed', 'false');
    run.leftTxt.textContent = '';
    if (on) { run.deadline = Date.now() + run.ms; tick(); }
    place();
  }
  function setPaused(on) {
    if (!run.auto) return;
    if (on) run.rest = Math.max(0, run.deadline - Date.now()); else run.deadline = Date.now() + run.rest;
    run.paused = on; run.pauseBtn.textContent = on ? '▶ 続ける' : '‖ 一時停止'; run.pauseBtn.setAttribute('aria-pressed', String(on));
    tick();
  }
  function start(from) {
    if (run || B.gateShown()) return;   // 本物の待ち・ログインの最中は始めない
    B.closeMenu();
    run = { i: 0, seq: 0, stop: null, auto: false, paused: false, listOpen: false, top: 0, left: 0, t0: 0, ms: AUTO_MS, deadline: 0, rest: 0, ticker: 0, from: from || null, y: window.scrollY };
    document.body.classList.add('beedemo');   // 見本の間は、下の画面を送らない（戻ると送った位置のまま）。html に overflow を付けると、body の overflow（幕の locked）が別の送り枠になり、上の帯の sticky が外れる＝body に付ける
    build();
    run.ticker = window.setInterval(tick, 250);
    window.addEventListener('resize', place, { passive: true });
    show(0);
  }
  function end(message) {
    if (!run) return;
    window.clearInterval(run.ticker);
    stopScene(); B.hide();
    run.bar.remove(); run.cap.remove(); run.list.remove(); run.shield.remove();
    document.querySelectorAll('.bee-demo-stage').forEach(function (s) { s.remove(); });
    var g = $('#gate'); g.style.top = ''; g.style.left = '';
    window.removeEventListener('resize', place);
    document.body.classList.remove('beedemo');
    var from = run.from, y = run.y; run = null;
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    var f = from && from.isConnected ? from : $('#acctbtn'); if (f) f.focus({ preventScroll: true });
    if (message) { var t = $('#toast'); if (t) { t.textContent = message; t.classList.add('on'); setTimeout(function () { t.classList.remove('on'); }, 2400); } }
  }
  // キー: Esc＝見本を終える（ほかの Esc より先に受ける）・→ 次へ・← 前へ
  window.addEventListener('keydown', function (e) {
    if (!run || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(''); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(+1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
  }, true);

  // ---------------------------------------------------------------- 入口: 右上のアカウントのメニュー（ハチの絵を選ぶ所の下）と、利用ガイド（status.js の gdBee が置く）
  window.STATUS_BEE_DEMO = { start: start, steps: STEPS.length, running: function () { return !!run; }, at: function () { return run ? run.i + 1 : 0; } };
  function entry() {   // 選ぶ所（status.js が DOMContentLoaded で置く）の下に
    var host = $('#beepick'); if (!host || $('#bee-demo-open')) return;
    var open = el('button', 'bee-demo-open'); open.type = 'button'; open.id = 'bee-demo-open';
    open.append(el('strong', '', 'ハチの見本を見る'), el('small', '', '待ち・つながらない・見つからないときのハチを、1場面ずつ自分のペースで見ます（見るだけ）'));
    open.addEventListener('click', function () { start($('#acctbtn')); });
    host.append(open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entry); else entry();
})();
