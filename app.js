'use strict';
// 店舗運営/MDの辞書。中身（DATA）は呼び出し側が渡す:
//   見本（1枚版・手元の確かめ用）＝ページに埋め込んだ JSON（外と通信しない）
//   Web 版 ＝ GAS がログインを確かめてから返したもの（web.js）。スライドも同じく GAS から、開いた画面の分だけ受け取る
// env = { mode: 'file' | 'web', user, logout, relogin, fetchSlides }
function startStoreOps(DATA, env) {
env = env || { mode: 'file' };
const WEB = env.mode === 'web';
const $ = s => document.querySelector(s);
const view = $('#view'), qInput = $('#q'), tip = $('#tip'), backBtn = $('#back'), modeBox = $('#mode');

function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c);
  return n;
}
const link = (hash, attrs, ...kids) => el('a', Object.assign({ href: hash }, attrs), ...kids);
const badge = (t, cls) => el('span', { class: 'badge ' + (cls || 'b-' + t), text: t });
const AI = () => badge('AI の案', 'b-ai');

// ---------- 索引 ----------
const idx = (arr, k = 'id') => new Map(arr.map(x => [x[k], x]));
const shelfById = idx(DATA.shelves), cardById = idx(DATA.cards), callById = idx(DATA.calls), factById = idx(DATA.facts);
const opeById = idx(DATA.ope), secById = idx(DATA.sections), eventById = idx(DATA.events), eventByName = idx(DATA.events, 'name');
const termByName = idx(DATA.terms, 'name');
const inShelf = (arr, id) => arr.filter(x => (x.shelves || []).includes(id));
const monthOf = m => DATA.months.find(x => x.m === m);
const strength = s => s >= 0.12 ? '強' : '中';

// ---------- 見せ方（現場／教える） ----------
let teach = false;
try { teach = localStorage.getItem('storeops_mode') === 'teach'; } catch (_) { /* 使えないときは現場の見せ方 */ }
function applyMode() { document.body.classList.toggle('teach', teach); modeBox.checked = teach; }
modeBox.addEventListener('change', () => {
  teach = modeBox.checked; applyMode();
  try { localStorage.setItem('storeops_mode', teach ? 'teach' : 'field'); } catch (_) { /* 覚えられなくても動く */ }
  render(false, scrollY);
});
applyMode();

// ---------- 用語（本文の中の用語に印。カーソル・押すと意味） ----------
const TERM_RE = DATA.terms.length ? new RegExp(DATA.terms.map(t => t.name).sort((a, b) => b.length - a.length)
  .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
function markTerms(root) {
  if (!TERM_RE) return;
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest('a, button, .term, h1') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const t = node.nodeValue; let last = 0, m, frag = null;
    TERM_RE.lastIndex = 0;
    while ((m = TERM_RE.exec(t))) {
      if (seen.has(m[0])) continue;   // 同じ用語の印は1つの画面に1回だけ（うるさくしない）
      seen.add(m[0]);
      frag = frag || document.createDocumentFragment();
      frag.append(t.slice(last, m.index), el('span', { class: 'term', 'data-t': m[0], tabindex: '0', text: m[0] }));
      last = m.index + m[0].length;
    }
    if (frag) { frag.append(t.slice(last)); node.replaceWith(frag); }
  }
}
function showTip(target, sticky) {
  const t = termByName.get(target.dataset.t);
  if (!t) return;
  tip.replaceChildren(el('b', { text: t.name }), t.short, sticky ? el('div', null, link('#/term/' + encodeURIComponent(t.name), { style: 'color:#b9f6ca' }, 'くわしく →')) : null);
  tip.style.display = 'block';
  const r = target.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  tip.style.top = (r.bottom + h + 12 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  tip.dataset.sticky = sticky ? '1' : '';
}
document.addEventListener('mouseover', e => { const t = e.target.closest('.term'); if (t) showTip(t, false); });
document.addEventListener('mouseout', e => { if (e.target.closest('.term') && !tip.dataset.sticky) tip.style.display = 'none'; });
document.addEventListener('click', e => {
  const t = e.target.closest('.term');
  if (t) { showTip(t, true); return; }
  if (!e.target.closest('#tip')) { tip.style.display = 'none'; tip.dataset.sticky = ''; }
});

// ---------- ログインの期限切れ（Web 版）: 下に知らせを出し、押すとログインし直して同じ画面へ戻る ----------
function authLost(message) {
  if (!WEB || document.getElementById('authbar')) return;
  document.body.append(el('div', { id: 'authbar', role: 'alert' }, el('span', { text: message || 'ログインの期限が切れました。' }),
    el('button', { type: 'button', onclick: () => env.relogin() }, 'ログインし直す')));
}

// ---------- スライドを受け取る（Web 版は、画面に出るものだけを数枚ずつ GAS から。受け取ったものは覚えておく） ----------
const slideCache = new Map();
let slideWait = [], slideTimer = 0;
function getSlide(id) {
  if (!WEB) return Promise.resolve(DATA.slides[id].file);
  if (!slideCache.has(id)) {
    slideCache.set(id, new Promise((res, rej) => { slideWait.push({ id, res, rej }); }));
    clearTimeout(slideTimer);
    slideTimer = setTimeout(flushSlides, 30);   // 同じ画面で出るものを1回の問い合わせにまとめる
  }
  return slideCache.get(id);
}
function flushSlides() {
  const wait = slideWait;
  slideWait = [];
  for (let i = 0; i < wait.length; i += 6) {
    const part = wait.slice(i, i + 6);
    env.fetchSlides(part.map(x => x.id)).then(r => r, () => null).then(r => {
      if (r && r.auth) authLost(r.error);
      for (const x of part) {
        const src = r && r.ok && r.slides && r.slides[x.id];
        if (src) x.res(src);
        else { slideCache.delete(x.id); x.rej(new Error((r && r.error) || 'スライドがありません')); }   // 次に開いたとき取り直す
      }
    });
  }
}
const slideIO = WEB && 'IntersectionObserver' in window ? new IntersectionObserver(ents => ents.forEach(e => {
  if (e.isIntersecting) { slideIO.unobserve(e.target); fillSlide(e.target); }
}), { rootMargin: '400px 0px' }) : null;
function fillSlide(img) {
  getSlide(img.dataset.slide).then(src => { img.src = src; img.classList.remove('wait'); },
    () => { img.classList.remove('wait'); img.classList.add('fail'); img.alt = 'スライドを読めませんでした'; });
}
function slideImg(id) {
  const s = DATA.slides[id];
  if (!WEB) return el('img', { src: s.file, alt: s.caption, loading: 'lazy' });
  const img = el('img', { alt: s.caption, class: 'wait', 'data-slide': id });
  if (slideIO) slideIO.observe(img); else fillSlide(img);
  return img;
}

// ---------- スライドを大きく見る ----------
const lb = $('#lightbox'), lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption');
let lbList = [], lbAt = 0, lbSeq = 0;
function openLb(list, at) { lbList = list; lbAt = at; showLb(); lb.hidden = false; }
function showLb() {
  const id = lbList[lbAt], s = DATA.slides[id], seq = ++lbSeq;
  lbCap.textContent = `${s.caption}（${lbAt + 1}／${lbList.length}）`;
  lbImg.removeAttribute('src');
  lbImg.alt = '読み込んでいます…';
  getSlide(id).then(src => { if (seq === lbSeq) { lbImg.src = src; lbImg.alt = s.caption; } },
    () => { if (seq === lbSeq) lbImg.alt = 'スライドを読めませんでした'; });
  if (lbList.length > 1) getSlide(lbList[(lbAt + 1) % lbList.length]).catch(() => {});   // 次の1枚を先に受け取る（送るのが速くなる）
}
function stepLb(d) { lbAt = (lbAt + d + lbList.length) % lbList.length; showLb(); }
lb.querySelector('.lb-close').onclick = () => { lb.hidden = true; };
lb.querySelector('.lb-prev').onclick = () => stepLb(-1);
lb.querySelector('.lb-next').onclick = () => stepLb(1);
lb.addEventListener('click', e => { if (e.target === lb) lb.hidden = true; });
document.addEventListener('keydown', e => {
  if (lb.hidden) return;
  if (e.key === 'Escape') lb.hidden = true;
  if (e.key === 'ArrowLeft') stepLb(-1);
  if (e.key === 'ArrowRight') stepLb(1);
});
function slideGrid(ids) {
  const list = ids.filter(id => DATA.slides[id]);
  if (!list.length) return null;
  return el('div', { class: 'slides' }, list.map((id, i) => el('button', { type: 'button', onclick: () => openLb(list, i) },
    slideImg(id), el('span', { text: DATA.slides[id].caption }))));
}

// ---------- 天気と売れ方（POS と天気のデータ分析で分かったこと。原本はハブのナレッジ・build.py が読む） ----------
// 現場の見せ方＝ひとこと。教える見せ方＝数字も開き、調べた範囲・まだ確かでないことも出す
const W = DATA.weather || null;
const wRows = W ? W.groups.flatMap(g => g.rows.map(r => Object.assign({ group: g }, r))) : [];
function weatherLink() {
  if (!W) return null;
  return [el('h2', { text: '天気と売れ方' }),
    link('#/weather', { class: 'row wlink' }, el('div', { class: 't', text: '雨・雪・暑さ・晴れで、客数と売れる物がどう変わるか' }),
      el('div', { class: 'm', text: `分かったこと ${wRows.length}（データ分析）` }))];
}
function viewWeather(focus) {
  if (!W) return notFound();
  const row = (g, r) => el('div', { class: 'wrow' + (g.kind === 'none' ? ' none' : ''), id: 'w-' + r.id },
    el('div', { class: 'w-what', text: r.what }),
    el('div', { class: 'w-hito', text: r.hitokoto }),
    r.numbers ? el('details', { class: 'w-num', open: teach || r.id === focus || null }, el('summary', { text: '数字' }), el('div', { text: r.numbers })) : null);
  return [
    el('div', { class: 'crumb' }, link('#/', null, 'トップ'), ' ／ 天気と売れ方'),
    el('h1', { text: '天気と売れ方' }),
    el('p', { class: 'sub', text: W.lead }),
    teach ? el('div', { class: 'box' }, el('dl', { class: 'kv' }, el('dt', { text: '調べた範囲' }), el('dd', { text: W.period }),
      el('dt', { text: '数字の読み方' }), el('dd', { text: W.reading }))) : null,
    W.groups.map(g => [
      el('h2', { class: g.kind === 'none' ? 'w-none' : null, text: g.title }),
      g.kind === 'none' ? el('p', { class: 'sub', text: '効かないと分かったことも、思い込みを外すための大事な事実です。' }) : null,
      el('div', { class: 'wlist' }, g.rows.map(r => row(g, r))),
      g.notes.length ? el('ul', { class: 'w-notes' }, g.notes.map(t => el('li', { text: t }))) : null]),
    W.calendar.length ? [el('h2', { text: '天気より大きく動く日（暦）' }), el('div', { class: 'box' }, W.calendar.map(t => el('p', { style: 'margin:4px 0', text: t })))] : null,
    teach && W.open.length ? [el('h2', { text: 'まだ確かでないこと' }), el('ul', null, W.open.map(t => el('li', { text: t })))] : null,
    el('p', { class: 'src', text: `出どころ：${W.source_name}（${W.updated} 更新）` }),
  ];
}
function acctLine() {
  if (!WEB) return null;
  return el('p', { class: 'acct' }, `ログイン中：${env.user || ''}`, el('button', { type: 'button', class: 'print-btn', onclick: () => env.logout() }, 'ログアウト'));
}

// ---------- 暦（今月の型） ----------
const thisMonth = new Date().getMonth() + 1;
let monthSel = thisMonth;
const mod12 = m => ((m - 1 + 1200) % 12) + 1;
// 催事の準備に入っているか: 催事の月から lead か月前まで
const inPrep = (m, e) => ((e.month - m + 12) % 12) <= (e.lead || 0);
// 判断カードの月: 催事の月から「E-4m」などを引く（日の単位は催事の月のまま）
function cardMonths(c) {
  const e = c.ev && eventByName.get(c.ev);
  if (!e) return [];
  const off = w => { const m = /^E-(\d+)m$/.exec(w || ''); return m ? -Number(m[1]) : 0; };
  const a = mod12(e.month + off(c.when_from)), b = mod12(e.month + off(c.when_to || c.when_from));
  const out = []; for (let m = a, i = 0; i < 12; m = mod12(m + 1), i++) { out.push(m); if (m === b) break; }
  return out;
}
const isLead = c => /^E-\d+m$/.test(c.when_from || '');
function monthBox(m, compact) {
  const mo = monthOf(m);
  const nav = el('div', { class: 'monthnav' },
    el('button', { type: 'button', 'aria-label': '前の月', onclick: () => { monthSel = mod12(monthSel - 1); render(false, scrollY); } }, '◀'),
    el('h2', { style: 'margin:4px 0;border:0;padding:0' }, `${m}月の型`, m === thisMonth ? el('span', { class: 'badge b-確立', text: '今月' }) : null),
    el('button', { type: 'button', 'aria-label': '次の月', onclick: () => { monthSel = mod12(monthSel + 1); render(false, scrollY); } }, '▶'));
  if (!mo) return el('div', { class: 'box month' }, nav, el('div', { class: 'empty', text: 'この月の型はまだありません。' }));
  const prep = DATA.events.filter(e => inPrep(m, e));
  const lead = DATA.cards.filter(c => isLead(c) && cardMonths(c).includes(m));
  const day = DATA.cards.filter(c => c.ev && !isLead(c) && cardMonths(c).includes(m));
  const week = (mo.items.week || {}).list || [];
  return el('div', { class: 'box month' }, nav,
    el('p', { style: 'margin:2px 0;font-weight:700', text: mo.theme }),
    mo.spot ? el('p', { class: 'sub', style: 'margin:2px 0', text: mo.spot }) : null,
    prep.length ? el('div', null, el('h3', { text: '準備に入っている催事' }),
      el('div', { class: 'chips' }, prep.map(e => link('#/event/' + e.id, { class: 'chip ev' }, `${e.name}（${e.day}）`)))) : null,
    lead.length ? el('div', null, el('h3', { text: '今月、前もって決めること' }), rows(lead.map(cardRow))) : null,
    day.length ? el('div', null, el('h3', { text: '今月の催事の当日まわり' }), rows(day.map(cardRow))) : null,
    !compact && week.length ? el('div', null, el('h3', { text: '週のテーマ' }), el('ul', null, week.map(w => el('li', { text: w })))) : null,
    el('p', { style: 'margin:8px 0 0' }, link('#/month/' + m, null, `${m}月をくわしく見る →`)));
}

// ---------- 行 ----------
const rows = list => el('div', { class: 'list' }, list);
const cardRow = c => link('#/card/' + c.id, { class: 'row' }, el('div', { class: 't' }, c.title, c.status ? badge(c.status) : null),
  el('div', { class: 'm', text: `いつ：${c.when}　見る：${c.check || ''}` }));
const callRow = c => link('#/call/' + c.id, { class: 'row' }, el('div', { class: 't' }, c.situation, badge(c.verdict || '未確認')),
  el('div', { class: 'm', text: `→ ${c.decision || ''}` }));
const opeRow = o => link('#/ope/' + o.id, { class: 'row' }, el('div', { class: 't' }, `${o.title}${o.sub ? '（' + o.sub + '）' : ''}`),
  el('div', { class: 'm', text: `運営の型・${o.kind_ja}${o.items.length ? '　' + o.items.length + '項目' : ''}` }));
const secRow = (s, extra) => link('#/sec/' + encodeURIComponent(s.id), { class: 'row' },
  el('div', { class: 't' }, el('span', { class: 'num', text: s.id }), s.title, extra || null),
  el('div', { class: 'm', text: `${s.tab}・${s.chapter}${s.slides.length ? '　スライド' + s.slides.length + '枚' : ''}` }));
const shelfChips = ids => el('div', { class: 'chips' }, (ids || []).map(id => shelfById.get(id)).filter(Boolean)
  .map(s => link('#/shelf/' + s.id, { class: 'chip' }, '棚：' + s.name)));

// ---------- 画面 ----------
function viewHome() {
  const tiles = el('div', { class: 'shelves' }, DATA.shelves.map(s => {
    const nc = inShelf(DATA.cards, s.id).length + inShelf(DATA.calls, s.id).length + inShelf(DATA.ope, s.id).length;
    const ns = inShelf(DATA.sections, s.id).length;
    return link('#/shelf/' + s.id, { class: 'shelf' }, el('b', { text: s.name }), el('span', { text: `判断・型 ${nc}／教科書 ${ns}` }));
  }));
  const daily = DATA.cards.filter(c => c.when_from === '毎日');
  if (teach) {
    return [
      el('h1', { text: '巡回・会議の前に' }),
      el('p', { class: 'sub', text: '指導したいテーマを選ぶと、教科書の該当の節と、関係する判断カードがまとめて出ます。' }),
      rows(DATA.themes.map((t, i) => link('#/theme/' + i, { class: 'row' }, el('div', { class: 't' }, t.keyword, badge(t.tag, 'b-仮説')),
        el('div', { class: 'm', text: t.desc })))),
      el('h2', { text: '話題の棚' }), el('p', { class: 'sub' }, '14の棚は ', AI(), '（10/5 以降に確定）'), tiles,
      weatherLink(),
      monthBox(monthSel, true),
      acctLine(),
    ];
  }
  return [
    el('div', { class: 'lead-box' },
      el('b', { text: '店舗運営/MDの辞書' }),
      el('p', { text: '店長・主任が、その場の判断に使う1冊です。困りごとの言葉（「スカスカ」「値引き」など）で探すと、見ること・正しい状態・することが1枚で出ます。本部が教えるときは右上の「教える」を押すと、根拠と教科書の節が開きます。' })),
    monthBox(monthSel, false),
    el('h2', { text: `毎日見ること（${daily.length}）` }), rows(daily.map(cardRow)),
    weatherLink(),
    el('h2', { text: '話題から探す' }), el('p', { class: 'sub' }, '14の棚は ', AI(), '（10/5 以降に確定）'), tiles,
    el('p', { class: 'sub', style: 'margin-top:20px' }, link('#/events', null, '催事の一覧'), '　', link('#/term', null, '用語の一覧'), '　', link('#/themes', null, '巡回・会議の前に（テーマ）')),
    acctLine(),
  ];
}
function viewShelf(id) {
  const s = shelfById.get(id);
  if (!s) return notFound();
  const cs = inShelf(DATA.cards, id), ca = inShelf(DATA.calls, id), op = inShelf(DATA.ope, id);
  const secs = inShelf(DATA.sections, id);
  const learn = [el('h2', { text: `学ぶ：教科書の節（${secs.length}）` }),
    secs.length ? rows(secs.map(x => secRow(x))) : el('div', { class: 'empty', text: 'この棚に教科書の節はありません。' })];
  const judge = [
    el('h2', { text: `判断カード（${cs.length}）` }), cs.length ? rows(cs.map(cardRow)) : el('div', { class: 'empty', text: 'この棚の判断カードはまだありません（本部が書き足す候補）。' }),
    ca.length ? [el('h2', { text: `ベテランの判断（${ca.length}）` }), rows(ca.map(callRow))] : null,
    op.length ? [el('h2', { text: `運営の型（${op.length}）` }), rows(op.map(opeRow))] : null];
  return [el('div', { class: 'crumb' }, link('#/', null, 'トップ'), ' ／ 話題の棚 ', AI()), el('h1', { text: s.name }), teach ? [learn, judge] : [judge, learn]];
}
function viewCard(id) {
  const c = cardById.get(id);
  if (!c) return notFound();
  const facts = c.basis.map(b => factById.get(b)).filter(Boolean), calls = c.basis.map(b => callById.get(b)).filter(Boolean);
  const secs = c.secs.map(([sid, sc]) => [secById.get(sid), sc]).filter(x => x[0]);
  const ev = c.ev && eventByName.get(c.ev);
  const tr = (k, v, cls) => el('tr', { class: cls || null }, el('th', { text: k }), el('td', { text: v || '—' }));
  const printBtn = el('p', { class: 'teach-only' }, el('button', { type: 'button', class: 'print-btn', onclick: () => print() }, 'このカードを印刷'));
  return [
    shelfChips(c.shelves),
    el('h1', null, c.title, c.status ? badge(c.status) : null, c.auto ? badge('数字で判定できる', 'b-確立') : null),
    el('div', { class: 'chips' }, ev ? link('#/event/' + ev.id, { class: 'chip ev' }, '催事：' + ev.name) : null,
      c.dept ? el('span', { class: 'chip', text: '部門：' + c.dept }) : el('span', { class: 'chip', text: '全部門' }),
      c.size ? el('span', { class: 'chip', text: '規模：' + c.size }) : null),
    el('table', { class: 'card5' }, el('tbody', null, tr('いつ', c.when), tr('見る', c.check), tr('正しい', c.ok), tr('する', c.do, 'do'), tr('外れたら', c.ng))),
    el('div', { class: 'why' }, el('b', { text: 'なぜ（人の言葉）' }),
      c.why ? el('div', { text: c.why })
        : c.why_sample ? el('div', null, el('span', { class: 'why-tag', text: '記入例' }), el('span', { text: c.why_sample }),
            el('div', { class: 'why-note', text: '本部（ベテラン・部署の責任者）が書くと、この欄はこう見えます。' }))
          : el('div', { text: '未記入です。本部（ベテラン・部署の責任者）が、読んだ人が自分の店に当てはめられるように書く欄です。' })),
    (facts.length || calls.length) ? el('details', { class: 'more', open: true }, el('summary', { text: `根拠（数字 ${facts.length}・判断 ${calls.length}）` }),
      el('div', null, facts.map(f => el('div', { class: 'fact' }, `${f.metric}：`, el('span', { class: 'v', text: `${f.value}${f.unit || ''}` }),
        el('span', { class: 'sub', text: `　${[f.period, f.area, f.dept].filter(Boolean).join('・')}　出典：${f.src || '—'}` }))),
      calls.map(k => el('div', { class: 'call' }, link('#/call/' + k.id, null, k.situation), badge(k.verdict || '未確認'),
        el('div', { class: 'sub', text: `→ ${k.decision || ''}${k.outcome ? '（結果：' + k.outcome + '）' : ''}` }))))) : null,
    el('details', { class: 'more', open: teach || null }, el('summary', null, `詳しく：教科書の節とスライド（${secs.length}）`, AI()),
      el('div', null, secs.length ? [el('p', { class: 'sub', text: '文の近さで AI が結んだ候補です（強・中）。10/5 以降の突き合わせで確かめます。' }),
        rows(secs.map(([s, sc]) => secRow(s, badge('近さ ' + strength(sc), 'b-ai')))),
        slideGrid(secs.flatMap(([s]) => s.slides).slice(0, 8))]
        : el('div', { class: 'empty', text: '結びつく教科書の節の候補はありません。' }))),
    c.words.length ? el('p', { class: 'sub' }, '現場の言い方（検索で当たる言葉）：', c.words.join('・')) : null,
    printBtn,
  ];
}
function viewSec(id) {
  const s = secById.get(id);
  if (!s) return notFound();
  const body = el('div', { class: 'body' });
  body.innerHTML = s.html || '';   // 作る仕組みで、読むのに要る札だけにしてある（属性なし）
  if (!body.textContent.trim()) body.textContent = s.text || '（本文はスライドを見てください）';
  markTerms(body);
  const cs = s.cards.map(([cid, sc]) => [cardById.get(cid), sc]).filter(x => x[0]);
  const list = DATA.sections.filter(x => x.tab === s.tab), at = list.indexOf(s);
  const prev = list[at - 1], next = list[at + 1];
  return [
    el('div', { class: 'crumb' }, link('#/', null, 'トップ'), ` ／ 教科書・${s.tab} ／ ${s.chapter}`),
    el('h1', null, s.num ? el('span', { class: 'num', style: 'font-size:18px;color:var(--sub);margin-right:8px', text: s.num }) : null, s.title),
    shelfChips(s.shelves),
    body,
    s.source ? el('div', { class: 'src', text: '出典：' + s.source }) : null,
    slideGrid(s.slides),
    el('h2', null, `関係する判断カード（${cs.length}）`, AI()),
    cs.length ? rows(cs.map(([c, sc]) => link('#/card/' + c.id, { class: 'row' }, el('div', { class: 't' }, c.title, badge('近さ ' + strength(sc), 'b-ai')),
      el('div', { class: 'm', text: `いつ：${c.when}　する：${c.do || ''}` }))))
      : el('div', { class: 'empty', text: '結びつく判断カードの候補はありません（この節から判断カードを作る候補）。' }),
    el('p', { class: 'sub', style: 'margin-top:18px' }, prev ? link('#/sec/' + encodeURIComponent(prev.id), null, '← ' + prev.id) : null, '　', next ? link('#/sec/' + encodeURIComponent(next.id), null, next.id + ' →') : null),
  ];
}
function viewOpe(id) {
  const o = opeById.get(id);
  if (!o) return notFound();
  const secs = (o.secs || []).map(([sid, sc]) => [secById.get(sid), sc]).filter(x => x[0]);
  const body = el('div', { class: 'body' }, o.body || '', o.items.length ? el('ul', null, o.items.map(t => el('li', { text: t }))) : null);
  markTerms(body);
  return [shelfChips(o.shelves), el('div', { class: 'crumb', text: '運営の型・' + o.kind_ja }), el('h1', { text: `${o.title}${o.sub ? '（' + o.sub + '）' : ''}` }), body,
    secs.length ? [el('h2', null, '詳しく：教科書の節', AI()), rows(secs.map(([s, sc]) => secRow(s, badge('近さ ' + strength(sc), 'b-ai'))))] : null];
}
function viewCall(id) {
  const k = callById.get(id);
  if (!k) return notFound();
  const used = DATA.cards.filter(c => c.basis.includes(id));
  const dl = (a, b) => b ? [el('dt', { text: a }), el('dd', { text: b })] : null;
  return [shelfChips(k.shelves), el('div', { class: 'crumb', text: 'ベテランの判断' }), el('h1', null, k.situation, badge(k.verdict || '未確認')),
    el('div', { class: 'box' }, el('dl', { class: 'kv' }, dl('決めたこと', k.decision), dl('なぜ', k.because), dl('結果', k.outcome), dl('だれが', k.who), dl('いつ', k.ymd), dl('出典', k.src))),
    used.length ? [el('h2', { text: 'この判断を根拠にしている判断カード' }), rows(used.map(cardRow))] : null];
}
function viewEvents() {
  return [el('h1', { text: '催事の一覧' }), rows(DATA.events.map(e => link('#/event/' + e.id, { class: 'row' }, el('div', { class: 't', text: `${e.month}月　${e.name}` }),
    el('div', { class: 'm', text: `${e.day}　準備は${e.lead}か月前から　部門の型 ${e.depts.length}` }))))];
}
function viewEvent(id) {
  const e = eventById.get(id);
  if (!e) return notFound();
  const cs = DATA.cards.filter(c => c.ev === e.name);
  return [el('div', { class: 'crumb' }, link('#/events', null, '催事の一覧')), el('h1', { text: e.name }),
    el('div', { class: 'box' }, el('dl', { class: 'kv' }, el('dt', { text: 'いつ' }), el('dd', { text: `${e.month}月　${e.day}` }),
      el('dt', { text: '準備' }), el('dd', { text: `${e.lead}か月前から` }), el('dt', { text: 'ポイント' }), el('dd', { text: e.note || '—' }))),
    el('h2', { text: `判断カード（${cs.length}）` }), cs.length ? rows(cs.map(cardRow)) : el('div', { class: 'empty', text: 'この催事の判断カードはまだありません。' }),
    el('h2', { text: `部門ごとの型（${e.depts.length}）` }),
    e.depts.length ? e.depts.map(d => el('details', { class: 'more dept' }, el('summary', { text: `${d.dept}${d.area ? '（' + d.area + '）' : ''}　コーナー${d.corners.length}` }),
      el('div', null, d.schedule ? el('p', null, el('b', { text: '段取り：' }), d.schedule) : null, d.caution ? el('p', null, el('b', { text: '注意：' }), d.caution) : null,
        d.corners.map(c => el('div', { class: 'corner' }, el('b', { text: c.name }), c.items ? el('div', { class: 'sub', text: c.items }) : null, c.how ? el('div', { text: c.how }) : null)),
        d.plans.length ? [el('h3', { text: '売場の例' }), d.plans.map(p => el('div', { class: 'corner' }, el('b', { text: `${p.size || ''} ${p.theme || ''}` }), el('div', { text: p.body })))] : null)))
      : el('div', { class: 'empty', text: '部門ごとの型はまだありません。' })];
}
function viewMonth(m) {
  m = Number(m); if (!(m >= 1 && m <= 12)) return notFound();
  monthSel = m;
  const mo = monthOf(m);
  const evs = DATA.events.filter(e => e.month === m);
  return [el('div', { class: 'crumb' }, link('#/', null, 'トップ')), monthBox(m, true),
    mo ? el('div', { class: 'box' }, el('dl', { class: 'kv' }, el('dt', { text: '学校・行事' }), el('dd', { text: mo.school || '—' }), el('dt', { text: 'メモ' }), el('dd', { text: mo.note || '—' }))) : null,
    evs.length ? [el('h2', { text: 'この月の催事' }), el('div', { class: 'chips' }, evs.map(e => link('#/event/' + e.id, { class: 'chip ev' }, e.name)))] : null,
    mo ? Object.values(mo.items).map(g => [el('h2', { text: g.label }), el('ul', null, g.list.map(t => el('li', { text: t })))]) : null,
    W ? el('p', { class: 'sub', style: 'margin-top:18px' }, link('#/weather', null, '天気で客数と売れる物がどう変わるか（データ分析）→')) : null];
}
function viewTerms() {
  const list = [...DATA.terms].sort((a, b) => (a.reading || a.name).localeCompare(b.reading || b.name, 'ja'));
  return [el('h1', { text: `用語（${list.length}）` }), el('p', { class: 'sub', text: '教科書の用語集から。本文の中の用語は、カーソルを合わせる（スマホは押す）と意味が出ます。' }),
    rows(list.map(t => link('#/term/' + encodeURIComponent(t.name), { class: 'row' }, el('div', { class: 't', text: t.name }), el('div', { class: 'm', text: t.short }))))];
}
function viewTerm(name) {
  const t = termByName.get(name);
  if (!t) return notFound();
  return [el('div', { class: 'crumb' }, link('#/term', null, '用語の一覧')), el('h1', { text: t.name }), el('p', { class: 'sub', text: t.reading }),
    el('div', { class: 'box' }, el('p', { text: t.short }), t.example ? el('p', { class: 'sub', text: '例：' + t.example }) : null),
    t.related.length ? el('div', { class: 'chips' }, t.related.map(r => termByName.has(r) ? link('#/term/' + encodeURIComponent(r), { class: 'chip' }, r) : el('span', { class: 'chip', text: r }))) : null];
}
function viewThemes() {
  return [el('h1', { text: '巡回・会議の前に' }), rows(DATA.themes.map((t, i) => link('#/theme/' + i, { class: 'row' }, el('div', { class: 't' }, t.keyword, badge(t.tag, 'b-仮説')), el('div', { class: 'm', text: t.desc }))))];
}
function viewTheme(i) {
  const t = DATA.themes[Number(i)];
  if (!t) return notFound();
  const secs = t.secs.map(id => secById.get(id)).filter(Boolean);
  const cs = [...new Map(secs.flatMap(s => s.cards).map(([cid]) => [cid, cardById.get(cid)])).values()].filter(Boolean);
  return [el('div', { class: 'crumb' }, link('#/themes', null, '巡回・会議の前に')), el('h1', null, t.keyword, badge(t.tag, 'b-仮説')), el('p', { text: t.desc }),
    el('h2', { text: `教科書の該当（${secs.length}）` }), rows(secs.map(s => secRow(s))),
    el('h2', null, `関係する判断カード（${cs.length}）`, AI()), cs.length ? rows(cs.map(cardRow)) : el('div', { class: 'empty', text: '結びつく判断カードの候補はありません。' }),
    el('p', { class: 'teach-only' }, el('button', { type: 'button', class: 'print-btn', onclick: () => print() }, 'このテーマを印刷'))];
}

// ---------- 探す（すべてをまたいで。空白で区切ると全部を含むものに絞る） ----------
const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const HAY = [
  ...DATA.cards.map(c => ({ type: '判断カード', t: c.title, s: [c.check, c.ok, c.do, c.ng, c.words.join(' '), c.ev, c.dept].join(' '), href: '#/card/' + c.id, extra: c.when })),
  ...DATA.calls.map(c => ({ type: 'ベテランの判断', t: c.situation, s: [c.decision, c.because, c.outcome].join(' '), href: '#/call/' + c.id, extra: c.verdict })),
  ...DATA.ope.map(o => ({ type: '運営の型', t: o.title + (o.sub ? '（' + o.sub + '）' : ''), s: [o.body, ...o.items].join(' '), href: '#/ope/' + o.id, extra: o.kind_ja })),
  ...DATA.sections.map(x => ({ type: '教科書', t: `${x.id} ${x.title}`, s: x.text, href: '#/sec/' + encodeURIComponent(x.id), extra: x.tab })),
  ...DATA.events.map(e => ({ type: '催事', t: e.name, s: [e.note, ...e.depts.map(d => [d.dept, d.schedule, d.caution, ...d.corners.map(c => c.name + c.items + c.how)].join(' '))].join(' '), href: '#/event/' + e.id, extra: `${e.month}月` })),
  ...DATA.months.map(m => ({ type: '月の型', t: `${m.m}月 ${m.theme}`, s: [m.spot, m.note, ...Object.values(m.items).flatMap(g => g.list)].join(' '), href: '#/month/' + m.m, extra: '' })),
  ...DATA.terms.map(t => ({ type: '用語', t: t.name, s: [t.reading, t.short, t.example].join(' '), href: '#/term/' + encodeURIComponent(t.name), extra: '' })),
  ...wRows.map(r => ({ type: '天気', t: r.what, s: [r.hitokoto, r.numbers, r.group.title, '天気'].join(' '), href: '#/weather/' + r.id, extra: r.group.short })),
].map(h => Object.assign(h, { nt: norm(h.t), ns: norm(h.s) }));
function snippet(text, words) {
  const n = norm(text); let at = -1;
  for (const w of words) { at = n.indexOf(w); if (at >= 0) break; }
  const from = Math.max(0, at - 24), part = (text || '').slice(from, from + 90);
  return (from > 0 ? '…' : '') + part + ((text || '').length > from + 90 ? '…' : '');
}
function viewSearch(q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return viewHome();
  const hits = HAY.filter(h => words.every(w => h.nt.includes(w) || h.ns.includes(w)))
    .map(h => ({ h, score: words.reduce((a, w) => a + (h.nt.includes(w) ? 3 : 1), 0) })).sort((a, b) => b.score - a.score);
  const groups = new Map();
  for (const { h } of hits) { if (!groups.has(h.type)) groups.set(h.type, []); groups.get(h.type).push(h); }
  const order = ['判断カード', 'ベテランの判断', '運営の型', '催事', '月の型', '天気', '教科書', '用語'];
  const out = [el('h1', { text: `「${q}」で ${hits.length} 件` })];
  if (!hits.length) out.push(el('div', { class: 'empty', text: '見つかりませんでした。言葉を短くするか、別の言い方で探してください。' }));
  for (const type of order) {
    const g = groups.get(type); if (!g) continue;
    const box = rows(g.slice(0, 8).map(resRow(words)));
    out.push(el('h2', { text: `${type}（${g.length}）` }), box);
    if (g.length > 8) out.push(el('button', { type: 'button', class: 'more-btn', onclick: e => { box.replaceChildren(...g.map(resRow(words))); e.target.remove(); } }, `残り ${g.length - 8} 件も見る`));
  }
  return out;
}
const resRow = words => h => link(h.href, { class: 'row hit' }, el('div', { class: 't' }, h.t, h.extra ? el('span', { class: 'badge b-仮説', text: h.extra }) : null),
  el('div', { class: 'm', text: snippet(h.s, words) }));

const notFound = () => [el('h1', { text: '見つかりません' }), el('p', null, link('#/', null, 'トップへ戻る'))];

// ---------- 画面の行き来（飛んだら戻れる・戻ったら前の位置へ） ----------
const stack = [], scrollMemo = new Map();
let currentHash = null, suppressPush = false, newNavAt = -1e9;
try { history.scrollRestoration = 'manual'; } catch (_) { /* 古いブラウザは無視 */ }
document.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]')) newNavAt = performance.now(); }, true);
backBtn.addEventListener('click', () => {
  if (!stack.length) { if (location.hash && location.hash !== '#/') location.hash = '#/'; return; }
  suppressPush = true; location.hash = stack.pop();
});
addEventListener('hashchange', () => {
  const h = location.hash || '#/';
  if (currentHash) scrollMemo.set(currentHash, scrollY);
  const isNew = performance.now() - newNavAt < 1000; newNavAt = -1e9;
  if (!suppressPush && currentHash && currentHash !== h) stack.push(currentHash);
  suppressPush = false; currentHash = h;
  render(false, isNew ? 0 : (scrollMemo.get(h) || 0));
});
let typingTimer = 0;
qInput.addEventListener('input', () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    const q = qInput.value.trim(), h = q ? '#/q/' + encodeURIComponent(q) : '#/';
    if (!(currentHash || '').startsWith('#/q/') && q) stack.push(currentHash || '#/');
    history.replaceState(null, '', h); currentHash = h; render(true);
  }, 150);
});
qInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { qInput.value = ''; qInput.dispatchEvent(new Event('input')); }
  if (e.key === 'Enter') { const first = view.querySelector('a.row'); if (first) first.click(); }
});
addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(d => { d.open = true; }));

function render(fromTyping, restoreY) {
  const h = location.hash || '#/';
  const [, route = '', arg = ''] = h.match(/^#\/([^/]*)\/?(.*)$/) || [];
  const a = decodeURIComponent(arg);
  let nodes;
  if (route === 'q') { if (!fromTyping) qInput.value = a; nodes = viewSearch(a); }
  else if (route === 'shelf') nodes = viewShelf(a);
  else if (route === 'card') nodes = viewCard(a);
  else if (route === 'sec') nodes = viewSec(a);
  else if (route === 'ope') nodes = viewOpe(a);
  else if (route === 'call') nodes = viewCall(a);
  else if (route === 'events') nodes = viewEvents();
  else if (route === 'event') nodes = viewEvent(a);
  else if (route === 'month') nodes = viewMonth(a);
  else if (route === 'term') nodes = a ? viewTerm(a) : viewTerms();
  else if (route === 'themes') nodes = viewThemes();
  else if (route === 'theme') nodes = viewTheme(a);
  else if (route === 'weather') nodes = viewWeather(a);
  else nodes = viewHome();
  if (route !== 'q' && !fromTyping) qInput.value = '';
  view.replaceChildren(...[nodes].flat(Infinity).filter(x => x != null && x !== false));
  const focus = route === 'weather' && a && !restoreY ? document.getElementById('w-' + a) : null;   // 検索から来たら、その行へ
  if (focus) { focus.scrollIntoView({ block: 'center' }); focus.classList.add('flash'); }
  else if (!fromTyping) scrollTo(0, restoreY || 0);
  tip.style.display = 'none';
}
currentHash = location.hash || '#/';
render();
}

// ---------- Web 版の入口: ログインを確かめてから中身を受け取り、辞書を始める ----------
// 信頼境界（ここが守りの要。しくみの辞書の入口と同じ作り）:
//   - この画面の枠（GitHub Pages・公開）には中身を一切置かない。中身は GAS がログインを確かめてから返す
//   - Google から戻ったアドレスの # 以降は誰でも作れる値。この端末で出した合言葉（state）と一致したときだけ使う
//   - 札（アクセストークン）が本物で、見られる会社のアカウントかは、GAS が毎回 Google に問い合わせて確かめる。
//     画面の側でアカウントを判断して開けることはしない（画面の判断は書き換えられるため）
//   - スライドも中身と同じく、ログインを確かめてから GAS が返す（画像の形 data:image/… だけを使う）
// ログインは同じタブで Google へ移って戻る方式（窓＝ポップアップの方式は、2段階認証から戻ると結果が届かない件があった）
(() => {
  'use strict';
  const CONFIG = {"gasUrl": "https://script.google.com/macros/s/AKfycbxrVeOFC-rlPXQUWiB8rllZ4KIkrUPcaNp87hvlCnY0jCOwKTdf-VWsAB_Wb_dOAZk/exec", "clientId": "1072945615483-74jadmaet56chvhkfh2cpt4ae9dvh140.apps.googleusercontent.com", "redirectUri": "https://acoop-ai.github.io/tenpo-release/"};                 // { gasUrl, clientId, redirectUri }（build.py が web/config.json から差し込む）
  const TOKEN_KEY = 'storeops_token_v1';         // { t: 札, exp: 期限 }。札は1時間で切れる
  const STATE_KEY = 'storeops_oauth_state_v1';   // [{ s: 合言葉, t: 出した時刻, h: ログイン前に見ていた画面 }]
  const STATE_MAX_AGE = 10 * 60 * 1000;          // 合言葉は10分・1回限り

  const $ = s => document.querySelector(s);
  const gate = $('#gate'), msg = $('#gate-msg'), btn = $('#gate-login'), busy = $('#gate-busy');
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* 保存できなくても今回は使える */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* 同上 */ } },
  };

  function showGate(text, isError, buttonLabel) {
    document.body.classList.add('locked');
    gate.hidden = false;
    busy.hidden = true;
    msg.textContent = text;
    msg.classList.toggle('err', !!isError);
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = buttonLabel || 'Google でログイン';
  }
  function showBusy(text) {
    document.body.classList.add('locked');
    gate.hidden = false;
    msg.textContent = text;
    msg.classList.remove('err');
    btn.hidden = true;
    busy.hidden = false;
  }

  function randomState() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  function login() {
    const now = Date.now(), s = randomState();
    const pending = (store.get(STATE_KEY) || []).filter(x => now - x.t < STATE_MAX_AGE).slice(-4);
    pending.push({ s, t: now, h: location.hash || '' });
    store.set(STATE_KEY, pending);
    btn.disabled = true;
    msg.textContent = 'Google のログイン画面へ移ります…';
    const q = new URLSearchParams({
      client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri,
      response_type: 'token',
      scope: 'openid email',
      include_granted_scopes: 'true',
      // 会社以外のアカウントが自動で選ばれ続けないよう、毎回アカウントを選ばせる
      prompt: 'select_account',
      state: s,
    });
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
  }

  // Google から戻ったときの札を受け取る（boot.js がアドレスから取り出しておいたもの）
  function consumeRedirect() {
    const h = window.__oauthHash;
    window.__oauthHash = null;
    if (!h) return null;
    const p = new URLSearchParams(h.replace(/^#/, ''));
    const now = Date.now();
    const pending = store.get(STATE_KEY) || [];
    const hit = pending.find(x => x.s === p.get('state') && now - x.t < STATE_MAX_AGE);
    const rest = pending.filter(x => x !== hit && now - x.t < STATE_MAX_AGE);
    if (rest.length) store.set(STATE_KEY, rest); else store.del(STATE_KEY);
    if (!hit) return { error: 'ログインを確かめられませんでした（時間がたちすぎたか、別の画面から始めたログインです）。もう一度ログインしてください。' };
    if (p.get('error')) return { error: p.get('error') === 'access_denied' ? 'ログインが取り消されました。' : 'ログインに失敗しました。もう一度お試しください。', back: hit.h };
    const token = p.get('access_token');
    if (!token) return { error: 'ログインに失敗しました。もう一度お試しください。', back: hit.h };
    const sec = Math.max(60, Number(p.get('expires_in')) || 3600);
    store.set(TOKEN_KEY, { t: token, exp: now + (sec - 60) * 1000 });
    return { ok: true, back: hit.h };
  }

  async function post(body) {
    const r = await fetch(CONFIG.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // 事前確認（preflight）の要らない送り方
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
    });
    return r.json();
  }

  async function load(token) {
    showBusy('中身を読み込んでいます…');
    let res;
    try {
      res = await post({ action: 'load', accessToken: token });
    } catch (e) {
      showGate('中身を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。', true, 'もう一度読み込む');
      btn.onclick = () => load(token);
      return;
    }
    if (!res || !res.ok) {
      if (res && res.auth) {   // 札が切れた・見られるアカウントでない → 札を捨ててログインから
        store.del(TOKEN_KEY);
        showGate((res && res.error) || 'このアカウントでは見られません。会社のアカウントでログインしてください。', true);
        btn.onclick = login;
      } else {
        showGate((res && res.error) || '中身を読み込めませんでした。', true, 'もう一度読み込む');
        btn.onclick = () => load(token);
      }
      return;
    }
    document.body.classList.remove('locked');
    gate.hidden = true;
    startStoreOps(res.data, { mode: 'web', user: res.email, logout, relogin, fetchSlides });
  }

  // スライドを数枚ずつ受け取る。中身と同じく、ログインを確かめてから届く。画像の形のものだけを渡す
  async function fetchSlides(ids) {
    const tok = store.get(TOKEN_KEY);
    if (!tok || !tok.t || tok.exp <= Date.now()) return { ok: false, auth: true, error: 'ログインの期限が切れました。もう一度ログインしてください。' };
    try {
      const res = await post({ action: 'slides', ids, accessToken: tok.t });
      if (res && res.auth) store.del(TOKEN_KEY);
      if (res && res.ok) {
        const safe = {};
        for (const [k, v] of Object.entries(res.slides || {})) {
          if (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) safe[k] = v;
        }
        res.slides = safe;
      }
      return res;
    } catch (e) {
      return { ok: false, error: 'スライドを受け取れませんでした。通信の状態を確かめて、もう一度お試しください。' };
    }
  }
  // ログインし直す（入り直したら、いま見ている画面に戻る）
  function relogin() { store.del(TOKEN_KEY); login(); }

  function logout() {
    const tok = store.get(TOKEN_KEY);
    store.del(TOKEN_KEY);
    // 札を Google 側でも無効にする（届かなくても、この端末からは消えている）
    if (tok && tok.t) {
      try { fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(tok.t), { method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true }); } catch (_) { /* 同上 */ }
    }
    location.replace(location.pathname);
  }

  btn.onclick = login;
  if (!CONFIG.gasUrl) {
    showGate('いま準備中です。公開の準備ができたら、ここからログインできるようになります。', true);
    btn.hidden = true;
    return;
  }
  const back = consumeRedirect();
  if (back && back.back) history.replaceState(null, '', location.pathname + location.search + back.back);   // ログイン前に見ていた画面へ
  if (back && back.error) { showGate(back.error, true); return; }
  const tok = store.get(TOKEN_KEY);
  if (tok && tok.t && tok.exp > Date.now()) load(tok.t);
  else { store.del(TOKEN_KEY); showGate('会社の Google アカウントでログインしてください。'); }
})();
