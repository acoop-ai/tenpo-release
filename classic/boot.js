// Google から戻ったアドレスの # 以降（ログインの札）を、ほかの台本より先に取り出してアドレスから消す。
// 消さないと、履歴・画面のアドレス欄に札が残る。取り出した値は web.js が合言葉（state）と照らしてから使う
(function () {
  try {
    var h = location.hash || '';
    // 別の小さな画面（動画 video/・分析レポート reports/）が始めたログインの戻りは、札に触らず、そのまま、その画面へ渡す（戻り先の登録を増やさないため）
    var m = /(?:^#|&)state=(video|report)-[0-9a-f]+(?:&|$)/.exec(h);
    if (m) {
      window.stop();   // この辞書の画面の続きを読まない（窓口を呼ばない）
      location.replace((m[1] === 'video' ? 'video/' : 'reports/') + h);
      return;
    }
    if (/(^#|&)(access_token|error)=/.test(h)) {
      window.__oauthHash = h;
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch (e) { /* 取り出せなくてもログイン画面から入り直せる */ }
})();
