// ログインとアプリの7日の札（ステータス化 段1）。いまの辞書の入口（_src\web\web.js）と同じ守りに、アプリの札を足した形。
// 信頼境界:
//   - この画面の枠（GitHub Pages・公開）には中身を一切置かない。中身は窓口（GAS）が札を確かめてから返す
//   - Google から戻ったアドレスの # 以降は誰でも作れる値。この端末で出した合言葉（state）と一致したときだけ使う
//   - Google の札は、ログインの最初の1回だけ窓口へ渡す（startSession）。そのあとはアプリの札（7日）だけを送る
//   - 役目（店・本部・管理者）は画面では決めない（窓口が呼び出しのたびにスマレコの名簿で決める。画面の判断は書き換えられるため）
//   - 札の置き場は同じ公開元の全アプリで共有されるので、辞書だけの名前の鍵に置く。店の数は端末に残さない（ページを開いている間だけ）
(function () {
  'use strict';
  var CONFIG = window.STOREOPS_CONFIG || {};
  var SESSION_KEY = 'storeops_session_v1';      // { s: アプリの札, exp: 期限（ミリ秒）, email }
  var OLD_TOKEN_KEY = 'storeops_token_v1';      // Google の札（約1時間）。前の辞書の画面（classic/）と分析レポート（reports/）が同じ鍵で使うので、ログインしたら置き、期限まで消さない。アプリの札が無いときは、1回だけ黙ってアプリの札に替える
  var STATE_KEY = 'storeops_oauth_state_v1';
  var STATE_MAX_AGE = 10 * 60 * 1000;
  var GIVEUP_MS = 30000;   // s1127a: 開く・ログインの幕は 30 秒で待つのをやめ、理由と「もう一度」（決まり＝ハブ 40_projects_index\project_mitsubachi_character.md）
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても今回は使える */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } }
  };
  var mem = null;   // 置き場に書けない端末でも、ページを開いている間は使える

  function randomState() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function login() {
    var now = Date.now(), s = randomState();
    var pending = (store.get(STATE_KEY) || []).filter(function (x) { return now - x.t < STATE_MAX_AGE; }).slice(-4);
    pending.push({ s: s, t: now, h: location.hash || '' });
    store.set(STATE_KEY, pending);
    var q = new URLSearchParams({ client_id: CONFIG.clientId, redirect_uri: CONFIG.redirectUri, response_type: 'token', scope: 'openid email', include_granted_scopes: 'true', prompt: 'select_account', state: s });
    location.assign((CONFIG.authUrl || 'https://accounts.google.com/o/oauth2/v2/auth') + '?' + q.toString());
  }
  /** Google から戻ったときの札（boot.js がアドレスから取り出しておいたもの）。合言葉が合うときだけ */
  function consumeRedirect() {
    var h = window.__oauthHash; window.__oauthHash = null;
    if (!h) return null;
    var p = new URLSearchParams(h.replace(/^#/, '')), now = Date.now();
    var pending = store.get(STATE_KEY) || [];
    var hit = pending.filter(function (x) { return x.s === p.get('state') && now - x.t < STATE_MAX_AGE; })[0];
    var rest = pending.filter(function (x) { return x !== hit && now - x.t < STATE_MAX_AGE; });
    if (rest.length) store.set(STATE_KEY, rest); else store.del(STATE_KEY);
    if (!hit) return { error: 'ログインを確かめられませんでした（時間がたちすぎたか、別の画面から始めたログインです）。もう一度ログインしてください。' };
    if (p.get('error')) return { error: p.get('error') === 'access_denied' ? 'ログインが取り消されました。' : 'ログインに失敗しました。もう一度お試しください。', back: hit.h };
    if (!p.get('access_token')) return { error: 'ログインに失敗しました。もう一度お試しください。', back: hit.h };
    var sec = Math.max(60, Number(p.get('expires_in')) || 3600);
    store.set(OLD_TOKEN_KEY, { t: p.get('access_token'), exp: now + (sec - 60) * 1000 });   // 前の辞書の画面・分析レポートが、入り直さずに使える（いまの辞書と同じ置き方）
    return { google: p.get('access_token'), back: hit.h };
  }
  /** 窓口へ送る。giveUp（ミリ秒）を渡すと、その時間で待つのをやめる（s1127a: 開く・ログインの幕の 30 秒。返事を読み終えるまでを数える）。
   *  通信の失敗は code＝'NETWORK'、待つのをやめたときは code＝'TIMEOUT' の誤りで返す（呼んだ側が、幕の中で理由と「もう一度」を出す） */
  function post(body, giveUp) {
    var ctl = giveUp > 0 && typeof AbortController === 'function' ? new AbortController() : null, gave = false;
    var timer = ctl ? setTimeout(function () { gave = true; ctl.abort(); }, giveUp) : 0;
    var opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), cache: 'no-store', credentials: 'omit' };
    if (ctl) opt.signal = ctl.signal;
    return fetch(CONFIG.gasUrl, opt).then(function (r) { return r.json(); }).then(function (j) { clearTimeout(timer); return j; }, function () {
      clearTimeout(timer); var e = new Error(gave ? 'timeout' : 'network'); e.code = gave ? 'TIMEOUT' : 'NETWORK'; throw e;
    });
  }
  function session() {
    var s = mem || store.get(SESSION_KEY);
    return s && s.s && s.exp > Date.now() + 60000 ? s : null;
  }
  /** Google の札を、アプリの札に替える（ログインの最初の1回・前の画面の札の1回） */
  function exchange(googleToken) {
    return post({ action: 'startSession', accessToken: googleToken }, GIVEUP_MS).then(function (r) {
      if (r && r.ok && r.session) { mem = { s: r.session, exp: r.expiresAt, email: r.email }; store.set(SESSION_KEY, mem); return { ok: true }; }
      return r || { ok: false, error: 'ログインできませんでした。' };
    });
  }
  /** 窓口を呼ぶ（札を添える）。札が通らないときは札を捨てて、呼んだ側がログインの重ねを出す（入り直したら同じ画面で続ける） */
  function call(action, extra, opt) {
    var s = session();
    if (!s) return Promise.resolve({ ok: false, auth: true, error: 'ログインの期限が切れました。もう一度ログインしてください。' });
    return post(Object.assign({ action: action, session: s.s }, extra || {}), opt && opt.giveUp).then(function (r) {
      if (r && r.auth) { mem = null; store.del(SESSION_KEY); }
      return r;
    });
  }
  function logout() { mem = null; store.del(SESSION_KEY); store.del(OLD_TOKEN_KEY); store.del('storeops_role_v1'); location.replace(location.pathname); }   // この端末の札を捨てるだけ（Google の札も捨てる＝残すと次に開いたとき黙って入り直してしまう。Google の許可は取り消さない＝ほかのアプリ・端末を落とさない）

  /** はじめ: 戻り → いまの札 → 前の画面の札 → ログインの画面 の順に見て、通れば onReady(email) */
  function start(onReady, ui) {
    if (!CONFIG.gasUrl) { ui.gate('いま準備中です。公開の準備ができたら、ここからログインできるようになります。', true, null); return; }
    var back = consumeRedirect();
    if (back && back.back) history.replaceState(null, '', location.pathname + location.search + back.back);
    if (back && back.error) { ui.gate(back.error, true, login); return; }
    var go = function () { onReady(session().email); };
    // s1127a: 通信の失敗・30 秒・Google の確認が一時的にできない（窓口の retry）は、やり直せば直る＝幕の中に理由と「もう一度」（同じ札で確かめ直す・Google へ行き直さない）。
    //   ログインし直す道も残す（「Google でログインし直す」）。人が直す誤り（札が違う・使えないアカウント）は、いままでどおりログインの画面に字で
    var again = function (tok, onNo) {
      ui.busy('ログインを確かめています…');
      exchange(tok).then(function (r) {
        if (r.ok) { go(); return; }
        if (r.retry && ui.retry) { ui.retry({ title: 'ログインできませんでした', text: r.error || 'ログインできませんでした。', retry: function () { again(tok, onNo); }, closeLabel: 'Google でログインし直す', close: login }); return; }
        onNo(r);
      }, function (e) {
        var t = ui.netText ? ui.netText(e) : '通信できませんでした。通信の状態を確かめて、もう一度お試しください。';
        if (ui.retry) ui.retry({ title: 'ログインできませんでした', text: t, retry: function () { again(tok, onNo); }, closeLabel: 'Google でログインし直す', close: login });
        else ui.gate(t, true, login);
      });
    };
    if (back && back.google) { again(back.google, function (r) { ui.gate(r.error || 'ログインできませんでした。', true, login); }); return; }
    if (session()) { go(); return; }
    var old = store.get(OLD_TOKEN_KEY);
    if (old && old.t && old.exp > Date.now()) { again(old.t, function () { store.del(OLD_TOKEN_KEY); ui.gate('会社の Google アカウントでログインしてください。', false, login); }); return; }
    ui.gate('会社の Google アカウントでログインしてください。', false, login);
  }
  window.StoreOpsAuth = { start: start, call: call, login: login, logout: logout, session: session, GIVEUP_MS: GIVEUP_MS };
})();
