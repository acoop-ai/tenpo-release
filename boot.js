// Google から戻ったアドレスの # 以降（ログインの札）を、ほかの台本より先に取り出してアドレスから消す。
// 消さないと、履歴・画面のアドレス欄に札が残る。取り出した値は web.js が合言葉（state）と照らしてから使う
(function () {
  try {
    var h = location.hash || '';
    if (/(^#|&)(access_token|error)=/.test(h)) {
      window.__oauthHash = h;
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (e) { /* 取り出せなくてもログイン画面から入り直せる */ }
})();
